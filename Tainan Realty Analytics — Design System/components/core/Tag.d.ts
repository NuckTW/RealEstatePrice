import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

export interface TagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  children?: ReactNode;
  /** When set, the chip is removable and turns red on hover. */
  onRemove?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Active-filter chip used above the data tables. Provide `onRemove` to
 * make it deletable (district / type / room filters click-to-clear).
 */
export function Tag(props: TagProps): JSX.Element;
