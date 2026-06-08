import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

export interface ChatBubbleProps extends HTMLAttributes<HTMLDivElement> {
  /** @default "assistant" */
  role?: 'user' | 'assistant';
  children?: ReactNode;
  /** Generated SQL — adds a collapsible 查看 SQL disclosure. */
  sql?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Message bubble for the Gemini AI Q&A surface. User messages tint brass
 * and align right; assistant messages are the surface card and may carry
 * a generated-SQL disclosure.
 */
export function ChatBubble(props: ChatBubbleProps): JSX.Element;
