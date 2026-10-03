'use client'

import { useMemo, useState } from 'react'

export interface RentRow {
  district: string
  btype: '大樓華廈' | '透天'
  nRent: number
  rentPing: number | null    // 每坪月租中位數（元）
  nSale: number
  pricePing: number | null   // 每坪成交單價中位數（元）
}

export interface MortgageAssumption {
  ratePct: number   // 房貸年利率（%）
  ltv: number       // 貸款成數（0–1）
  years: number     // 貸款年限
}

/** 預設：一般首購房貸利率約 2.2%（⚠️ 依當期市場調整）、8 成、30 年 */
export const DEFAULT_ASSUMPTION: MortgageAssumption = { ratePct: 2.2, ltv: 0.8, years: 30 }

/** 樣本數門檻：租金或成交任一低於此數 → 不計算比值 */
export const MIN_SAMPLES = 20

/** 本息平均攤還的每月付款（每坪） */
export function monthlyPaymentPerPing(pricePing: number, a: MortgageAssumption): number {
  const r = a.ratePct / 100 / 12
  const n = a.years * 12
  const principal = pricePing * a.ltv
  return r === 0 ? principal / n : principal * r / (1 - Math.pow(1 + r, -n))
}

export function rentRatio(row: RentRow, a: MortgageAssumption): number | null {
  if (row.rentPing == null || row.pricePing == null) return null
  if (row.nRent < MIN_SAMPLES || row.nSale < MIN_SAMPLES) return null
  return row.rentPing / monthlyPaymentPerPing(row.pricePing, a)
}

const fmt = (v: number | null, d = 0) =>
  v == null ? '—' : v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d })

/** 30 坪為示意單位：讓「每坪」數字換成直覺的月付金額 */
const DEMO_PING = 30

interface Props {
  rows: RentRow[]
  rentPeriod: string | null
  salePeriod: string | null
  assumption: MortgageAssumption
  onAssumptionChange: (a: MortgageAssumption) => void
  /** 行政區篩選時高亮該區 */
  highlightDistrict?: string
}

export default function RentMortgageTable({ rows, rentPeriod, salePeriod, assumption, onAssumptionChange, highlightDistrict }: Props) {
  const [btype, setBtype] = useState<'大樓華廈' | '透天'>('大樓華廈')

  const view = useMemo(() => rows
    .filter(r => r.btype === btype)
    .map(r => ({ ...r, ratio: rentRatio(r, assumption), pay: r.pricePing != null ? monthlyPaymentPerPing(r.pricePing, assumption) : null }))
    // 有比值的排前面（高 → 低），樣本不足的依成交量排後面
    .sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || b.nSale - a.nSale), [rows, btype, assumption])

  const valid = view.filter(r => r.ratio != null)
  const insufficient = view.filter(r => r.ratio == null)
  const maxRatio = Math.max(1.2, ...valid.map(r => r.ratio!))

  const th: React.CSSProperties = { padding: '6px 8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-2xs)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-card)' }
  const td: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }
  const inputStyle: React.CSSProperties = {
    width: 64, height: 'var(--control-h-sm)', padding: '0 6px', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-control)', color: 'var(--text-default)', border: '1px solid var(--border-control)',
    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', textAlign: 'right',
  }

  return (
    <div>
      {/* 假設條件 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        <div role="tablist" style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)', border: '1px solid var(--border-control)' }}>
          {(['大樓華廈', '透天'] as const).map(b => (
            <button key={b} role="tab" aria-selected={btype === b} onClick={() => setBtype(b)} style={{
              height: 'var(--control-h-sm)', padding: '0 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', fontFamily: 'var(--font-sans)',
              background: btype === b ? 'var(--accent)' : 'transparent', color: btype === b ? 'var(--on-accent)' : 'var(--text-muted)',
            }}>{b}</button>
          ))}
        </div>
        <label>利率 <NumField value={assumption.ratePct} max={20} onCommit={v => onAssumptionChange({ ...assumption, ratePct: v })} style={inputStyle} /> %</label>
        <label>成數 <NumField value={Math.round(assumption.ltv * 100)} max={100} onCommit={v => onAssumptionChange({ ...assumption, ltv: v / 100 })} style={inputStyle} /> %</label>
        <label>年限 <NumField value={assumption.years} min={1} max={40} onCommit={v => onAssumptionChange({ ...assumption, years: v })} style={inputStyle} /> 年</label>
        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-faint)' }}>本息平均攤還；自備款不計入月付</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)', color: 'var(--text-default)' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>行政區</th>
              <th style={{ ...th, textAlign: 'left', minWidth: 180 }}>租金／房貸月付比</th>
              <th style={th}>{DEMO_PING} 坪月租</th>
              <th style={th}>{DEMO_PING} 坪房貸月付</th>
              <th style={th}>每坪月租</th>
              <th style={th}>每坪單價（萬）</th>
              <th style={th}>毛租金報酬率</th>
              <th style={th}>樣本（租／售）</th>
            </tr>
          </thead>
          <tbody>
            {valid.map(r => {
              const pct = (r.ratio! / maxRatio) * 100
              const onePct = (1 / maxRatio) * 100
              return (
                <tr key={r.district} style={{ borderBottom: '1px solid var(--border-card)', background: r.district === highlightDistrict ? 'var(--accent-wash)' : undefined }}>
                  <td style={{ ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }}>{r.district}</td>
                  <td style={{ ...td, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1, height: 8, borderRadius: 'var(--radius-full)', background: 'var(--surface-control)' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
                        {/* 1.0 參考線：租金 = 房貸月付 */}
                        <div title="比值 1：月租 = 房貸月付" style={{ position: 'absolute', left: `${onePct}%`, top: -3, bottom: -3, width: 1, background: 'var(--text-muted)' }} />
                      </div>
                      <span style={{ width: 36, color: 'var(--text-strong)', fontWeight: 600 }}>{fmt(r.ratio, 2)}</span>
                    </div>
                  </td>
                  <td style={td}>{fmt(r.rentPing! * DEMO_PING)}</td>
                  <td style={td}>{fmt(r.pay! * DEMO_PING)}</td>
                  <td style={td}>{fmt(r.rentPing)}</td>
                  <td style={td}>{fmt(r.pricePing! / 10000, 1)}</td>
                  <td style={td}>{fmt(r.rentPing! * 12 / r.pricePing! * 100, 2)}%</td>
                  <td style={{ ...td, color: 'var(--text-faint)' }}>{r.nRent}／{r.nSale}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {insufficient.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-faint)', lineHeight: 1.7 }}>
          樣本不足（租或售少於 {MIN_SAMPLES} 筆）：{insufficient.map(r => `${r.district}（${r.nRent}／${r.nSale}）`).join('、')}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        比值越接近或超過 1，代表月租已接近房貸月付，「租轉買」動機越強。
        租金：{rentPeriod ?? '—'} 一般市場整戶出租（排除社會住宅包租代管、含車位案件）；
        房價：{salePeriod ?? '—'} 成屋成交（排除預售、特殊關係交易）；皆取每坪中位數。
      </div>
    </div>
  )
}

/**
 * 數字輸入框：輸入中保留原字串（如「1.」），解析成功且在範圍內才回傳上層，
 * 避免受控 number input 在輸入小數點時被即時改寫
 */
function NumField({ value, min = 0, max, onCommit, style }: {
  value: number; min?: number; max: number; onCommit: (v: number) => void; style: React.CSSProperties
}) {
  const [text, setText] = useState(String(value))
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={e => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onCommit(n)
      }}
      onBlur={() => setText(String(value))}   // 離開時還原成目前生效的值
      style={style}
    />
  )
}
