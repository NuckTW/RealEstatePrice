import React from 'react';

const ensureTagStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-tag-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-tag-styles';
  el.textContent = `
  .tra-tag {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-sans); font-weight: var(--weight-medium); font-size: var(--text-2xs);
    padding: 4px 10px; border-radius: var(--radius-full);
    background: var(--accent-wash); color: var(--accent-tint);
    border: 1px solid var(--accent-wash-border);
    transition: var(--transition-base); cursor: default;
  }
  .tra-tag--removable { cursor: pointer; }
  .tra-tag--removable:hover {
    background: rgba(229,96,77,.15); color: var(--negative);
    border-color: rgba(229,96,77,.28);
  }
  .tra-tag__x { font-size: 13px; line-height: 1; opacity: .5; transition: opacity var(--dur-fast); }
  .tra-tag--removable:hover .tra-tag__x { opacity: 1; }`;
  document.head.appendChild(el);
};
ensureTagStyles();

/**
 * Active-filter chip. When `onRemove` is provided it becomes removable —
 * the whole chip turns red on hover, mirroring the dashboard's filter tags.
 */
export function Tag({ children, onRemove, className = '', style, ...rest }) {
  const removable = typeof onRemove === 'function';
  return (
    <span
      className={`tra-tag ${removable ? 'tra-tag--removable' : ''} ${className}`}
      style={style}
      onClick={removable ? onRemove : undefined}
      role={removable ? 'button' : undefined}
      {...rest}
    >
      {children}
      {removable && <span className="tra-tag__x">×</span>}
    </span>
  );
}
