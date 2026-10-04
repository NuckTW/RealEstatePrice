import { NextRequest, NextResponse } from 'next/server'
import { genAI, withFallback, isQuotaError, checkAccess, checkRateLimit, clientIp } from '@/lib/aiGuard'

/**
 * 潛在客群｜客源分析的 AI 文字解讀
 * 前端送：分析位置、產品條件、模型結果摘要（前 15 里、各區占比、就業地）
 * 回傳：一段繁體中文解讀（主要客源、客群輪廓、行銷建議、注意事項）
 * 存取與額度：與 AI 問答共用密碼與限流（每次解讀算 1 題）
 */

interface Body {
  site?: { label?: string }
  product?: { priceWan?: number; rooms?: number; type?: string }
  params?: { halfKm?: number; fbShare?: number }
  summary?: { radius80?: number | null; fbPart?: number; annualWan?: number }
  villages?: { name?: string; share?: number; distKm?: number; burden?: number | null }[]
  districts?: { district?: string; share?: number }[]
  jobs?: { district?: string; employees?: number; distKm?: number }[]
}

const n = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null)
const s = (v: unknown, max = 40) => String(v ?? '').slice(0, max)
const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—')

export async function POST(req: NextRequest) {
  const a = checkAccess(req)
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status })
  if (!a.byToken) {
    const denied = checkRateLimit(clientIp(req))
    if (denied) return NextResponse.json({ error: denied }, { status: 429 })
  }

  let b: Body
  try { b = await req.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }
  const villages = (b.villages ?? []).slice(0, 15)
  if (!villages.length) return NextResponse.json({ error: '沒有分析結果' }, { status: 400 })

  const type = b.product?.type === 'resale' ? '成屋（二手）' : '預售／新成屋'
  const lines = [
    `分析位置：${s(b.site?.label, 60)}`,
    `產品：總價約 ${n(b.product?.priceWan, 0)} 萬、${n(b.product?.rooms, 0)} 房、${type}；年房貸約 ${n(b.summary?.annualWan, 1)} 萬（八成、30 年）`,
    `假設：距離每 ${n(b.params?.halfKm, 1)} 公里吸引力減半；首購比重 ${pct(b.params?.fbShare)}；模型推得首購客群約占 ${pct(b.summary?.fbPart)}`,
    `80% 客源在 ${n(b.summary?.radius80, 1) ?? '—'} 公里內`,
    `各區客源占比：${(b.districts ?? []).slice(0, 8).map(d => `${s(d.district, 8)} ${pct(d.share)}`).join('、')}`,
    `前幾名客源村里：${villages.map(v => `${s(v.name, 16)}（${pct(v.share)}、${n(v.distKm, 1)} 公里、房貸占所得 ${v.burden == null ? '—' : pct(v.burden)}）`).join('、')}`,
    `附近就業人口（普查從業員工，依距離加權排序）：${(b.jobs ?? []).slice(0, 5).map(j => `${s(j.district, 8)} ${n(j.employees, 0)} 人（${n(j.distKm, 1)} 公里）`).join('、') || '—'}`,
  ]

  const prompt = `你是台南房地產行銷顧問。以下是一個建案（或地點）的「客源分析」模型結果。
模型：各村里客源分數 = 距離衰減 × 負擔能力 × （目標年齡人口 × 首購／換屋指數係數），客源占比是相對可能性推估，不是實際買方統計。

${lines.join('\n')}

請用繁體中文寫一段給代銷或建商看的解讀，約 300–450 字，分四個小標：
1. 主要客源：哪些區、哪些里，為什麼
2. 客群輪廓：首購或換屋為主、負擔能力如何
3. 行銷建議：廣告投放區域、訴求重點（具體到區或里）
4. 注意事項：模型限制（例如距離衰減是假設值、所得資料落後、就業人口不等於居住人口）
只根據上面的數字推論，不要編造資料中沒有的事實（例如具體學校、捷運站名、建商名稱）。不要用 Markdown 表格。`

  try {
    const { result, model } = await withFallback(id =>
      genAI.getGenerativeModel({ model: id, generationConfig: { temperature: 0.4 } }).generateContent(prompt))
    return NextResponse.json({ text: result.response.text().slice(0, 4000), model })
  } catch (err) {
    console.error('[/api/potential-buyers/catchment-ai]', err)
    return NextResponse.json(
      { error: isQuotaError(err) ? 'AI 模型今日免費額度已用完，請明天再試' : 'AI 解讀失敗，請稍後再試' },
      { status: isQuotaError(err) ? 429 : 500 },
    )
  }
}
