import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

/**
 * @startingPoint section="Data" subtitle="Titled data panel / card" viewport="700x260"
 */
export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Header title (with brass tick). Omit for a chrome-less card. */
  title?: ReactNode;
  /** Optional count chip beside the title. */
  count?: number | string;
  /** Right-aligned header controls (pager, toggle, menu). */
  actions?: ReactNode;
  /** Remove body padding — for flush tables. */
  flush?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * The rounded data card wrapping every table and chart in the dashboard
 * (行政區排行, 類型統計 …). Composes with DataTable-style content.
 *
 * @startingPoint section="Data" subtitle="Titled data panel / card" viewport="700x260"
 */
export function Panel(props: PanelProps): JSX.Element;
