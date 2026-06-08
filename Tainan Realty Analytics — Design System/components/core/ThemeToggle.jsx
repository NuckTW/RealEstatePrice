import React from 'react';

const ensureThemeToggleStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-themetoggle-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-themetoggle-styles';
  el.textContent = `
  .tra-themetoggle {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 3px; border-radius: var(--radius-full);
    background: var(--surface-control); border: 1px solid var(--border-control);
  }
  .tra-themetoggle__opt {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    height: 24px; padding: 0 9px; border: none; cursor: pointer;
    border-radius: var(--radius-full); background: transparent;
    color: var(--text-muted); font: var(--weight-semibold) var(--text-2xs) var(--font-sans);
    transition: var(--transition-base);
  }
  .tra-themetoggle__opt:hover { color: var(--text-default); }
  .tra-themetoggle__opt--active {
    background: var(--accent-wash); color: var(--accent-tint);
    box-shadow: inset 0 0 0 1px var(--accent-wash-border);
  }
  .tra-themetoggle__opt--active:hover { color: var(--accent-tint); }
  .tra-themetoggle__ico { font-size: 12px; line-height: 1; }`;
  document.head.appendChild(el);
};
ensureThemeToggleStyles();

const STORAGE_KEY = 'tra-theme';

/** Read the persisted theme (defaults to "dark"). */
export function getStoredTheme() {
  if (typeof localStorage === 'undefined') return 'dark';
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

/** Apply a theme to <html> and persist it. */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
}

/**
 * Segmented light / dark switch. Uncontrolled by default — it reads and
 * writes the persisted theme on <html> itself. Pass `value` + `onChange`
 * to drive it from parent state instead.
 */
export function ThemeToggle({ value, onChange, labels = true, className = '', style, ...rest }) {
  const [internal, setInternal] = React.useState(() => value || getStoredTheme());
  const theme = value != null ? value : internal;

  React.useEffect(() => {
    if (value == null) applyTheme(internal);
  }, [internal, value]);

  const pick = (next) => {
    if (next === theme) return;
    if (onChange) onChange(next);
    if (value == null) setInternal(next);
  };

  const Opt = ({ id, icon, label }) => (
    <button
      type="button"
      className={`tra-themetoggle__opt ${theme === id ? 'tra-themetoggle__opt--active' : ''}`}
      onClick={() => pick(id)}
      aria-pressed={theme === id}
      title={`${label} 模式`}
    >
      <span className="tra-themetoggle__ico">{icon}</span>
      {labels && <span>{label}</span>}
    </button>
  );

  return (
    <div className={`tra-themetoggle ${className}`} style={style} role="group" aria-label="主題切換" {...rest}>
      <Opt id="light" icon="☀" label="明亮" />
      <Opt id="dark" icon="☾" label="暗色" />
    </div>
  );
}

/* Expose the helpers as statics so they're reachable from the bundle
   namespace (bare lowercase exports aren't surfaced on window). */
ThemeToggle.applyTheme = applyTheme;
ThemeToggle.getStoredTheme = getStoredTheme;
