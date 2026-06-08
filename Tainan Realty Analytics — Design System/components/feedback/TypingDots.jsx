import React from 'react';

const ensureTypingStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-typing-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-typing-styles';
  el.textContent = `
  .tra-typing {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 13px 16px; background: var(--surface-card);
    border: 1px solid var(--border-card); border-radius: var(--radius-lg);
    border-bottom-left-radius: var(--radius-sm);
  }
  .tra-typing span {
    width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);
    animation: tra-typing-bounce 1.1s var(--ease-standard) infinite;
  }
  .tra-typing span:nth-child(2) { animation-delay: .15s; }
  .tra-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes tra-typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: .45; }
    30% { transform: translateY(-4px); opacity: 1; }
  }`;
  document.head.appendChild(el);
};
ensureTypingStyles();

/**
 * Three-dot "assistant is thinking" indicator, styled as an assistant
 * bubble. Render while awaiting an AI answer.
 */
export function TypingDots({ className = '', style, ...rest }) {
  return (
    <div className={`tra-typing ${className}`} style={style} {...rest}>
      <span /><span /><span />
    </div>
  );
}
