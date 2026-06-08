import React from 'react';

const ensureCheckboxStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-checkbox-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-checkbox-styles';
  el.textContent = `
  .tra-check {
    display: inline-flex; align-items: center; gap: 9px; cursor: pointer;
    font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-default);
    padding: 6px 10px; border-radius: var(--radius-md); transition: var(--transition-base);
    user-select: none;
  }
  .tra-check:hover { background: rgba(255,255,255,.05); }
  .tra-check__box {
    width: 16px; height: 16px; flex: none; border-radius: 5px;
    border: 1.5px solid var(--border-strong); background: var(--surface-control);
    display: flex; align-items: center; justify-content: center;
    transition: var(--transition-base);
  }
  .tra-check__box svg { width: 10px; height: 10px; opacity: 0; transform: scale(.6); transition: var(--transition-base); }
  .tra-check--on .tra-check__box {
    background: var(--accent); border-color: var(--accent); box-shadow: var(--glow-accent-sm);
  }
  .tra-check--on .tra-check__box svg { opacity: 1; transform: scale(1); }`;
  document.head.appendChild(el);
};
ensureCheckboxStyles();

/**
 * Checkbox with brass fill + check glyph. Used in the multi-select filter
 * menus (districts / types / rooms). Controlled via `checked` + `onChange`.
 */
export function Checkbox({ checked = false, onChange, children, className = '', style, ...rest }) {
  return (
    <label className={`tra-check ${checked ? 'tra-check--on' : ''} ${className}`} style={style} {...rest}>
      <span className="tra-check__box">
        <svg viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2L5 8.7L9.5 3.5" stroke="#241606" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange && onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      {children}
    </label>
  );
}
