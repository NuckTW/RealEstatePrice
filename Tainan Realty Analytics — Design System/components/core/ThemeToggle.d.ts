import { ReactNode, CSSProperties, HTMLAttributes } from 'react';

export type ThemeName = 'light' | 'dark';

/**
 * @startingPoint section="Core" subtitle="Light / dark theme switch" viewport="700x120"
 */
export interface ThemeToggleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled theme. Omit to let the toggle manage <html> + localStorage itself. */
  value?: ThemeName;
  onChange?: (theme: ThemeName) => void;
  /** Show the 明亮 / 暗色 text labels beside the icons. @default true */
  labels?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Read the persisted theme ("dark" default). */
export function getStoredTheme(): ThemeName;
/** Apply a theme to <html data-theme> and persist to localStorage. */
export function applyTheme(theme: ThemeName): void;

/**
 * Segmented 明亮 / 暗色 (light / dark) switch for the dashboard chrome.
 * Uncontrolled by default: it sets `data-theme` on <html> and persists
 * the choice, so the whole token system flips. Drive it with
 * `value` + `onChange` for app-level control.
 *
 * @startingPoint section="Core" subtitle="Light / dark theme switch" viewport="700x120"
 */
export function ThemeToggle(props: ThemeToggleProps): JSX.Element;
