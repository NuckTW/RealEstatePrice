import React from 'react';

const ensureTabPillsStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-tabpills-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-tabpills-styles';
  el.textContent = `
  .tra-tabs { display: inline-flex; align-items: center; gap: 6px; }
  .tra-tab {
    display: inline-flex; align-items: center; gap: 6px;
    height: var(--control-h-sm); padding: 0 14px; border-radius: var(--radius-full);
    font: var(--weight-semibold) var(--text-xs) var(--font-sans);
    color: var(--text-muted); background: transparent; border: 1px solid transparent;
    cursor: pointer; transition: var(--transition-base); white-space: nowrap;
  }
  .tra-tab:hover { color: var(--text-default); background: rgba(255,255,255,.04); }
  .tra-tab--active {
    color: var(--accent-tint); background: var(--accent-wash);
    border-color: var(--accent-wash-border);
  }
  .tra-tab--active:hover { color: var(--accent-tint); background: var(--accent-wash); }`;
  document.head.appendChild(el);
};
ensureTabPillsStyles();

/**
 * Segmented pill tabs — the 數據看板 / 地圖 switcher and section nav.
 * `tabs` is an array of { value, label, icon? }; controlled via `value`.
 */
export function TabPills({ tabs = [], value, onChange, className = '', style, ...rest }) {
  return (
    <div className={`tra-tabs ${className}`} style={style} {...rest}>
      {tabs.map((t) => {
        const v = typeof t === 'string' ? t : t.value;
        const label = typeof t === 'string' ? t : t.label;
        const icon = typeof t === 'string' ? null : t.icon;
        const active = v === value;
        return (
          <button
            key={v}
            className={`tra-tab ${active ? 'tra-tab--active' : ''}`}
            onClick={() => onChange && onChange(v)}
          >
            {icon && <span style={{ opacity: 0.8 }}>{icon}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}
