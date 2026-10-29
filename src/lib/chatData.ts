/**
 * AI 問答：查詢結果的後處理（圖表判斷、給 LLM 的摘要、欄位中文名、長轉寬）
 * 純函式、沒有 server 依賴：/api/chat 與前端 ChatChart / ChatInterface 共用
 */

export type Row = Record<string, unknown>

export interface ChartConfig {
  type: 'bar' | 'line'
  xKey: string
  yKeys: string[]       // 要畫的數值欄（同一種單位）
  seriesKey?: string    // 長表格的分組欄（例：每月 × 行政區），前端轉成寬表格後每個值畫一條
}

// 送到前端的筆數上限：表格只顯示用，統計與摘要都用完整結果算
export const CLIENT_ROW_LIMIT = 200
// DB 端 chat_query 最多回 CHAT_ROW_CAP + 1 筆（多 1 筆用來判斷是否被截斷），兩邊數字要一致
export const CHAT_ROW_CAP = 10000

// 超過這個筆數就不畫圖：多半是逐筆明細，畫出來只會是一堆 <1px 的長條
const MAX_CHART_ROWS = 60
// 多序列圖最多幾條
const MAX_SERIES = 6
// 結果不超過這個筆數時，整份交給回答模型（不只給前 20 筆樣本）
const FULL_ROWS_TO_LLM = 60

const TIME_KEY_RE = /^(month|year|ym|quarter|season|period|date|月份|年月|年度|年份|季別|季度)$|_(month|ym|year|quarter)$/i
const CAT_KEY_RE = /^(district|building_type|type|rooms|project_name|main_use|行政區|類型|區域|建物型態|建案)$/i
// 不能當數值指標的欄位：日期／季別／年月／id（數字長得像數值，但算平均沒意義）
const NON_METRIC_RE = /(date|season|_at$|^id$|_id$|^year$|^month$|^ym$|^quarter$)/i

function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v)
  return typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))
}

function presentValues(rows: Row[], k: string): unknown[] {
  return rows.map(r => r[k]).filter(v => v != null && v !== '')
}

/** 整欄（忽略空值）都是數值才算數值欄；boolean 不算 */
function isNumericColumn(rows: Row[], k: string): boolean {
  const vals = presentValues(rows, k)
  return vals.length > 0 && vals.every(isNumericValue)
}

/** 指標的單位族群：不同族群（例：總價 vs 單價 vs 筆數）不放同一張圖 */
function metricFamily(k: string): string {
  if (/unit_price|單價|per_ping|price_per/i.test(k)) return 'unit_price'
  if (/total_price|總價|price_wan|總銷/i.test(k)) return 'total_price'
  if (/count|cnt|筆數|件數|^n$|transactions|交易量/i.test(k)) return 'count'
  if (/area|面積|坪數/i.test(k)) return 'area'
  if (/ratio|pct|percent|rate|比例|比率|佔比/i.test(k)) return 'ratio'
  return k  // 認不出單位：自成一類，只跟自己畫在一起
}

/** 從查詢結果推斷圖表；只有「已聚合」的結果才畫，逐筆明細回傳 null（前端改顯示表格） */
export function detectChartConfig(rows: Row[]): ChartConfig | null {
  if (rows.length < 2 || rows.length > MAX_CHART_ROWS) return null
  const keys = Object.keys(rows[0])

  const timeKey = keys.find(k => TIME_KEY_RE.test(k))
  const metricKeys = keys.filter(k =>
    k !== timeKey && !CAT_KEY_RE.test(k) && !NON_METRIC_RE.test(k) && isNumericColumn(rows, k)
  )
  // 維度：時間欄優先，其次是已知分類欄，再來是其他非數值欄（文字、boolean）
  const dimKeys = [
    ...(timeKey ? [timeKey] : []),
    ...keys.filter(k => k !== timeKey && CAT_KEY_RE.test(k)),
    ...keys.filter(k => k !== timeKey && !CAT_KEY_RE.test(k) && !metricKeys.includes(k)),
  ]
  const xKey = dimKeys[0]
  if (!xKey || !metricKeys.length) return null

  // x 值不重複 → 單序列；重複的話找一個分組欄讓 (x, 分組) 不重複 → 多序列；都不行代表不是聚合結果
  const distinct = (k: string) => new Set(rows.map(r => String(r[k]))).size
  let seriesKey: string | undefined
  if (distinct(xKey) !== rows.length) {
    seriesKey = dimKeys.slice(1).find(s =>
      distinct(s) <= MAX_SERIES &&
      new Set(rows.map(r => `${String(r[xKey])}\u0000${String(r[s])}`)).size === rows.length
    )
    if (!seriesKey) return null
  }

  // 只畫和第一個指標同單位的欄位（避免總價(萬)跟單價(萬/坪)擠在同一個 y 軸）
  const family = metricFamily(metricKeys[0])
  const yKeys = metricKeys.filter(k => metricFamily(k) === family).slice(0, seriesKey ? 1 : 3)

  return { type: timeKey && xKey === timeKey ? 'line' : 'bar', xKey, yKeys, seriesKey }
}

/** boolean / 分組值的顯示文字 */
export function valueLabel(k: string, v: unknown): string {
  if (v == null || v === '') return '未分類'
  if (typeof v === 'boolean') {
    if (k === 'is_presale') return v ? '預售屋' : '成屋'
    return v ? '是' : '否'
  }
  return String(v)
}

/**
 * 依 ChartConfig 把 rows 轉成 Recharts 用的資料
 * - 有 seriesKey：長轉寬，每個分組值一條（dataKey 用 s0、s1…，避免中文或「.」被 Recharts 當成巢狀路徑）
 * - 折線圖：依 x 升冪排序（SQL 可能用筆數或價格排序，時間軸會亂跳）
 */
export function buildChartData(
  rows: Row[],
  chart: ChartConfig,
  fmtX: (v: unknown) => string,
): { data: Row[]; series: { key: string; label: string }[] } {
  const { type, xKey, yKeys, seriesKey } = chart
  const toNum = (v: unknown) => (isNumericValue(v) ? Number(v) : null)   // 缺值畫成斷點，不要變 0
  const xLabel = (v: unknown) => (typeof v === 'boolean' ? valueLabel(xKey, v) : fmtX(v))

  let sorted = rows
  if (type === 'line') {
    const allNum = rows.every(r => isNumericValue(r[xKey]))
    sorted = [...rows].sort((a, b) => allNum
      ? Number(a[xKey]) - Number(b[xKey])
      : String(a[xKey]).localeCompare(String(b[xKey])))
  }

  if (!seriesKey) {
    return {
      data: sorted.map(r => {
        const entry: Row = { [xKey]: xLabel(r[xKey]) }
        for (const k of yKeys) entry[k] = toNum(r[k])
        return entry
      }),
      series: yKeys.map(k => ({ key: k, label: friendlyLabel(k) })),
    }
  }

  const yKey = yKeys[0]
  const seriesIdx = new Map<string, string>()   // 分組顯示文字 → dataKey
  const byX = new Map<string, Row>()
  for (const r of sorted) {
    const x = xLabel(r[xKey])
    const label = valueLabel(seriesKey, r[seriesKey])
    if (!seriesIdx.has(label)) seriesIdx.set(label, `s${seriesIdx.size}`)
    const entry = byX.get(x) ?? { [xKey]: x }
    entry[seriesIdx.get(label)!] = toNum(r[yKey])
    byX.set(x, entry)
  }
  return {
    data: [...byX.values()],
    series: [...seriesIdx].map(([label, key]) => ({ key, label })),
  }
}

// ── 欄位中文名 ───────────────────────────────────────────
const FRIENDLY: Record<string, string> = {
  district:          '行政區',
  building_type:     '建物型態',
  project_name:      '建案',
  is_presale:        '預售屋',
  transaction_date:  '交易日期',
  source_season:     '資料季別',
  month:             '月份',
  year:              '年度',
  ym:                '年月',
  quarter:           '季',
  rooms:             '房數',
  address:           '地址',
  floor:             '樓層',
  total_floors:      '總樓層',
  avg_unit_price:    '平均單價(萬/坪)',
  unit_price:        '單價(萬/坪)',
  unit_price_ping:   '單價(萬/坪)',
  unit_price_sqm:    '單價(元/㎡)',
  avg_total_price:   '平均總價(萬)',
  total_price:       '總價(萬)',
  total_price_wan:   '總價(萬)',
  transaction_count: '交易筆數',
  total_transactions:'交易筆數',
  count:             '筆數',
  cnt:               '筆數',
  avg_price:         '均價',
  total_sales:       '總銷(億)',
}

const PREFIX: Record<string, string> = { avg: '平均', median: '中位數', max: '最高', min: '最低', sum: '合計' }

/** 欄位名轉中文（認不出來就回傳原名） */
export function friendlyLabel(k: string): string {
  if (FRIENDLY[k]) return FRIENDLY[k]
  const m = k.match(/^(avg|median|max|min|sum)_(.+)$/)
  if (m && FRIENDLY[m[2]]) return PREFIX[m[1]] + FRIENDLY[m[2]]
  return k
}

// ── 給回答模型的摘要 ─────────────────────────────────────
/** 把全部 rows 壓縮成 Gemini 可讀的摘要，避免 token 爆炸；結果不多時直接給全部 */
export function buildRowSummary(rows: Row[]): string {
  if (!rows.length) return '（無資料）'

  const keys = Object.keys(rows[0])
  const numStats: string[] = []
  const catStats: string[] = []

  for (const k of keys) {
    const vals = presentValues(rows, k)
    if (!vals.length) continue

    // boolean → 是/否筆數（以前被 Number() 轉成 1/0 又把 0 濾掉，才會算出「預售屋標記平均 1.0」）
    if (vals.every(v => typeof v === 'boolean')) {
      const t = vals.filter(v => v === true).length
      catStats.push(`${k}：${valueLabel(k, true)} ${t}筆、${valueLabel(k, false)} ${vals.length - t}筆`)
      continue
    }

    // 數值欄 → 中位數 / 平均 / 最低 / 最高（0 多半代表無資料，例如純土地交易沒有建物單價，不列入）
    if (!NON_METRIC_RE.test(k) && vals.every(isNumericValue)) {
      const nums = vals.map(Number).filter(v => v !== 0).sort((a, b) => a - b)
      if (!nums.length) continue
      const mid = Math.floor(nums.length / 2)
      const median = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      numStats.push(
        `${k}：中位數 ${median.toFixed(1)}，平均 ${avg.toFixed(1)}，` +
        `最低 ${nums[0].toFixed(1)}，最高 ${nums[nums.length - 1].toFixed(1)}（${nums.length} 筆有值）`
      )
      continue
    }

    // 文字欄（含日期、季別）→ 頻率前 5
    const freq: Record<string, number> = {}
    for (const v of vals) freq[String(v)] = (freq[String(v)] ?? 0) + 1
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
    catStats.push(`${k}：${top.map(([v, n]) => `${v}(${n}筆)`).join('、')}`)
  }

  const sampleRows = rows.length <= FULL_ROWS_TO_LLM ? rows : rows.slice(0, 20)
  const sampleTitle = sampleRows.length === rows.length ? `全部 ${rows.length} 筆` : `前 ${sampleRows.length} 筆樣本`

  return [
    numStats.length ? `數值統計：\n${numStats.join('\n')}` : '',
    catStats.length ? `類別分佈：\n${catStats.join('\n')}` : '',
    `${sampleTitle}：\n${JSON.stringify(sampleRows, null, 2)}`,
  ].filter(Boolean).join('\n\n')
}
