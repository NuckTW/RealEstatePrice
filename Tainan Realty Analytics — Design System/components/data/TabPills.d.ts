import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

export type TabItem = string | { value: string; label: ReactNode; icon?: ReactNode };

export interface TabPillsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: TabItem[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Segmented pill tabs — the 數據看板 / 地圖 view switcher and analytics
 * section nav. Active pill takes the brass wash.
 */
export function TabPills(props: TabPillsProps): JSX.Element;
