import React from 'react';

const ensureInputStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-input-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-input-styles';
  el.textContent = `
  .tra-input-wrap { display: inline-flex; align-items: center; gap: 8px; position: relative; width: 100%; }
  .tra-input {
    width: 100%; height: var(--control-h-lg);
    background: var(--surface-control); border: 1px solid var(--border-control);
    color: var(--text-strong); border-radius: var(--radius-md);
    padding: 0 14px; font-family: var(--font-sans); font-size: var(--text-base);
    transition: var(--transition-base);
  }
  .tra-input--with-icon { padding-left: 38px; }
  .tra-input::placeholder { color: var(--text-faint); }
  .tra-input:hover { border-color: var(--border-strong); }
  .tra-input:focus { outline: none; border-color: var(--accent); box-shadow: var(--glow-accent-sm); }
  .tra-input--sm { height: var(--control-h-md); font-size: var(--text-sm); }
  .tra-input__icon {
    position: absolute; left: 13px; display: flex; pointer-events: none;
    color: var(--text-muted); font-size: 15px;
  }`;
  document.head.appendChild(el);
};
ensureInputStyles();

/**
 * Text / search input. Optional leading icon node. Used for the AI-chat
 * composer and any search field.
 */
export function TextInput({ icon = null, size = 'lg', className = '', style, wrapStyle, ...rest }) {
  return (
    <span className="tra-input-wrap" style={wrapStyle}>
      {icon && <span className="tra-input__icon">{icon}</span>}
      <input
        className={`tra-input tra-input--${size} ${icon ? 'tra-input--with-icon' : ''} ${className}`}
        style={style}
        {...rest}
      />
    </span>
  );
}
