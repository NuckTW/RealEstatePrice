import { ReactNode, CSSProperties, ButtonHTMLAttributes } from 'react';

/**
 * @startingPoint section="Core" subtitle="Brass gradient action button" viewport="700x260"
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Show a spinner and disable interaction. */
  loading?: boolean;
  disabled?: boolean;
  /** Leading icon node (hidden while loading). */
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * The primary action control for the Tainan Realty dashboard.
 * `primary` is the brass gradient with glow (e.g. 套用篩選); `secondary`
 * and `ghost` are the quiet surface actions; `danger` for destructive.
 *
 * @startingPoint section="Core" subtitle="Brass gradient action button" viewport="700x260"
 */
export function Button(props: ButtonProps): JSX.Element;
