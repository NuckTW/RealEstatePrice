import React from 'react';

const ensureSelectStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-select-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-select-styles';
  el.textContent = `
  .tra-field { display: inline-flex; flex-direction: column; gap: 5px; min-width: 0; }
  .tra-field__label {
    font: var(--type-label); text-transform: uppercase;
    letter-spacing: var(--tracking-caps); color: var(--text-faint);
  }
  .tra-select {
    appearance: none; -webkit-appearance: none;
    background-color: var(--surface-control);
    border: 1px solid var(--border-control); color: var(--text-default);
    border-radius: var(--radius-md); height: var(--control-h-sm);
    padding: 0 28px 0 10px; font-family: var(--font-sans); font-size: var(--text-xs);
    cursor: pointer; transition: var(--transition-base);
    background-repeat: no-repeat; background-position: right 9px center;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a9a93' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
  .tra-select:hover { border-color: var(--border-strong); }
  .tra-select:focus { outline: none; border-color: var(--accent); box-shadow: var(--glow-accent-sm); }
  .tra-select option { background: var(--surface-overlay); color: var(--text-default); }`;
  document.head.appendChild(el);
};
ensureSelectStyles();

/**
 * Styled native <select> with the dashboard's custom chevron and an
 * optional micro-label above it. Used throughout the filter bar.
 */
export function Select({ label, options = [], value, onChange, className = '', style, ...rest }) {
  const sel = (
    <select
      className={`tra-select ${className}`}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      style={label ? undefined : style}
      {...rest}
    >
      {options.map((o) =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
  if (!label) return sel;
  return (
    <label className="tra-field" style={style}>
      <span className="tra-field__label">{label}</span>
      {sel}
    </label>
  );
}
