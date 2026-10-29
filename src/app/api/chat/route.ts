import { NextRequest } from 'next/server'
import { runChatQuery } from '@/lib/queries/client'
// Gemini client、模型 fallback、密碼驗證、限流與 AI 權重建議共用（見 src/lib/aiGuard.ts）
import { genAI, withFallback, isQuotaError, safeEqual, checkRateLimit, clientIp } from '@/lib/aiGuard'
// 圖表判斷、給回答模型的摘要（前端 ChatChart 也共用，見 src/lib/chatData.ts）
import { detectChartConfig, buildRowSummary, CLIENT_ROW_LIMIT, CHAT_ROW_CAP } from '@/lib/chatData'

const DB_SCHEMA = `
你是台南市實價登錄資料分析師。資料庫有一個主要資料表 transactions，欄位如下：

基本欄位：
- district (text): 行政區，例如「東區」「永康區」「仁德區」「安平區」「中西區」
- transaction_date (date): 交易日期，格式 YYYY-MM-DD
- address (text): 地址
- is_presale (boolean): 是否為預售屋（true=預售屋，false=成屋）
- project_name (text): 建案名稱（預售屋專屬，例如「公園伯爵23」）
- unit_number (text): 棟及號（預售屋，例如「A棟6號」）
- source_season (text): 資料季別，例如「115S1」

價格欄位：
- total_price (bigint): 總價（元），換算萬元請除以 10000
- unit_price_sqm (numeric): 單價（元/平方公尺），換算萬元/坪：乘以 3.3058 再除以 10000
- parking_price (bigint): 車位總價（元）

面積欄位（平方公尺）：
- building_area_sqm (numeric): 建物總面積
- main_area (numeric): 主建物面積
- aux_area (numeric): 附屬建物面積
- balcony_area (numeric): 陽台面積
- land_area (numeric): 土地面積
- parking_area (numeric): 車位面積

建物欄位：
- building_type (text): 建物型態，例如「住宅大樓(11層含以上有電梯)」「透天厝」「公寓(5樓含以下無電梯)」「華廈(10層含以下有電梯)」
- main_material (text): 主要建材
- completion_date (text): 建築完成年月（民國格式）
- floor (text): 移轉層次
- total_floors (int): 總樓層數
- rooms (int): 房間數
- living_rooms (int): 廳數
- bathrooms (int): 衛浴數
- has_elevator (boolean): 是否有電梯
- has_management (boolean): 是否有管理組織
- main_use (text): 主要用途，例如「住家用」
- urban_land_use (text): 都市土地使用分區
- parking_type (text): 車位類別

只能查 transactions 這一張表（其他表與 view 都沒有權限），統計請直接對 transactions 做 GROUP BY。

重要換算：
- 總價（元）→ 萬元：除以 10000
- 單價（元/m²）→ 萬元/坪：× 3.3058 ÷ 10000
- 資料涵蓋民國110年（2021年）至今（2026年）
`

interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  // ── 存取控制 ──
  const byToken = safeEqual(req.headers.get('x-api-token'), process.env.CHAT_API_TOKEN)
  if (!byToken) {
    if (!process.env.CHAT_PASSWORD) {
      return Response.json({ error: 'AI 問答功能尚未設定密碼，暫停服務' }, { status: 503 })
    }
    if (!safeEqual(req.headers.get('x-chat-password'), process.env.CHAT_PASSWORD)) {
      return Response.json({ error: '密碼錯誤' }, { status: 401 })
    }
    // 私人 token 不限流；密碼使用者走限流
    const denied = checkRateLimit(clientIp(req))
    if (denied) return Response.json({ error: denied }, { status: 429 })
  }

  const body = await req.json()
  const question: string = body.question ?? ''
  const history: HistoryItem[] = body.history ?? []

  if (!question.trim()) {
    return Response.json({ error: '請輸入問題' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }

      try {
        // ── 對話歷史 context（最近4輪）──────────────────
        const recentHistory = history.slice(-8)
        const historyCtx = recentHistory.length
          ? '對話歷史（供參考）：\n' +
            recentHistory.map(h =>
              `${h.role === 'user' ? '使用者' : 'AI'}：${h.content}`
            ).join('\n') + '\n\n'
          : ''

        // ── Step 1：生成 SQL ─────────────────────────────
        const sqlPrompt = `${DB_SCHEMA}

${historyCtx}使用者問題：「${question}」

請根據以上資料庫結構，生成一條 PostgreSQL SELECT 查詢語句。
規則：
1. 只輸出純 SQL，不要任何說明文字或 markdown
2. 不要加 LIMIT，除非問題明確要求「前N名」或「最貴N筆」等排名性質查詢
3. 金額欄位記得換算（total_price ÷ 10000）
4. 單價換算：ROUND(unit_price_sqm * 3.3058 / 10000, 1)
5. 日期範圍預設為近 2 年，除非問題有指定
6. 只能 SELECT，不可 INSERT/UPDATE/DELETE/DROP
7. 若問題是追問（「那」「呢」「再看」等），請根據對話歷史理解指向`

        const { result: sqlRes, model: sqlModel } = await withFallback(id =>
          genAI.getGenerativeModel({ model: id }).generateContent(sqlPrompt)
        )
        let sql = sqlRes.response.text().trim()
        sql = sql.replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim()
        sql = sql.replace(/;\s*$/, '').trim()

        // 第一道：只收單一 SELECT / WITH（擋掉明顯不對的，省一次 DB 往返）
        // 真正的防線在 DB：chat_query 以唯讀 chat_reader 身分執行，見 runChatQuery 註解
        // 舊版的關鍵字黑名單會誤殺 updated_at 這類欄名、又擋不住註解變形，已拿掉
        if (!/^(select|with)\b/i.test(sql) || sql.includes(';')) {
          send({ type: 'error', message: '只支援查詢類型的問題' })
          controller.close()
          return
        }

        send({ type: 'sql', sql })

        // ── Step 2：執行 SQL ─────────────────────────────
        const { rows: queryRows, error: dbError } = await runChatQuery(sql)

        let rows: Record<string, unknown>[] = []
        if (dbError) {
          console.error('[chat] DB error:', dbError.message)
          send({ type: 'db_error', message: dbError.message })
          // 繼續讓 AI 說明
        } else {
          rows = queryRows
        }

        // DB 最多回 CHAT_ROW_CAP + 1 筆：超過代表被截斷，統計只涵蓋前 CHAT_ROW_CAP 筆
        const truncated = rows.length > CHAT_ROW_CAP
        if (truncated) rows = rows.slice(0, CHAT_ROW_CAP)

        // 圖表與摘要用完整結果算；送前端的只截前 CLIENT_ROW_LIMIT 筆（逐筆明細可能上萬筆）
        const chart = detectChartConfig(rows)
        send({ type: 'rows', rows: rows.slice(0, CLIENT_ROW_LIMIT), total: rows.length, truncated, chart })

        // ── Step 3：Streaming 自然語言回答 ──────────────
        // 傳給 Gemini 的是「摘要 + 樣本」，結果不多時才給全部（避免 token 爆炸）
        const rowSummary = buildRowSummary(rows)
        const answerPrompt = `使用者問題：「${question}」

${truncated
  ? `查詢結果超過 ${CHAT_ROW_CAP} 筆，只取前 ${CHAT_ROW_CAP} 筆，以下統計不代表全部資料；請在回答中說明這點，並建議使用者縮小範圍（例如指定行政區、期間）或改問統計型問題。`
  : `查詢共回傳 ${rows.length} 筆資料。`}
${rowSummary}

${dbError ? `查詢時發生錯誤：${dbError.message}\n` : ''}
請用**繁體中文**、條列式方式回答使用者問題。
- 必須使用繁體中文，禁止出現簡體字
- 回答格式以「・」或「－」開頭的條列項目呈現，每點一個重點
- 金額請加「萬元」單位，數量加「筆」或「件」
- 數字盡量精確，並標明是中位數、平均值或總計
- 價格以中位數為主（平均數容易被整批交易、土地交易等極端值拉高）
- 若結果為空，請說明可能原因
- 總結放在最後一條，以「📌 小結：」開頭`

        // 回答階段沿用生 SQL 成功的那個模型（主模型若已 429 就不再白打一次）
        const { result: answerStream, model: answerModel } = await withFallback(
          id => genAI.getGenerativeModel({ model: id }).generateContentStream(answerPrompt),
          sqlModel,
        )

        for await (const chunk of answerStream.stream) {
          const text = chunk.text()
          if (text) send({ type: 'text', delta: text })
        }

        send({ type: 'done', model: answerModel })
      } catch (err) {
        console.error('[chat] error:', err)
        send({
          type: 'error',
          message: isQuotaError(err) ? 'AI 模型今日免費額度已用完，請明天再試' : '查詢失敗，請稍後再試',
        })
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    }
  })
}
