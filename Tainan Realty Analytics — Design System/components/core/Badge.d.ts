import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  /** Semantic colour. @default "brass" */
  tone?: 'brass' | 'clay' | 'positive' | 'info' | 'warning' | 'negative' | 'neutral';
  /** "count" renders a quiet monospace tally chip. @default "solid" */
  variant?: 'solid' | 'count';
  /** Show a leading status dot. */
  dot?: boolean;
  /** Animate the dot (for "live / 最新" indicators). */
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Status & category pill. In the dashboard: 成屋 (positive), 預售 (info),
 * row counts (variant="count"), and the live-data dot (dot + pulse).
 */
export function Badge(props: BadgeProps): JSX.Element;
