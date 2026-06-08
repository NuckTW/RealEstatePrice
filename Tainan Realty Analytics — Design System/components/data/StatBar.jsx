import React from 'react';

const ensureStatBarStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-statbar-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-statbar-styles';
  el.textContent = `
  .tra-statbar {
    position: relative; display: inline-flex; align-items: center; justify-content: flex-end;
    height: 24px; min-width: 64px; border-radius: var(--radius-sm); overflow: hidden;
  }
  .tra-statbar--left { justify-content: flex-start; }
  .tra-statbar__fill { position: absolute; inset: 0 auto 0 0; border-radius: var(--radius-sm); }
  .tra-statbar__edge { position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: var(--radius-full); }
  .tra-statbar__val {
    position: relative; z-index: 1; padding: 0 8px; white-space: nowrap;
    font: var(--weight-medium) var(--text-xs) var(--font-mono); color: var(--text-default);
    font-variant-numeric: tabular-nums;
  }`;
  document.head.appendChild(el);
};
ensureStatBarStyles();

/**
 * Inline data bar — the signature table cell. A translucent value bar with
 * a bright leading-edge tick and a right-aligned mono figure. `pct` 0–100.
 */
export function StatBar({
  value, pct = 0, color = 'var(--series-1)', align = 'right',
  minWidth = 64, className = '', style, ...rest
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <span
      className={`tra-statbar ${align === 'left' ? 'tra-statbar--left' : ''} ${className}`}
      style={{ minWidth, ...style }}
      {...rest}
    >
      <span className="tra-statbar__fill" style={{ width: `${clamped}%`, background: color, opacity: 'var(--bar-fill-opacity)' }} />
      {clamped > 5 && <span className="tra-statbar__edge" style={{ background: color, opacity: 'var(--bar-edge-opacity)' }} />}
      <span className="tra-statbar__val">{value}</span>
    </span>
  );
}
