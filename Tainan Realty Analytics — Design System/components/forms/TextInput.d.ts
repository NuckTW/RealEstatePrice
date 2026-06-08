import { ReactNode, CSSProperties, InputHTMLAttributes } from 'react';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Leading icon node. */
  icon?: ReactNode;
  /** @default "lg" */
  size?: 'sm' | 'lg';
  className?: string;
  style?: CSSProperties;
  /** Style applied to the wrapping span (for width control). */
  wrapStyle?: CSSProperties;
}

/**
 * Single-line text / search input. The AI-chat composer and search
 * fields use this; pass `icon` for a leading glyph.
 */
export function TextInput(props: TextInputProps): JSX.Element;
