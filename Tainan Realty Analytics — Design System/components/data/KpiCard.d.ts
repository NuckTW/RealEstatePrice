import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

/**
 * @startingPoint section="Data" subtitle="KPI stat card" viewport="700x140"
 */
export interface KpiCardProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  /** Pre-formatted value (string keeps thousands separators / mono alignment). */
  value: ReactNode;
  unit?: ReactNode;
  icon?: ReactNode;
  /** Accent tone. @default "brass" */
  tone?: 'brass' | 'clay' | 'sky' | 'coral' | 'positive' | string;
  /** Signed delta string, e.g. "+4.2%" (green) or "-1.8%" (red). */
  delta?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Top-row KPI stat card — 成交戶數, 均單價, 均坪數, 均總價, 總銷售額.
 * Big mono value with a tinted accent rail and optional delta.
 *
 * @startingPoint section="Data" subtitle="KPI stat card" viewport="700x140"
 */
export function KpiCard(props: KpiCardProps): JSX.Element;
