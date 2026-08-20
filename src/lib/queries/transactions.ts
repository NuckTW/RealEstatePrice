/**
 * 實價登錄明細查詢（/api/transactions 用，逐筆列出，非聚合）
 */
import { cachedQuery, type Row } from './client'

/**
 * 逐筆交易明細，依成交時間新到舊排序（走 idx_transactions_date）。
 * 多查 1 筆（limit+1）讓 route 端能判斷 hasMore，不必額外下 COUNT 查詢。
 *
 * 註記欄位（is_special / has_addition）直接在 SQL 端用 LIKE 判斷，
 * 避免把整欄 notes 原文送到前端（前端只需要布林旗標）。
 */
export function fetchTransactions(where: string, limit: number, offset: number): Promise<Row[]> {
  return cachedQuery(`
    SELECT
      transaction_date::text                                          AS transaction_date,
      district,
      project_name,
      address,
      building_type,
      floor,
      total_floors,
      is_presale,
      ROUND((NULLIF(building_area_sqm,0) * 0.3025)::numeric, 1)      AS area,
      ROUND((unit_price_sqm * 3.3058 / 10000)::numeric, 1)           AS unit_price,
      ROUND(total_price / 10000)::int                                 AS total_price,
      (notes LIKE '%特殊關係%')                                                        AS is_special,
      (notes LIKE '%頂樓加蓋%' OR notes LIKE '%增建%' OR notes LIKE '%陽台外推%')       AS has_addition,
      (transaction_target LIKE '%車位%')                                              AS with_parking
    FROM transactions
    WHERE ${where}
    ORDER BY transaction_date DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `)
}
