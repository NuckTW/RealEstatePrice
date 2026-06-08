import React from 'react';

const ensurePanelStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-panel-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-panel-styles';
  el.textContent = `
  .tra-panel {
    background: var(--surface-card); border: 1px solid var(--border-card);
    border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-card);
  }
  .tra-panel__head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 16px; border-bottom: 1px solid var(--line-soft);
  }
  .tra-panel__title { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .tra-panel__tick { width: 4px; height: 16px; border-radius: var(--radius-full); background: var(--gradient-accent); flex: none; }
  .tra-panel__t { font: var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans); color: var(--text-strong); }
  .tra-panel__body { padding: var(--pad-card); }
  .tra-panel__body--flush { padding: 0; }`;
  document.head.appendChild(el);
};
ensurePanelStyles();

/**
 * Data panel — the rounded card that wraps every table / chart. Header
 * shows a brass tick, a title, an optional count badge and right-aligned
 * controls (`actions`). Set `flush` to remove body padding (tables).
 */
export function Panel({ title, count, actions, flush = false, children, className = '', style, ...rest }) {
  return (
    <div className={`tra-panel ${className}`} style={style} {...rest}>
      {(title || actions) && (
        <div className="tra-panel__head">
          <div className="tra-panel__title">
            <span className="tra-panel__tick" />
            <span className="tra-panel__t">{title}</span>
            {count != null && (
              <span style={{
                font: '10px var(--font-mono)', color: 'var(--text-faint)',
                background: 'var(--surface-control)', padding: '1px 7px', borderRadius: 'var(--radius-full)'
              }}>{count}</span>
            )}
          </div>
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div className={`tra-panel__body ${flush ? 'tra-panel__body--flush' : ''}`}>{children}</div>
    </div>
  );
}
