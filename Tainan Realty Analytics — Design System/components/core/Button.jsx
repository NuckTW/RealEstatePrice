import React from 'react';

/* Inject component styles once (runs at bundle load). */
const ensureButtonStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-button-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-button-styles';
  el.textContent = `
  .tra-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font-family: var(--font-sans); font-weight: var(--weight-semibold);
    border-radius: var(--radius-md); border: 1px solid transparent;
    cursor: pointer; white-space: nowrap; user-select: none;
    transition: var(--transition-base);
  }
  .tra-btn:disabled { opacity: .45; cursor: not-allowed; }
  .tra-btn--sm { height: var(--control-h-sm); padding: 0 12px; font-size: var(--text-xs); }
  .tra-btn--md { height: var(--control-h-md); padding: 0 16px; font-size: var(--text-sm); }
  .tra-btn--lg { height: var(--control-h-lg); padding: 0 20px; font-size: var(--text-base); }

  .tra-btn--primary { background: var(--gradient-accent); color: var(--on-accent); box-shadow: var(--glow-accent); }
  .tra-btn--primary:hover:not(:disabled) { filter: brightness(1.07); }
  .tra-btn--primary:active:not(:disabled) { filter: brightness(.95); }

  .tra-btn--secondary { background: var(--surface-control); color: var(--text-default); border-color: var(--border-control); }
  .tra-btn--secondary:hover:not(:disabled) { background: var(--surface-hover); border-color: var(--border-strong); color: var(--text-strong); }

  .tra-btn--ghost { background: rgba(255,255,255,.04); color: var(--text-muted); }
  .tra-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,.08); color: var(--text-strong); }

  .tra-btn--danger { background: rgba(229,96,77,.14); color: var(--negative); border-color: rgba(229,96,77,.28); }
  .tra-btn--danger:hover:not(:disabled) { background: rgba(229,96,77,.22); }

  .tra-btn__spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,.35); border-top-color: currentColor;
    animation: tra-btn-spin .6s linear infinite;
  }
  @keyframes tra-btn-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(el);
};
ensureButtonStyles();

/**
 * Primary action button. Variants: primary (brass gradient), secondary,
 * ghost, danger. Sizes sm | md | lg. Supports loading + leading icon.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  style,
  ...rest
}) {
  return (
    <button
      className={`tra-btn tra-btn--${variant} tra-btn--${size} ${className}`}
      disabled={disabled || loading}
      style={style}
      {...rest}
    >
      {loading && <span className="tra-btn__spinner" />}
      {!loading && icon}
      {children}
    </button>
  );
}
