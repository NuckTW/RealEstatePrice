import { NextRequest, NextResponse } from 'next/server'
import { genAI, withFallback, isQuotaError, checkAccess, checkRateLimit, clientIp } from '@/lib/aiGuard'

/**
 * 潛在客群｜AI 建議自訂指數的組成與權重
 * 前端送：目標客群描述 + 可用指標清單（含手動資料）+ 目前配方
 * 回傳：建議的指標、權重、是否反向、理由（只是參考，使用者可再調整後儲存）
 * 存取與額度：與 AI 問答共用密碼與限流（每次建議算 1 題）
 */

interface IndicatorIn { key: string; label: string; unit?: string; group?: string; level?: string; desc?: string }
interface ComponentIn { key: string; weight: number; invert?: boolean }

const MAX_INDICATORS = 200
const MAX_SUGGEST = 8

/** 已驗證過的背景知識，讓 AI 少踩重複指標的坑（來自 2026-10 權重分析） */
const BACKGROUND = `
背景知識（台南 650 個村里的實際分析結果）：
- 指數算法：每個指標先轉成全市 650 里的百分位（0–100），再按權重加總；invert=true 代表「數值越低越好」（百分位用 100 減）。
- 現有三個預設指數：
  首購 = 世代淨移入25–34 30、25–34歲占比 20、結婚率 20、所得 20、社會增加率 10
  換新屋 = 世代淨移入35–44 20、35–44歲占比 20、出生率 20、所得 20、設籍宅數成長 20
  換二手 = 世代淨移入35–44 10、35–44歲占比 20、26–45歲戶長占比 20、所得 30、大學以上學歷 20
- 高度重複（排名相關 > 0.8）的組合，同時放進去等於重複加權：大學以上學歷 ↔ 所得、26–45歲戶長占比 ↔ 35–44歲人口占比。
- 一宅多戶占比、65歲以上戶長占比、30年以上老屋占比、住宅平均屋齡與購屋交易量呈負相關（多為偏鄉），若要用通常要 invert=true。
- 生活機能點數與購屋需求幾乎無關（市中心人少點多），權重不宜高。
- 行政區層級指標會讓同一區所有里拿到同一個分數，只能區分「區」不能區分「里」，權重建議 ≤ 20。
- 小里（人口未滿 1,000）的比率雜訊大。
`

export async function POST(req: NextRequest) {
  const a = checkAccess(req)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  if (!a.byToken) {
    const denied = checkRateLimit(clientIp(req))
    if (denied) return NextResponse.json({ error: denied }, { status: 429 })
  }

  let body: { goal?: string; indicators?: IndicatorIn[]; current?: ComponentIn[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }

  const goal = String(body.goal ?? '').trim().slice(0, 500)
  if (!goal) return NextResponse.json({ error: '請描述想找的客群' }, { status: 400 })
  const indicators = (Array.isArray(body.indicators) ? body.indicators : []).slice(0, MAX_INDICATORS)
    .map(i => ({
      key: String(i.key).slice(0, 60), label: String(i.label).slice(0, 60), unit: String(i.unit ?? '').slice(0, 20),
      group: String(i.group ?? '').slice(0, 30), level: String(i.level ?? '').slice(0, 10), desc: String(i.desc ?? '').slice(0, 120),
    }))
  if (!indicators.length) return NextResponse.json({ error: '沒有可用指標' }, { status: 400 })
  const keys = new Set(indicators.map(i => i.key))
  const current = (Array.isArray(body.current) ? body.current : []).filter(c => keys.has(c.key)).slice(0, 30)

  const list = indicators.map(i => `- ${i.key}｜${i.label}（${i.unit || '—'}｜${i.level}｜${i.group}）${i.desc}`).join('\n')
  const prompt = `你是台南房地產市場分析師，協助使用者設計「村里潛在客群指數」。
${BACKGROUND}
可用指標（key｜名稱（單位｜層級｜分類）說明）：
${list}

使用者目前的配方：${current.length ? current.map(c => `${c.key}=${c.weight}${c.invert ? '(反向)' : ''}`).join('、') : '（空白）'}

使用者想找的客群：「${goal}」

請挑 3–${MAX_SUGGEST} 個最能代表這個客群的指標並給權重（整數，總和 100），避免高度重複的指標同時給高權重。
只能使用上面清單裡的 key。用繁體中文回答，理由每項一句話、具體說明為什麼。
只回傳 JSON，格式：
{"name":"建議指數名稱（10 字內）","summary":"整體思路（2 句內）","components":[{"key":"…","weight":30,"invert":false,"reason":"…"}],"cautions":["使用這個指數要注意的地方（最多 3 點）"]}`

  try {
    const { result, model } = await withFallback(id =>
      genAI.getGenerativeModel({ model: id, generationConfig: { responseMimeType: 'application/json', temperature: 0.3 } })
        .generateContent(prompt))
    const text = result.response.text()
    let parsed: { name?: string; summary?: string; components?: (ComponentIn & { reason?: string })[]; cautions?: string[] }
    try { parsed = JSON.parse(text) } catch {
      // 少數情況模型會包 ```json 區塊
      parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
    }

    // 驗證：只保留清單內的 key、權重合理；重複 key 合併
    const seen = new Set<string>()
    const components = (parsed.components ?? [])
      .filter(c => keys.has(c.key) && Number.isFinite(Number(c.weight)) && Number(c.weight) > 0)
      .filter(c => (seen.has(c.key) ? false : (seen.add(c.key), true)))
      .slice(0, MAX_SUGGEST)
      .map(c => ({
        key: c.key, weight: Math.min(100, Math.round(Number(c.weight))), invert: Boolean(c.invert),
        reason: String(c.reason ?? '').slice(0, 200),
      }))
    if (!components.length) return NextResponse.json({ error: 'AI 沒有給出可用的建議，請換個描述再試' }, { status: 502 })

    return NextResponse.json({
      name: String(parsed.name ?? '').slice(0, 40),
      summary: String(parsed.summary ?? '').slice(0, 400),
      components,
      cautions: (parsed.cautions ?? []).slice(0, 3).map(s => String(s).slice(0, 200)),
      model,
    })
  } catch (err) {
    console.error('[/api/potential-buyers/ai-weights]', err)
    return NextResponse.json(
      { error: isQuotaError(err) ? 'AI 模型今日免費額度已用完，請明天再試' : 'AI 建議失敗，請稍後再試' },
      { status: isQuotaError(err) ? 429 : 500 },
    )
  }
}
