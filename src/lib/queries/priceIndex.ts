/**
 * 住宅價格指數查詢（/api/price-index）
 * 資料表 housing_price_index 由 scripts/import_housing_price_index.py 匯入
 * 基期：110年1月 = 100
 */
import { escapeSqlString } from '@/lib/filters'
import { cachedQuery, type Row } from './client'

/** 可選數列清單（依 CSV 欄位順序：全市、大廈、透天厝、各行政區） */
export function fetchIndexSeriesNames(): Promise<Row[]> {
  return cachedQuery(`
    SELECT series FROM housing_price_index
    GROUP BY series ORDER BY MIN(id)
  `)
}

/** 指數序列（含月增率/年增率，於 PostgreSQL 以窗函數計算） */
export function fetchIndexSeries(seriesNames: string[]): Promise<Row[]> {
  const list = seriesNames.map(s => `'${escapeSqlString(s)}'`).join(',')
  return cachedQuery(`
    SELECT
      ym,
      series,
      index_value::float AS value,
      ROUND(((index_value / NULLIF(LAG(index_value, 1)  OVER w, 0)) - 1) * 100, 2)::float AS mom,
      ROUND(((index_value / NULLIF(LAG(index_value, 12) OVER w, 0)) - 1) * 100, 2)::float AS yoy
    FROM housing_price_index
    WHERE series IN (${list})
    WINDOW w AS (PARTITION BY series ORDER BY ym_date)
    ORDER BY ym_date, series
  `)
}
