import React from 'react';

const ensureKpiStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-kpi-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-kpi-styles';
  el.textContent = `
  .tra-kpi {
    position: relative; overflow: hidden; border-radius: var(--radius-lg);
    border: 1px solid var(--border-card); background: var(--surface-card);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
  }
  .tra-kpi__accent { position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; }
  .tra-kpi__top { display: flex; align-items: center; justify-content: space-between; }
  .tra-kpi__label { font: var(--weight-medium) var(--text-2xs) var(--font-sans); color: var(--text-muted); letter-spacing: var(--tracking-wide); }
  .tra-kpi__icon { font-size: 15px; opacity: .55; }
  .tra-kpi__row { display: flex; align-items: baseline; gap: 6px; }
  .tra-kpi__value { font: var(--weight-bold) var(--text-2xl)/1.05 var(--font-mono); letter-spacing: var(--tracking-tight); font-variant-numeric: tabular-nums; }
  .tra-kpi__unit { font: var(--text-xs) var(--font-sans); color: var(--text-faint); }
  .tra-kpi__delta { font: var(--weight-semibold) var(--text-2xs) var(--font-mono); margin-left: auto; }`;
  document.head.appendChild(el);
};
ensureKpiStyles();

const KPI_TONES = {
  brass: 'var(--brass-500)', clay: 'var(--clay-500)', sky: 'var(--series-3)',
  coral: 'var(--clay-400)', positive: 'var(--positive)',
};

/**
 * KPI stat card — label, big mono value, unit, tinted left accent and an
 * optional delta. The dashboard's top row (成交戶數, 均單價 …).
 */
export function KpiCard({ label, value, unit, icon, tone = 'brass', delta, className = '', style, ...rest }) {
  const color = KPI_TONES[tone] || tone;
  const up = typeof delta === 'string' && delta.trim().startsWith('+');
  return (
    <div className={`tra-kpi ${className}`} style={style} {...rest}>
      <span className="tra-kpi__accent" style={{ background: color }} />
      <div className="tra-kpi__top">
        <span className="tra-kpi__label">{label}</span>
        {icon && <span className="tra-kpi__icon">{icon}</span>}
      </div>
      <div className="tra-kpi__row">
        <span className="tra-kpi__value" style={{ color }}>{value}</span>
        {unit && <span className="tra-kpi__unit">{unit}</span>}
        {delta != null && (
          <span className="tra-kpi__delta" style={{ color: up ? 'var(--positive)' : 'var(--negative)' }}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
