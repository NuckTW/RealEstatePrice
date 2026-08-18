import { cachedQuery, type Row } from './client'

/**
 * 建案比較：一次取回全市建案的中位量價，供選單與定位圖共用。
 *
 * 用中位數而非平均：不動產價格分布右偏，少數高總價戶會把平均拉高。
 * 以 lower(btrim(project_name)) 分組：來源資料存在同案異寫
 * （例如「幸福時光NO.5」與「幸福時光No.5」），不合併會把同一案的統計拆成兩半。
 *
 * where 由共用的 buildWhere 產生，確保建物型態／房型／預售的篩選邏輯
 * 與 /api/charts、/api/map 完全一致。篩選是套用在「交易層」而非「建案層」：
 * 選了 3 房，各案的中位單價就是該案 3 房交易的中位數，這才是建商要比的東西。
 */
export function fetchProjectStats(where: string): Promise<Row[]> {
  return cachedQuery(`
    SELECT lower(btrim(project_name))                       AS key,
           min(project_name)                                AS name,
           mode() WITHIN GROUP (ORDER BY district)          AS district,
           mode() WITHIN GROUP (ORDER BY building_type)     AS building_type,
           count(*)                                         AS tx_count,
           count(*) FILTER (WHERE is_presale)               AS tx_presale,
           round(percentile_cont(0.5) WITHIN GROUP (
             ORDER BY unit_price_sqm * 3.3058 / 10000)::numeric, 1)  AS price_median,
           round(percentile_cont(0.25) WITHIN GROUP (
             ORDER BY unit_price_sqm * 3.3058 / 10000)::numeric, 1)  AS price_p25,
           round(percentile_cont(0.75) WITHIN GROUP (
             ORDER BY unit_price_sqm * 3.3058 / 10000)::numeric, 1)  AS price_p75,
           round(percentile_cont(0.5) WITHIN GROUP (
             ORDER BY building_area_sqm / 3.3058)::numeric, 1)       AS area_median,
           round(percentile_cont(0.5) WITHIN GROUP (
             ORDER BY total_price / 10000.0)::numeric, 0)            AS total_median,
           mode() WITHIN GROUP (ORDER BY rooms)             AS rooms_mode,
           to_char(min(transaction_date), 'YYYY-MM')        AS first_tx,
           to_char(max(transaction_date), 'YYYY-MM')        AS last_tx
    FROM transactions
    WHERE ${where}
      AND project_name IS NOT NULL AND btrim(project_name) <> ''
    GROUP BY 1
  `)
}
