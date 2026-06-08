import { ReactNode, CSSProperties } from 'react';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Label content. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Brass-fill checkbox used in the filter multi-select menus
 * (行政區 / 類型 / 房型). Controlled — drive with `checked` + `onChange`.
 */
export function Checkbox(props: CheckboxProps): JSX.Element;
