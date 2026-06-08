import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

export interface StatBarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Formatted figure shown over the bar. */
  value: ReactNode;
  /** Fill width 0–100 (typically value / column-max × 100). */
  pct?: number;
  /** Bar colour — usually a --series-* token. @default series-1 */
  color?: string;
  /** @default "right" */
  align?: 'left' | 'right';
  minWidth?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The signature inline data bar used in every dashboard table cell —
 * translucent fill + leading-edge tick + right-aligned mono value.
 */
export function StatBar(props: StatBarProps): JSX.Element;
