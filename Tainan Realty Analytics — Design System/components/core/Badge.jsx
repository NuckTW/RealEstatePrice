import React from 'react';

const ensureBadgeStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-badge-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-badge-styles';
  el.textContent = `
  .tra-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-sans); font-weight: var(--weight-semibold);
    font-size: var(--text-2xs); line-height: 1; white-space: nowrap;
    padding: 3px 9px; border-radius: var(--radius-full); border: 1px solid transparent;
  }
  .tra-badge--count { font-family: var(--font-mono); font-size: var(--text-3xs); padding: 2px 7px;
    background: var(--surface-control); color: var(--text-faint); }
  .tra-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .tra-badge__dot--pulse { animation: tra-badge-pulse 1.8s var(--ease-standard) infinite; }
  @keyframes tra-badge-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }`;
  document.head.appendChild(el);
};
ensureBadgeStyles();

const TONES = {
  brass:    ['rgba(217,145,42,.16)',  'var(--accent-tint)', 'rgba(217,145,42,.30)'],
  clay:     ['rgba(192,97,61,.18)',   'var(--clay-400)',    'rgba(192,97,61,.32)'],
  positive: ['rgba(43,179,163,.16)',  'var(--positive)',    'rgba(43,179,163,.30)'],
  info:     ['rgba(76,168,224,.16)',  'var(--info)',        'rgba(76,168,224,.30)'],
  warning:  ['rgba(232,162,59,.16)',  'var(--warning)',     'rgba(232,162,59,.30)'],
  negative: ['rgba(224,87,63,.16)',   'var(--negative)',    'rgba(224,87,63,.30)'],
  neutral:  ['rgba(125,116,100,.14)', 'var(--text-muted)',  'rgba(125,116,100,.22)'],
};

/**
 * Small status / category pill. Use `tone` for semantic colour
 * (成屋=positive, 預售=info …) or variant="count" for a numeric tally.
 */
export function Badge({
  children,
  tone = 'brass',
  variant = 'solid',
  dot = false,
  pulse = false,
  className = '',
  style,
  ...rest
}) {
  if (variant === 'count') {
    return (
      <span className={`tra-badge tra-badge--count ${className}`} style={style} {...rest}>
        {children}
      </span>
    );
  }
  const [bg, fg, bd] = TONES[tone] || TONES.brass;
  return (
    <span
      className={`tra-badge ${className}`}
      style={{ background: bg, color: fg, borderColor: bd, ...style }}
      {...rest}
    >
      {dot && <span className={`tra-badge__dot ${pulse ? 'tra-badge__dot--pulse' : ''}`} />}
      {children}
    </span>
  );
}
