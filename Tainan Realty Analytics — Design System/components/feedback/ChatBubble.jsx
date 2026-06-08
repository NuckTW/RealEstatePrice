import React from 'react';

const ensureChatBubbleStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-chatbubble-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-chatbubble-styles';
  el.textContent = `
  .tra-bubble-row { display: flex; }
  .tra-bubble-row--user { justify-content: flex-end; }
  .tra-bubble {
    max-width: 80%; padding: 11px 15px; font-family: var(--font-sans);
    font-size: var(--text-sm); line-height: var(--leading-normal);
    border-radius: var(--radius-lg);
  }
  .tra-bubble--assistant {
    background: var(--surface-card); border: 1px solid var(--border-card);
    color: var(--text-default); border-bottom-left-radius: var(--radius-sm);
  }
  .tra-bubble--user {
    background: var(--accent-wash); border: 1px solid var(--accent-wash-border);
    color: var(--accent-tint); border-bottom-right-radius: var(--radius-sm);
  }
  .tra-bubble__text { white-space: pre-wrap; }
  .tra-bubble__sql-toggle {
    margin-top: 8px; font: var(--weight-medium) var(--text-xs) var(--font-sans);
    color: var(--accent-tint); background: none; border: none; cursor: pointer; padding: 0;
  }
  .tra-bubble__sql-toggle:hover { color: var(--accent-hover); }
  .tra-bubble__sql {
    margin-top: 8px; padding: 10px 12px; border-radius: var(--radius-md);
    background: var(--ink-950); border: 1px solid rgba(255,255,255,0.08);
    font: var(--text-xs) var(--font-mono); color: var(--brass-300);
    overflow-x: auto; white-space: pre;
  }`;
  document.head.appendChild(el);
};
ensureChatBubbleStyles();

/**
 * AI-chat message bubble. `role` "user" tints brass and right-aligns;
 * "assistant" is the surface card. Optional `sql` adds a 查看 SQL
 * disclosure that reveals a monospace query block.
 */
export function ChatBubble({ role = 'assistant', children, sql, className = '', style, ...rest }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`tra-bubble-row tra-bubble-row--${role}`} style={style} {...rest}>
      <div className={`tra-bubble tra-bubble--${role} ${className}`}>
        <div className="tra-bubble__text">{children}</div>
        {sql && (
          <>
            <button className="tra-bubble__sql-toggle" onClick={() => setOpen(!open)}>
              {open ? '▲ 收起 SQL' : '▼ 查看 SQL'}
            </button>
            {open && <pre className="tra-bubble__sql">{sql}</pre>}
          </>
        )}
      </div>
    </div>
  );
}
