import type { ColDef } from '@/components/DataTable'

/* 統計表欄位（原本在 Dashboard.tsx，改版後市場頁「概況」使用）。Brass & Clay 系列色 */
const S1 = '#d9912a', S2 = '#c0613d', S3 = '#4ca8e0', S6 = '#2bb3a3', S8 = '#cda86a'
const NEG = '#e0573f', INFO = '#4ca8e0'

export const DIST_COLS: ColDef[] = [
  { key: 'district',   label: '行政區',      align: 'left' },
  { key: 'count',      label: '戶數',        barColor: S1,  minWidth: 72 },
  { key: 'unit_price', label: '均單價(萬/坪)', barColor: S3,  minWidth: 72 },
  { key: 'area',       label: '均坪數',      barColor: S6,  minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: S2,  minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: S8,  minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: INFO, format: v => `${v}%`, minWidth: 52 },
]

export const TYPE_COLS: ColDef[] = [
  { key: 'type',  label: '類型', align: 'left',
    format: v => {
      const s = String(v ?? '')
      if (s.startsWith('住宅大樓')) return '住宅大樓'
      if (s.startsWith('透天厝'))  return '透天厝'
      if (s.startsWith('公寓'))    return '公寓'
      if (s.startsWith('華廈'))    return '華廈'
      if (s.startsWith('套房'))    return '套房'
      if (s.startsWith('辦公'))    return '辦公商業'
      return s.slice(0, 10)
    },
  },
  { key: 'count',      label: '戶數',        barColor: S1, minWidth: 72 },
  { key: 'unit_price', label: '均單價(萬/坪)', barColor: S3, minWidth: 72 },
  { key: 'area',       label: '均坪數',      barColor: S6, minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: S2, minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: S8, minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: INFO, format: v => `${v}%`, minWidth: 52 },
]

export const ROOMS_COLS: ColDef[] = [
  { key: 'rooms',      label: '房型',        align: 'left', format: v => v === 0 || v === '0' ? '0房' : `${v}房` },
  { key: 'count',      label: '戶數',        barColor: S1,  minWidth: 72 },
  { key: 'unit_price', label: '均單價(萬/坪)', barColor: S3,  minWidth: 72 },
  { key: 'area',       label: '均坪數',      barColor: S6,  minWidth: 64 },
  { key: 'avg_total',  label: '均總價(萬)',  barColor: S2,  minWidth: 80 },
  { key: 'sales',      label: '總銷(億)',    barColor: S8,  minWidth: 64 },
  { key: 'pct',        label: '佔比',        barColor: INFO, format: v => `${v}%`, minWidth: 52 },
  { key: 'min_price',  label: '最低(萬)',    barColor: S3,  minWidth: 72 },
  { key: 'max_price',  label: '最高(萬)',    barColor: NEG, minWidth: 72 },
]
