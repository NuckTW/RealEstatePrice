import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// 提供給 Gemini 的資料庫 schema 說明
const DB_SCHEMA = `
你是台南市實價登錄資料分析師。資料庫有一個主要資料表 transactions，欄位如下：

- district (text): 行政區，例如「東區」「永康區」「仁德區」
- transaction_date (date): 交易日期，格式 YYYY-MM-DD
- building_type (text): 建物型態，例如「住宅大樓(11層含以上有電梯)」「透天厝」「公寓(5樓含以下無電梯)」「華廈(10層含以下有電梯)」
- total_price (bigint): 總價（元）
- unit_price_sqm (numeric): 單價（元/平方公尺）
- building_area_sqm (numeric): 建物面積（平方公尺）
- floor (text): 移轉層次
- total_floors (int): 總樓層數
- rooms (int): 房間數
- living_rooms (int): 廳數
- bathrooms (int): 衛浴數
- has_elevator (boolean): 是否有電梯
- has_management (boolean): 是否有管理組織
- main_use (text): 主要用途，例如「住家用」
- completion_date (text): 建築完成年月（民國格式）
- parking_type (text): 車位類別
- parking_price (bigint): 車位總價（元）
- address (text): 地址
- source_season (text): 資料季別，例如「115S1」
- is_presale (boolean): 是否為預售屋（true=預售屋，false=成屋）
- project_name (text): 建案名稱（預售屋專屬，例如「公園伯爵23」）

有用的 View：
- district_monthly_stats: 行政區月統計（district, month, transaction_count, avg_unit_price, avg_total_price）
- yearly_overview: 全市年度統計（year, total_transactions, avg_unit_price, avg_total_price_wan）

重要提示：
- 總價通常以元計，換算成萬元請除以10000
- 單價以元/平方公尺計，換算成萬元/坪請乘以3.3058再除以10000
- 資料涵蓋民國110年（2021年）至今
`

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()
    if (!question?.trim()) {
      return NextResponse.json({ error: '請輸入問題' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Step 1：讓 Gemini 生成 SQL
    const sqlPrompt = `
${DB_SCHEMA}

使用者問題：「${question}」

請根據以上資料庫結構，生成一條 PostgreSQL SELECT 查詢語句來回答這個問題。
規則：
1. 只輸出純 SQL，不要任何說明文字或 markdown
2. 結果最多回傳20筆
3. 涉及金額時，total_price 和 avg_total_price 記得除以10000換算成萬元
4. 日期範圍預設為近2年，除非問題有指定
5. 只能查詢，不可使用 INSERT/UPDATE/DELETE
`
    const sqlResult = await model.generateContent(sqlPrompt)
    let sql = sqlResult.response.text().trim()

    // 清理 SQL（移除 markdown code block 與結尾分號）
    sql = sql.replace(/^```sql\s*/i, '').replace(/```\s*$/, '').trim()
    sql = sql.replace(/;\s*$/, '').trim()  // 移除結尾分號（會破壞 subquery wrapper）

    // 安全性檢查
    const lower = sql.toLowerCase()
    if (['insert', 'update', 'delete', 'drop', 'truncate', 'alter'].some(k => lower.includes(k))) {
      return NextResponse.json({ error: '不支援此類型的查詢', sql }, { status: 400 })
    }

    // Step 2：執行 SQL（透過 execute_query RPC）
    const { data: rpcResult, error: dbError } = await supabaseAdmin
      .rpc('execute_query', { query_text: sql })

    let rows: Record<string, unknown>[] = []
    if (dbError) {
      console.error('[/api/chat] RPC error:', dbError)
    } else {
      // execute_query 回傳 json（陣列），直接使用
      if (Array.isArray(rpcResult)) {
        rows = rpcResult
      } else if (rpcResult) {
        rows = [rpcResult]
      }
    }

    // Step 3：讓 Gemini 生成口語化回覆
    const answerPrompt = `
使用者問題：「${question}」

SQL 查詢結果（JSON 格式）：
${JSON.stringify(rows, null, 2)}

請用繁體中文、口語化、友善的方式回答使用者的問題。
- 數字要格式化（金額加上萬元單位、數量加上「筆」或「件」）
- 如果結果是空的，請說明可能原因
- 回答要簡潔有重點，100-200字為佳
`
    const answerResult = await model.generateContent(answerPrompt)
    const answer = answerResult.response.text().trim()

    return NextResponse.json({ answer, sql, rows })
  } catch (err) {
    console.error('[/api/chat]', err)
    return NextResponse.json({ error: '查詢失敗，請稍後再試' }, { status: 500 })
  }
}
