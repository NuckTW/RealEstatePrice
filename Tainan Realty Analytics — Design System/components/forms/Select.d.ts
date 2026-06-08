import { CSSProperties, SelectHTMLAttributes } from 'react';

export type SelectOption = string | { label: string; value: string };

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  /** Optional uppercase micro-label rendered above the control. */
  label?: string;
  options: SelectOption[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Styled native select — the dashboard's filter-bar dropdown (date,
 * 成/預售, 屋齡 …). Pass `label` to stack a micro-label above it.
 */
export function Select(props: SelectProps): JSX.Element;
