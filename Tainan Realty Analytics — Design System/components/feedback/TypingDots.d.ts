import { CSSProperties, HTMLAttributes } from 'react';

export interface TypingDotsProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  style?: CSSProperties;
}

/**
 * Three-dot thinking indicator (assistant-bubble styling) shown while the
 * AI answer is loading.
 */
export function TypingDots(props: TypingDotsProps): JSX.Element;
