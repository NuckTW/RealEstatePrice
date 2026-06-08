/* @ds-bundle: {"format":3,"namespace":"TainanRealtyAnalyticsDesignSystem_e1be47","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"ThemeToggle","sourcePath":"components/core/ThemeToggle.jsx"},{"name":"KpiCard","sourcePath":"components/data/KpiCard.jsx"},{"name":"Panel","sourcePath":"components/data/Panel.jsx"},{"name":"StatBar","sourcePath":"components/data/StatBar.jsx"},{"name":"TabPills","sourcePath":"components/data/TabPills.jsx"},{"name":"ChatBubble","sourcePath":"components/feedback/ChatBubble.jsx"},{"name":"TypingDots","sourcePath":"components/feedback/TypingDots.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"TextInput","sourcePath":"components/forms/TextInput.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"11f748aafbff","components/core/Button.jsx":"f2a2e3e4e7af","components/core/Tag.jsx":"7faed43b2838","components/core/ThemeToggle.jsx":"753d35f777c6","components/data/KpiCard.jsx":"0deffd65912e","components/data/Panel.jsx":"daa389fa6677","components/data/StatBar.jsx":"77e80c5b173c","components/data/TabPills.jsx":"91b944bf999b","components/feedback/ChatBubble.jsx":"e58af198c5cc","components/feedback/TypingDots.jsx":"ca28cdf3c5f0","components/forms/Checkbox.jsx":"173009d37903","components/forms/Select.jsx":"78b0c31ae7d5","components/forms/TextInput.jsx":"40a8a242cd16","ui_kits/dashboard/AnalyticsScreen.jsx":"8a406ac97e43","ui_kits/dashboard/ChatScreen.jsx":"fce9dce1f5b9","ui_kits/dashboard/DashboardScreen.jsx":"dd97571e9d4a","ui_kits/dashboard/FilterBar.jsx":"1a6d842bde10","ui_kits/dashboard/Navbar.jsx":"a3dc1c6ae804","ui_kits/dashboard/charts.jsx":"dfe159ea8ea4","ui_kits/dashboard/data.js":"df3915c9b0fc"},"inlinedExternals":[],"unexposedExports":[{"name":"applyTheme","sourcePath":"components/core/ThemeToggle.jsx"},{"name":"getStoredTheme","sourcePath":"components/core/ThemeToggle.jsx"}]} */

(() => {

const __ds_ns = (window.TainanRealtyAnalyticsDesignSystem_e1be47 = window.TainanRealtyAnalyticsDesignSystem_e1be47 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureBadgeStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-badge-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-badge-styles';
  el.textContent = `
  .tra-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-family: var(--font-sans); font-weight: var(--weight-semibold);
    font-size: var(--text-2xs); line-height: 1; white-space: nowrap;
    padding: 3px 9px; border-radius: var(--radius-full); border: 1px solid transparent;
  }
  .tra-badge--count { font-family: var(--font-mono); font-size: var(--text-3xs); padding: 2px 7px;
    background: var(--surface-control); color: var(--text-faint); }
  .tra-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .tra-badge__dot--pulse { animation: tra-badge-pulse 1.8s var(--ease-standard) infinite; }
  @keyframes tra-badge-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }`;
  document.head.appendChild(el);
};
ensureBadgeStyles();
const TONES = {
  brass: ['rgba(217,145,42,.16)', 'var(--accent-tint)', 'rgba(217,145,42,.30)'],
  clay: ['rgba(192,97,61,.18)', 'var(--clay-400)', 'rgba(192,97,61,.32)'],
  positive: ['rgba(43,179,163,.16)', 'var(--positive)', 'rgba(43,179,163,.30)'],
  info: ['rgba(76,168,224,.16)', 'var(--info)', 'rgba(76,168,224,.30)'],
  warning: ['rgba(232,162,59,.16)', 'var(--warning)', 'rgba(232,162,59,.30)'],
  negative: ['rgba(224,87,63,.16)', 'var(--negative)', 'rgba(224,87,63,.30)'],
  neutral: ['rgba(125,116,100,.14)', 'var(--text-muted)', 'rgba(125,116,100,.22)']
};

/**
 * Small status / category pill. Use `tone` for semantic colour
 * (成屋=positive, 預售=info …) or variant="count" for a numeric tally.
 */
function Badge({
  children,
  tone = 'brass',
  variant = 'solid',
  dot = false,
  pulse = false,
  className = '',
  style,
  ...rest
}) {
  if (variant === 'count') {
    return /*#__PURE__*/React.createElement("span", _extends({
      className: `tra-badge tra-badge--count ${className}`,
      style: style
    }, rest), children);
  }
  const [bg, fg, bd] = TONES[tone] || TONES.brass;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tra-badge ${className}`,
    style: {
      background: bg,
      color: fg,
      borderColor: bd,
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: `tra-badge__dot ${pulse ? 'tra-badge__dot--pulse' : ''}`
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Inject component styles once (runs at bundle load). */
const ensureButtonStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-button-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-button-styles';
  el.textContent = `
  .tra-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    font-family: var(--font-sans); font-weight: var(--weight-semibold);
    border-radius: var(--radius-md); border: 1px solid transparent;
    cursor: pointer; white-space: nowrap; user-select: none;
    transition: var(--transition-base);
  }
  .tra-btn:disabled { opacity: .45; cursor: not-allowed; }
  .tra-btn--sm { height: var(--control-h-sm); padding: 0 12px; font-size: var(--text-xs); }
  .tra-btn--md { height: var(--control-h-md); padding: 0 16px; font-size: var(--text-sm); }
  .tra-btn--lg { height: var(--control-h-lg); padding: 0 20px; font-size: var(--text-base); }

  .tra-btn--primary { background: var(--gradient-accent); color: var(--on-accent); box-shadow: var(--glow-accent); }
  .tra-btn--primary:hover:not(:disabled) { filter: brightness(1.07); }
  .tra-btn--primary:active:not(:disabled) { filter: brightness(.95); }

  .tra-btn--secondary { background: var(--surface-control); color: var(--text-default); border-color: var(--border-control); }
  .tra-btn--secondary:hover:not(:disabled) { background: var(--surface-hover); border-color: var(--border-strong); color: var(--text-strong); }

  .tra-btn--ghost { background: rgba(255,255,255,.04); color: var(--text-muted); }
  .tra-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,.08); color: var(--text-strong); }

  .tra-btn--danger { background: rgba(229,96,77,.14); color: var(--negative); border-color: rgba(229,96,77,.28); }
  .tra-btn--danger:hover:not(:disabled) { background: rgba(229,96,77,.22); }

  .tra-btn__spinner {
    width: 12px; height: 12px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,.35); border-top-color: currentColor;
    animation: tra-btn-spin .6s linear infinite;
  }
  @keyframes tra-btn-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(el);
};
ensureButtonStyles();

/**
 * Primary action button. Variants: primary (brass gradient), secondary,
 * ghost, danger. Sizes sm | md | lg. Supports loading + leading icon.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    className: `tra-btn tra-btn--${variant} tra-btn--${size} ${className}`,
    disabled: disabled || loading,
    style: style
  }, rest), loading && /*#__PURE__*/React.createElement("span", {
    className: "tra-btn__spinner"
  }), !loading && icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureTagStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-tag-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-tag-styles';
  el.textContent = `
  .tra-tag {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font-sans); font-weight: var(--weight-medium); font-size: var(--text-2xs);
    padding: 4px 10px; border-radius: var(--radius-full);
    background: var(--accent-wash); color: var(--accent-tint);
    border: 1px solid var(--accent-wash-border);
    transition: var(--transition-base); cursor: default;
  }
  .tra-tag--removable { cursor: pointer; }
  .tra-tag--removable:hover {
    background: rgba(229,96,77,.15); color: var(--negative);
    border-color: rgba(229,96,77,.28);
  }
  .tra-tag__x { font-size: 13px; line-height: 1; opacity: .5; transition: opacity var(--dur-fast); }
  .tra-tag--removable:hover .tra-tag__x { opacity: 1; }`;
  document.head.appendChild(el);
};
ensureTagStyles();

/**
 * Active-filter chip. When `onRemove` is provided it becomes removable —
 * the whole chip turns red on hover, mirroring the dashboard's filter tags.
 */
function Tag({
  children,
  onRemove,
  className = '',
  style,
  ...rest
}) {
  const removable = typeof onRemove === 'function';
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tra-tag ${removable ? 'tra-tag--removable' : ''} ${className}`,
    style: style,
    onClick: removable ? onRemove : undefined,
    role: removable ? 'button' : undefined
  }, rest), children, removable && /*#__PURE__*/React.createElement("span", {
    className: "tra-tag__x"
  }, "\xD7"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/core/ThemeToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function getStoredTheme() {
  if (typeof localStorage === 'undefined') return 'dark';
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

/** Apply a theme to <html> and persist it. */
function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');else document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {/* ignore */}
}

/**
 * Segmented light / dark switch. Uncontrolled by default — it reads and
 * writes the persisted theme on <html> itself. Pass `value` + `onChange`
 * to drive it from parent state instead.
 */
function ThemeToggle({
  value,
  onChange,
  labels = true,
  className = '',
  style,
  ...rest
}) {
  const [internal, setInternal] = React.useState(() => value || getStoredTheme());
  const theme = value != null ? value : internal;
  React.useEffect(() => {
    if (value == null) applyTheme(internal);
  }, [internal, value]);
  const pick = next => {
    if (next === theme) return;
    if (onChange) onChange(next);
    if (value == null) setInternal(next);
  };
  const Opt = ({
    id,
    icon,
    label
  }) => /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: `tra-themetoggle__opt ${theme === id ? 'tra-themetoggle__opt--active' : ''}`,
    onClick: () => pick(id),
    "aria-pressed": theme === id,
    title: `${label} 模式`
  }, /*#__PURE__*/React.createElement("span", {
    className: "tra-themetoggle__ico"
  }, icon), labels && /*#__PURE__*/React.createElement("span", null, label));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tra-themetoggle ${className}`,
    style: style,
    role: "group",
    "aria-label": "\u4E3B\u984C\u5207\u63DB"
  }, rest), /*#__PURE__*/React.createElement(Opt, {
    id: "light",
    icon: "\u2600",
    label: "\u660E\u4EAE"
  }), /*#__PURE__*/React.createElement(Opt, {
    id: "dark",
    icon: "\u263E",
    label: "\u6697\u8272"
  }));
}

/* Expose the helpers as statics so they're reachable from the bundle
   namespace (bare lowercase exports aren't surfaced on window). */
ThemeToggle.applyTheme = applyTheme;
ThemeToggle.getStoredTheme = getStoredTheme;
Object.assign(__ds_scope, { getStoredTheme, applyTheme, ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/data/KpiCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureKpiStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-kpi-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-kpi-styles';
  el.textContent = `
  .tra-kpi {
    position: relative; overflow: hidden; border-radius: var(--radius-lg);
    border: 1px solid var(--border-card); background: var(--surface-card);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
  }
  .tra-kpi__accent { position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; }
  .tra-kpi__top { display: flex; align-items: center; justify-content: space-between; }
  .tra-kpi__label { font: var(--weight-medium) var(--text-2xs) var(--font-sans); color: var(--text-muted); letter-spacing: var(--tracking-wide); }
  .tra-kpi__icon { font-size: 15px; opacity: .55; }
  .tra-kpi__row { display: flex; align-items: baseline; gap: 6px; }
  .tra-kpi__value { font: var(--weight-bold) var(--text-2xl)/1.05 var(--font-mono); letter-spacing: var(--tracking-tight); font-variant-numeric: tabular-nums; }
  .tra-kpi__unit { font: var(--text-xs) var(--font-sans); color: var(--text-faint); }
  .tra-kpi__delta { font: var(--weight-semibold) var(--text-2xs) var(--font-mono); margin-left: auto; }`;
  document.head.appendChild(el);
};
ensureKpiStyles();
const KPI_TONES = {
  brass: 'var(--brass-500)',
  clay: 'var(--clay-500)',
  sky: 'var(--series-3)',
  coral: 'var(--clay-400)',
  positive: 'var(--positive)'
};

/**
 * KPI stat card — label, big mono value, unit, tinted left accent and an
 * optional delta. The dashboard's top row (成交戶數, 均單價 …).
 */
function KpiCard({
  label,
  value,
  unit,
  icon,
  tone = 'brass',
  delta,
  className = '',
  style,
  ...rest
}) {
  const color = KPI_TONES[tone] || tone;
  const up = typeof delta === 'string' && delta.trim().startsWith('+');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tra-kpi ${className}`,
    style: style
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "tra-kpi__accent",
    style: {
      background: color
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "tra-kpi__top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tra-kpi__label"
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    className: "tra-kpi__icon"
  }, icon)), /*#__PURE__*/React.createElement("div", {
    className: "tra-kpi__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tra-kpi__value",
    style: {
      color
    }
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    className: "tra-kpi__unit"
  }, unit), delta != null && /*#__PURE__*/React.createElement("span", {
    className: "tra-kpi__delta",
    style: {
      color: up ? 'var(--positive)' : 'var(--negative)'
    }
  }, delta)));
}
Object.assign(__ds_scope, { KpiCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KpiCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensurePanelStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-panel-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-panel-styles';
  el.textContent = `
  .tra-panel {
    background: var(--surface-card); border: 1px solid var(--border-card);
    border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-card);
  }
  .tra-panel__head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 16px; border-bottom: 1px solid var(--line-soft);
  }
  .tra-panel__title { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .tra-panel__tick { width: 4px; height: 16px; border-radius: var(--radius-full); background: var(--gradient-accent); flex: none; }
  .tra-panel__t { font: var(--weight-semibold) var(--text-sm)/1.2 var(--font-sans); color: var(--text-strong); }
  .tra-panel__body { padding: var(--pad-card); }
  .tra-panel__body--flush { padding: 0; }`;
  document.head.appendChild(el);
};
ensurePanelStyles();

/**
 * Data panel — the rounded card that wraps every table / chart. Header
 * shows a brass tick, a title, an optional count badge and right-aligned
 * controls (`actions`). Set `flush` to remove body padding (tables).
 */
function Panel({
  title,
  count,
  actions,
  flush = false,
  children,
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tra-panel ${className}`,
    style: style
  }, rest), (title || actions) && /*#__PURE__*/React.createElement("div", {
    className: "tra-panel__head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tra-panel__title"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tra-panel__tick"
  }), /*#__PURE__*/React.createElement("span", {
    className: "tra-panel__t"
  }, title), count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '10px var(--font-mono)',
      color: 'var(--text-faint)',
      background: 'var(--surface-control)',
      padding: '1px 7px',
      borderRadius: 'var(--radius-full)'
    }
  }, count)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    className: `tra-panel__body ${flush ? 'tra-panel__body--flush' : ''}`
  }, children));
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Panel.jsx", error: String((e && e.message) || e) }); }

// components/data/StatBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureStatBarStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-statbar-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-statbar-styles';
  el.textContent = `
  .tra-statbar {
    position: relative; display: inline-flex; align-items: center; justify-content: flex-end;
    height: 24px; min-width: 64px; border-radius: var(--radius-sm); overflow: hidden;
  }
  .tra-statbar--left { justify-content: flex-start; }
  .tra-statbar__fill { position: absolute; inset: 0 auto 0 0; border-radius: var(--radius-sm); }
  .tra-statbar__edge { position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: var(--radius-full); }
  .tra-statbar__val {
    position: relative; z-index: 1; padding: 0 8px; white-space: nowrap;
    font: var(--weight-medium) var(--text-xs) var(--font-mono); color: var(--text-default);
    font-variant-numeric: tabular-nums;
  }`;
  document.head.appendChild(el);
};
ensureStatBarStyles();

/**
 * Inline data bar — the signature table cell. A translucent value bar with
 * a bright leading-edge tick and a right-aligned mono figure. `pct` 0–100.
 */
function StatBar({
  value,
  pct = 0,
  color = 'var(--series-1)',
  align = 'right',
  minWidth = 64,
  className = '',
  style,
  ...rest
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `tra-statbar ${align === 'left' ? 'tra-statbar--left' : ''} ${className}`,
    style: {
      minWidth,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "tra-statbar__fill",
    style: {
      width: `${clamped}%`,
      background: color,
      opacity: 'var(--bar-fill-opacity)'
    }
  }), clamped > 5 && /*#__PURE__*/React.createElement("span", {
    className: "tra-statbar__edge",
    style: {
      background: color,
      opacity: 'var(--bar-edge-opacity)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "tra-statbar__val"
  }, value));
}
Object.assign(__ds_scope, { StatBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatBar.jsx", error: String((e && e.message) || e) }); }

// components/data/TabPills.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureTabPillsStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-tabpills-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-tabpills-styles';
  el.textContent = `
  .tra-tabs { display: inline-flex; align-items: center; gap: 6px; }
  .tra-tab {
    display: inline-flex; align-items: center; gap: 6px;
    height: var(--control-h-sm); padding: 0 14px; border-radius: var(--radius-full);
    font: var(--weight-semibold) var(--text-xs) var(--font-sans);
    color: var(--text-muted); background: transparent; border: 1px solid transparent;
    cursor: pointer; transition: var(--transition-base); white-space: nowrap;
  }
  .tra-tab:hover { color: var(--text-default); background: rgba(255,255,255,.04); }
  .tra-tab--active {
    color: var(--accent-tint); background: var(--accent-wash);
    border-color: var(--accent-wash-border);
  }
  .tra-tab--active:hover { color: var(--accent-tint); background: var(--accent-wash); }`;
  document.head.appendChild(el);
};
ensureTabPillsStyles();

/**
 * Segmented pill tabs — the 數據看板 / 地圖 switcher and section nav.
 * `tabs` is an array of { value, label, icon? }; controlled via `value`.
 */
function TabPills({
  tabs = [],
  value,
  onChange,
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tra-tabs ${className}`,
    style: style
  }, rest), tabs.map(t => {
    const v = typeof t === 'string' ? t : t.value;
    const label = typeof t === 'string' ? t : t.label;
    const icon = typeof t === 'string' ? null : t.icon;
    const active = v === value;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      className: `tra-tab ${active ? 'tra-tab--active' : ''}`,
      onClick: () => onChange && onChange(v)
    }, icon && /*#__PURE__*/React.createElement("span", {
      style: {
        opacity: 0.8
      }
    }, icon), label);
  }));
}
Object.assign(__ds_scope, { TabPills });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TabPills.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ChatBubble.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureChatBubbleStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-chatbubble-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-chatbubble-styles';
  el.textContent = `
  .tra-bubble-row { display: flex; }
  .tra-bubble-row--user { justify-content: flex-end; }
  .tra-bubble {
    max-width: 80%; padding: 11px 15px; font-family: var(--font-sans);
    font-size: var(--text-sm); line-height: var(--leading-normal);
    border-radius: var(--radius-lg);
  }
  .tra-bubble--assistant {
    background: var(--surface-card); border: 1px solid var(--border-card);
    color: var(--text-default); border-bottom-left-radius: var(--radius-sm);
  }
  .tra-bubble--user {
    background: var(--accent-wash); border: 1px solid var(--accent-wash-border);
    color: var(--accent-tint); border-bottom-right-radius: var(--radius-sm);
  }
  .tra-bubble__text { white-space: pre-wrap; }
  .tra-bubble__sql-toggle {
    margin-top: 8px; font: var(--weight-medium) var(--text-xs) var(--font-sans);
    color: var(--accent-tint); background: none; border: none; cursor: pointer; padding: 0;
  }
  .tra-bubble__sql-toggle:hover { color: var(--accent-hover); }
  .tra-bubble__sql {
    margin-top: 8px; padding: 10px 12px; border-radius: var(--radius-md);
    background: var(--ink-950); border: 1px solid rgba(255,255,255,0.08);
    font: var(--text-xs) var(--font-mono); color: var(--brass-300);
    overflow-x: auto; white-space: pre;
  }`;
  document.head.appendChild(el);
};
ensureChatBubbleStyles();

/**
 * AI-chat message bubble. `role` "user" tints brass and right-aligns;
 * "assistant" is the surface card. Optional `sql` adds a 查看 SQL
 * disclosure that reveals a monospace query block.
 */
function ChatBubble({
  role = 'assistant',
  children,
  sql,
  className = '',
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tra-bubble-row tra-bubble-row--${role}`,
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: `tra-bubble tra-bubble--${role} ${className}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "tra-bubble__text"
  }, children), sql && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "tra-bubble__sql-toggle",
    onClick: () => setOpen(!open)
  }, open ? '▲ 收起 SQL' : '▼ 查看 SQL'), open && /*#__PURE__*/React.createElement("pre", {
    className: "tra-bubble__sql"
  }, sql))));
}
Object.assign(__ds_scope, { ChatBubble });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ChatBubble.jsx", error: String((e && e.message) || e) }); }

// components/feedback/TypingDots.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureTypingStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-typing-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-typing-styles';
  el.textContent = `
  .tra-typing {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 13px 16px; background: var(--surface-card);
    border: 1px solid var(--border-card); border-radius: var(--radius-lg);
    border-bottom-left-radius: var(--radius-sm);
  }
  .tra-typing span {
    width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);
    animation: tra-typing-bounce 1.1s var(--ease-standard) infinite;
  }
  .tra-typing span:nth-child(2) { animation-delay: .15s; }
  .tra-typing span:nth-child(3) { animation-delay: .3s; }
  @keyframes tra-typing-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: .45; }
    30% { transform: translateY(-4px); opacity: 1; }
  }`;
  document.head.appendChild(el);
};
ensureTypingStyles();

/**
 * Three-dot "assistant is thinking" indicator, styled as an assistant
 * bubble. Render while awaiting an AI answer.
 */
function TypingDots({
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `tra-typing ${className}`,
    style: style
  }, rest), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null));
}
Object.assign(__ds_scope, { TypingDots });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/TypingDots.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureCheckboxStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-checkbox-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-checkbox-styles';
  el.textContent = `
  .tra-check {
    display: inline-flex; align-items: center; gap: 9px; cursor: pointer;
    font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-default);
    padding: 6px 10px; border-radius: var(--radius-md); transition: var(--transition-base);
    user-select: none;
  }
  .tra-check:hover { background: rgba(255,255,255,.05); }
  .tra-check__box {
    width: 16px; height: 16px; flex: none; border-radius: 5px;
    border: 1.5px solid var(--border-strong); background: var(--surface-control);
    display: flex; align-items: center; justify-content: center;
    transition: var(--transition-base);
  }
  .tra-check__box svg { width: 10px; height: 10px; opacity: 0; transform: scale(.6); transition: var(--transition-base); }
  .tra-check--on .tra-check__box {
    background: var(--accent); border-color: var(--accent); box-shadow: var(--glow-accent-sm);
  }
  .tra-check--on .tra-check__box svg { opacity: 1; transform: scale(1); }`;
  document.head.appendChild(el);
};
ensureCheckboxStyles();

/**
 * Checkbox with brass fill + check glyph. Used in the multi-select filter
 * menus (districts / types / rooms). Controlled via `checked` + `onChange`.
 */
function Checkbox({
  checked = false,
  onChange,
  children,
  className = '',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    className: `tra-check ${checked ? 'tra-check--on' : ''} ${className}`,
    style: style
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "tra-check__box"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 12 12",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 6.2L5 8.7L9.5 3.5",
    stroke: "#241606",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureSelectStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-select-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-select-styles';
  el.textContent = `
  .tra-field { display: inline-flex; flex-direction: column; gap: 5px; min-width: 0; }
  .tra-field__label {
    font: var(--type-label); text-transform: uppercase;
    letter-spacing: var(--tracking-caps); color: var(--text-faint);
  }
  .tra-select {
    appearance: none; -webkit-appearance: none;
    background-color: var(--surface-control);
    border: 1px solid var(--border-control); color: var(--text-default);
    border-radius: var(--radius-md); height: var(--control-h-sm);
    padding: 0 28px 0 10px; font-family: var(--font-sans); font-size: var(--text-xs);
    cursor: pointer; transition: var(--transition-base);
    background-repeat: no-repeat; background-position: right 9px center;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238a9a93' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
  .tra-select:hover { border-color: var(--border-strong); }
  .tra-select:focus { outline: none; border-color: var(--accent); box-shadow: var(--glow-accent-sm); }
  .tra-select option { background: var(--surface-overlay); color: var(--text-default); }`;
  document.head.appendChild(el);
};
ensureSelectStyles();

/**
 * Styled native <select> with the dashboard's custom chevron and an
 * optional micro-label above it. Used throughout the filter bar.
 */
function Select({
  label,
  options = [],
  value,
  onChange,
  className = '',
  style,
  ...rest
}) {
  const sel = /*#__PURE__*/React.createElement("select", _extends({
    className: `tra-select ${className}`,
    value: value,
    onChange: e => onChange && onChange(e.target.value),
    style: label ? undefined : style
  }, rest), options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)));
  if (!label) return sel;
  return /*#__PURE__*/React.createElement("label", {
    className: "tra-field",
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    className: "tra-field__label"
  }, label), sel);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const ensureInputStyles = () => {
  if (typeof document === 'undefined' || document.getElementById('tra-input-styles')) return;
  const el = document.createElement('style');
  el.id = 'tra-input-styles';
  el.textContent = `
  .tra-input-wrap { display: inline-flex; align-items: center; gap: 8px; position: relative; width: 100%; }
  .tra-input {
    width: 100%; height: var(--control-h-lg);
    background: var(--surface-control); border: 1px solid var(--border-control);
    color: var(--text-strong); border-radius: var(--radius-md);
    padding: 0 14px; font-family: var(--font-sans); font-size: var(--text-base);
    transition: var(--transition-base);
  }
  .tra-input--with-icon { padding-left: 38px; }
  .tra-input::placeholder { color: var(--text-faint); }
  .tra-input:hover { border-color: var(--border-strong); }
  .tra-input:focus { outline: none; border-color: var(--accent); box-shadow: var(--glow-accent-sm); }
  .tra-input--sm { height: var(--control-h-md); font-size: var(--text-sm); }
  .tra-input__icon {
    position: absolute; left: 13px; display: flex; pointer-events: none;
    color: var(--text-muted); font-size: 15px;
  }`;
  document.head.appendChild(el);
};
ensureInputStyles();

/**
 * Text / search input. Optional leading icon node. Used for the AI-chat
 * composer and any search field.
 */
function TextInput({
  icon = null,
  size = 'lg',
  className = '',
  style,
  wrapStyle,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "tra-input-wrap",
    style: wrapStyle
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "tra-input__icon"
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    className: `tra-input tra-input--${size} ${icon ? 'tra-input--with-icon' : ''} ${className}`,
    style: style
  }, rest)));
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/AnalyticsScreen.jsx
try { (() => {
/* Analytics screen — the expanded data-analysis surface (增加數據分析).
   Trend line, transaction volume, type share, district comparison.
   Composes Panel, KpiCard, TabPills, Badge + the local chart helpers. */
function AnalyticsScreen() {
  const {
    Panel,
    KpiCard,
    TabPills,
    Badge
  } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const {
    LineChart,
    BarChart,
    DonutChart
  } = window;
  const D = window.TRA_DATA;
  const [metric, setMetric] = React.useState('unit_price');
  const first = D.months[0].unit_price;
  const last = D.months[D.months.length - 1].unit_price;
  const yoy = ((last - first) / first * 100).toFixed(1);
  const peak = D.months.reduce((a, b) => b.volume > a.volume ? b : a);
  const metricMeta = {
    unit_price: {
      label: '均單價趨勢',
      unit: '萬/坪',
      color: 'var(--series-3)',
      fmt: v => v
    },
    volume: {
      label: '成交量趨勢',
      unit: '戶',
      color: 'var(--series-1)',
      fmt: v => Math.round(v).toLocaleString()
    }
  };
  const m = metricMeta[metric];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px 40px',
      display: 'grid',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "24\u500B\u6708\u6F32\u5E45",
    value: `+${yoy}`,
    unit: "%",
    tone: "positive",
    icon: "\u2197"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u73FE\u671F\u5747\u55AE\u50F9",
    value: last,
    unit: "\u842C/\u576A",
    tone: "sky",
    icon: "\u25F3"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u6210\u4EA4\u9AD8\u5CF0",
    value: peak.label,
    unit: `${peak.volume.toLocaleString()} 戶`,
    tone: "clay",
    icon: "\u25C6"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u4E3B\u529B\u623F\u578B",
    value: "3\u623F",
    unit: "39.8%",
    tone: "brass",
    icon: "\u25A6"
  })), /*#__PURE__*/React.createElement(Panel, {
    title: m.label,
    actions: /*#__PURE__*/React.createElement(TabPills, {
      value: metric,
      onChange: setMetric,
      tabs: [{
        value: 'unit_price',
        label: '單價'
      }, {
        value: 'volume',
        label: '成交量'
      }]
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) 24px var(--font-mono)',
      color: m.color,
      letterSpacing: 'var(--tracking-tight)'
    }
  }, metric === 'unit_price' ? last : last && D.months[D.months.length - 1].volume.toLocaleString()), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '12px var(--font-sans)',
      color: 'var(--text-faint)'
    }
  }, m.unit, " \xB7 \u6C11\u570B 113/06 \u2013 115/06"), /*#__PURE__*/React.createElement(Badge, {
    tone: "positive",
    style: {
      marginLeft: 'auto'
    }
  }, "\u2197 \u8F03\u671F\u521D +", yoy, "%")), /*#__PURE__*/React.createElement(LineChart, {
    data: D.months,
    xKey: "label",
    yKey: metric,
    color: m.color,
    format: m.fmt
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    title: "\u5404\u884C\u653F\u5340\u6210\u4EA4\u91CF"
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: D.districts.slice(0, 8),
    xKey: "district",
    yKey: "count",
    color: "var(--series-1)",
    format: v => v.toLocaleString()
  })), /*#__PURE__*/React.createElement(Panel, {
    title: "\u5EFA\u7269\u985E\u578B\u4F54\u6BD4"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement(DonutChart, {
    data: D.types,
    valueKey: "count",
    labelKey: "type"
  })))), /*#__PURE__*/React.createElement(Panel, {
    title: "\u5404\u884C\u653F\u5340\u5747\u55AE\u50F9\u6BD4\u8F03"
  }, /*#__PURE__*/React.createElement(BarChart, {
    data: D.districts.slice(0, 8),
    xKey: "district",
    yKey: "unit_price",
    color: "var(--series-3)",
    format: v => `${v}`,
    height: 200
  })));
}
window.AnalyticsScreen = AnalyticsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/AnalyticsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/ChatScreen.jsx
try { (() => {
/* AI Q&A screen — natural-language → SQL → answer.
   Composes ChatBubble, TypingDots, TextInput, Button from the DS bundle. */
function ChatScreen() {
  const {
    ChatBubble,
    TypingDots,
    TextInput,
    Button
  } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const SUGGESTIONS = ['東區最近一年的平均房價是多少？', '永康區透天厝的均價趨勢如何？', '台南哪個行政區交易量最多？', '2024年各行政區平均單價排名'];
  const CANNED = {
    default: {
      text: '依實價登錄資料，該條件下的平均單價約為 33.6 萬／坪，成交量以永康區（3,184 戶）居首。下方為產生的查詢。',
      sql: "SELECT district, AVG(unit_price) AS avg_price, COUNT(*) AS n\nFROM deals\nWHERE deal_date BETWEEN '2024-06-01' AND '2025-06-30'\nGROUP BY district\nORDER BY n DESC;"
    }
  };
  const [messages, setMessages] = React.useState([{
    role: 'assistant',
    text: '您好！我是台南實價登錄 AI 助手。\n我可查詢台南市民國 110 年至今的實價登錄資料 — 各行政區均價、交易趨勢、特定建物型態行情等。請問您想了解什麼？'
  }]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const feedRef = React.useRef(null);
  React.useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, loading]);
  const send = text => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(p => [...p, {
      role: 'user',
      text: q
    }]);
    setLoading(true);
    setTimeout(() => {
      const a = CANNED.default;
      setMessages(p => [...p, {
        role: 'assistant',
        text: a.text,
        sql: a.sql
      }]);
      setLoading(false);
    }, 1100);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      padding: '20px',
      height: 'calc(100vh - var(--nav-h))',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: feedRef,
    style: {
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      paddingBottom: 10
    }
  }, messages.map((msg, i) => /*#__PURE__*/React.createElement(ChatBubble, {
    key: i,
    role: msg.role,
    sql: msg.sql
  }, msg.text)), loading && /*#__PURE__*/React.createElement(TypingDots, null)), messages.length <= 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12
    }
  }, SUGGESTIONS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => send(s),
    style: {
      font: '12px var(--font-sans)',
      color: 'var(--text-default)',
      background: 'var(--surface-control)',
      border: '1px solid var(--border-control)',
      borderRadius: 'var(--radius-full)',
      padding: '7px 13px',
      cursor: 'pointer',
      transition: 'var(--transition-base)'
    }
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(TextInput, {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => e.key === 'Enter' && send(),
    placeholder: "\u8F38\u5165\u554F\u984C\uFF0C\u4F8B\u5982\uFF1A\u6771\u5340\u4ECA\u5E74\u5E73\u5747\u55AE\u50F9\u662F\u591A\u5C11\uFF1F",
    wrapStyle: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: () => send(),
    disabled: !input.trim() || loading
  }, "\u9001\u51FA")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '10px var(--font-sans)',
      color: 'var(--text-faint)',
      textAlign: 'center',
      marginTop: 10
    }
  }, "\u8CC7\u6599\u4F86\u6E90\uFF1A\u5167\u653F\u90E8\u4E0D\u52D5\u7522\u4EA4\u6613\u5BE6\u50F9\u67E5\u8A62\u670D\u52D9\u7DB2\uFF5CAI \u56DE\u7B54\u50C5\u4F9B\u53C3\u8003\uFF0C\u4E0D\u69CB\u6210\u6295\u8CC7\u5EFA\u8B70"));
}
window.ChatScreen = ChatScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/ChatScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/DashboardScreen.jsx
try { (() => {
/* Dashboard screen — KPI row, active filter tags, and bar-cell tables.
   Composes KpiCard, Panel, StatBar, Tag, Badge from the DS bundle. */
function BarTable({
  title,
  count,
  columns,
  rows,
  pageSize = 6
}) {
  const {
    Panel,
    StatBar,
    Badge
  } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const [page, setPage] = React.useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  const maxes = {};
  columns.forEach(c => {
    if (c.bar) maxes[c.key] = Math.max(...rows.map(r => +r[c.key] || 0), 1);
  });
  const pager = pages > 1 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '11px var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPage(p => Math.max(0, p - 1)),
    disabled: page === 0,
    style: pagerBtn(page === 0)
  }, "\u2039"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontVariantNumeric: 'tabular-nums'
    }
  }, page + 1, " / ", pages), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPage(p => Math.min(pages - 1, p + 1)),
    disabled: page === pages - 1,
    style: pagerBtn(page === pages - 1)
  }, "\u203A")) : null;
  return /*#__PURE__*/React.createElement(Panel, {
    title: title,
    count: count,
    actions: pager,
    flush: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: '1px solid var(--line-soft)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    className: "t-label",
    style: {
      padding: '8px 14px',
      textAlign: c.align || 'right',
      whiteSpace: 'nowrap'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, slice.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      borderBottom: '1px solid rgba(255,255,255,.03)'
    }
  }, columns.map(c => {
    const v = r[c.key];
    if (c.badge) {
      const tone = v === '預售' ? 'info' : 'positive';
      return /*#__PURE__*/React.createElement("td", {
        key: c.key,
        style: {
          padding: '7px 14px',
          textAlign: 'left'
        }
      }, /*#__PURE__*/React.createElement(Badge, {
        tone: tone
      }, v));
    }
    if (c.bar) {
      const pct = +v / maxes[c.key] * 100;
      return /*#__PURE__*/React.createElement("td", {
        key: c.key,
        style: {
          padding: '6px 14px',
          textAlign: 'right'
        }
      }, /*#__PURE__*/React.createElement(StatBar, {
        value: c.fmt ? c.fmt(v) : Number(v).toLocaleString(),
        pct: pct,
        color: c.color,
        minWidth: c.minWidth || 72
      }));
    }
    return /*#__PURE__*/React.createElement("td", {
      key: c.key,
      style: {
        padding: '7px 14px',
        textAlign: c.align || 'right',
        font: 'var(--weight-medium) 12px var(--font-sans)',
        color: 'var(--text-default)',
        whiteSpace: 'nowrap'
      }
    }, c.fmt ? c.fmt(v) : v);
  })))))));
}
function pagerBtn(disabled) {
  return {
    width: 24,
    height: 24,
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,.05)',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
    fontSize: 13
  };
}
function DashboardScreen({
  filters
}) {
  const {
    KpiCard,
    Tag
  } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const D = window.TRA_DATA;
  const k = D.kpi;
  const tags = [...filters.districts, ...filters.types];
  const distCols = [{
    key: 'district',
    label: '行政區',
    align: 'left'
  }, {
    key: 'count',
    label: '戶數',
    bar: true,
    color: 'var(--series-1)'
  }, {
    key: 'unit_price',
    label: '單價(萬/坪)',
    bar: true,
    color: 'var(--series-3)',
    fmt: v => v
  }, {
    key: 'area',
    label: '坪數',
    bar: true,
    color: 'var(--series-7)',
    fmt: v => v
  }, {
    key: 'avg_total',
    label: '均總價(萬)',
    bar: true,
    color: 'var(--series-2)'
  }, {
    key: 'sales',
    label: '總銷(億)',
    bar: true,
    color: 'var(--series-4)'
  }, {
    key: 'pct',
    label: '佔比',
    bar: true,
    color: 'var(--series-5)',
    fmt: v => `${v}%`,
    minWidth: 56
  }];
  const typeCols = [{
    key: 'type',
    label: '類型',
    align: 'left'
  }, {
    key: 'count',
    label: '戶數',
    bar: true,
    color: 'var(--series-1)'
  }, {
    key: 'sales',
    label: '總銷(億)',
    bar: true,
    color: 'var(--series-4)'
  }, {
    key: 'pct',
    label: '佔比',
    bar: true,
    color: 'var(--series-5)',
    fmt: v => `${v}%`,
    minWidth: 56
  }];
  const roomCols = [{
    key: 'rooms',
    label: '房型',
    align: 'left',
    fmt: v => `${v}房`
  }, {
    key: 'count',
    label: '戶數',
    bar: true,
    color: 'var(--series-1)'
  }, {
    key: 'unit_price',
    label: '單價(萬/坪)',
    bar: true,
    color: 'var(--series-3)',
    fmt: v => v
  }, {
    key: 'area',
    label: '坪數',
    bar: true,
    color: 'var(--series-7)',
    fmt: v => v
  }, {
    key: 'avg_total',
    label: '均總價(萬)',
    bar: true,
    color: 'var(--series-2)'
  }, {
    key: 'pct',
    label: '佔比',
    bar: true,
    color: 'var(--series-5)',
    fmt: v => `${v}%`,
    minWidth: 56
  }];
  const caseCols = [{
    key: 'case_type',
    label: '類型',
    align: 'left',
    badge: true
  }, {
    key: 'district',
    label: '行政區',
    align: 'left'
  }, {
    key: 'name',
    label: '建案／地址',
    align: 'left'
  }, {
    key: 'count',
    label: '銷售戶數',
    bar: true,
    color: 'var(--series-1)'
  }, {
    key: 'sales_ratio',
    label: '銷售成數',
    bar: true,
    color: 'var(--series-5)',
    fmt: v => `${v}%`
  }, {
    key: 'unit_price',
    label: '單價(萬/坪)',
    bar: true,
    color: 'var(--series-3)',
    fmt: v => v
  }, {
    key: 'avg_total',
    label: '均總價(萬)',
    bar: true,
    color: 'var(--series-2)'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u6210\u4EA4\u6236\u6578",
    value: k.total.toLocaleString(),
    unit: "\u6236",
    tone: "brass",
    icon: "\u25A6",
    delta: "+4.2%"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u5747\u55AE\u50F9",
    value: k.avg_unit_price,
    unit: "\u842C/\u576A",
    tone: "sky",
    icon: "\u25F3"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u5747\u576A\u6578",
    value: k.avg_area,
    unit: "\u576A",
    tone: "positive",
    icon: "\u25F0"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u5747\u7E3D\u50F9",
    value: k.avg_total.toLocaleString(),
    unit: "\u842C",
    tone: "clay",
    icon: "\u25C6",
    delta: "-1.1%"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "\u7E3D\u92B7\u552E\u984D",
    value: k.total_sales.toLocaleString(),
    unit: "\u5104",
    tone: "coral",
    icon: "\u25C8"
  })), tags.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14
    }
  }, tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.9fr 1fr',
      gap: 'var(--gap-card)'
    }
  }, /*#__PURE__*/React.createElement(BarTable, {
    title: "\u884C\u653F\u5340\u6392\u884C",
    count: D.districts.length,
    columns: distCols,
    rows: D.districts
  }), /*#__PURE__*/React.createElement(BarTable, {
    title: "\u985E\u578B\u7D71\u8A08",
    count: D.types.length,
    columns: typeCols,
    rows: D.types
  })), /*#__PURE__*/React.createElement(BarTable, {
    title: "\u623F\u578B\u7D71\u8A08",
    count: D.rooms.length,
    columns: roomCols,
    rows: D.rooms
  }), /*#__PURE__*/React.createElement(BarTable, {
    title: "\u500B\u6848\u7D71\u8A08\uFF08\u6210\u5C4B \uFF0B \u9810\u552E\u5C4B\uFF09",
    count: D.cases.length,
    columns: caseCols,
    rows: D.cases
  })));
}
window.DashboardScreen = DashboardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/FilterBar.jsx
try { (() => {
/* Sticky filter bar. Composes Select, Button, Checkbox, Tag from the DS bundle. */
function FilterBar({
  filters,
  onChange,
  onApply,
  onClear,
  loading
}) {
  const {
    Select,
    Button,
    Checkbox
  } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const [openMenu, setOpenMenu] = React.useState(null);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const YEARS = [{
    label: '114年',
    value: '114'
  }, {
    label: '115年',
    value: '115'
  }];
  const MONTHS = Array.from({
    length: 12
  }, (_, i) => ({
    label: `${i + 1}月`,
    value: String(i + 1)
  }));
  const PRESALE = [{
    label: '成屋 + 預售',
    value: 'all'
  }, {
    label: '成屋',
    value: 'false'
  }, {
    label: '預售屋',
    value: 'true'
  }];
  const AGE = [{
    label: '不限屋齡',
    value: 'all'
  }, {
    label: '5年以內',
    value: '5'
  }, {
    label: '10年以內',
    value: '10'
  }, {
    label: '20年以內',
    value: '20'
  }, {
    label: '30年以上',
    value: '30+'
  }];
  const DISTRICTS = ['永康區', '安南區', '東區', '中西區', '北區', '南區', '仁德區', '歸仁區'];
  const TYPES = ['住宅大樓', '透天厝', '華廈', '公寓', '套房', '辦公商業'];
  const set = (k, v) => onChange({
    ...filters,
    [k]: v
  });
  const toggle = (k, v) => {
    const cur = filters[k];
    set(k, cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]);
  };
  const Multi = ({
    k,
    label,
    options
  }) => {
    const sel = filters[k];
    const text = sel.length === 0 ? `全部${label}` : sel.length === 1 ? sel[0] : `${sel.length} 項`;
    const isOpen = openMenu === k;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "t-label"
    }, label), /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpenMenu(isOpen ? null : k),
      style: {
        height: 'var(--control-h-sm)',
        minWidth: 112,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        background: 'var(--surface-control)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border-control)'}`,
        font: '12px var(--font-sans)',
        color: sel.length ? 'var(--accent-tint)' : 'var(--text-default)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, text), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--text-faint)',
        fontSize: 9,
        transform: isOpen ? 'rotate(180deg)' : 'none'
      }
    }, "\u25BE")), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 5,
        zIndex: 200,
        width: 184,
        background: 'var(--surface-overlay)',
        border: '1px solid var(--border-control)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-pop)',
        padding: 5,
        maxHeight: 250,
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        padding: '4px 8px 8px',
        borderBottom: '1px solid var(--line-soft)',
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => set(k, options.slice()),
      style: {
        background: 'none',
        border: 'none',
        color: 'var(--accent-tint)',
        font: '11px var(--font-sans)',
        cursor: 'pointer'
      }
    }, "\u5168\u9078"), /*#__PURE__*/React.createElement("button", {
      onClick: () => set(k, []),
      style: {
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        font: '11px var(--font-sans)',
        cursor: 'pointer'
      }
    }, "\u6E05\u9664")), options.map(o => /*#__PURE__*/React.createElement(Checkbox, {
      key: o,
      checked: sel.includes(o),
      onChange: () => toggle(k, o),
      style: {
        width: '100%'
      }
    }, o))));
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'sticky',
      top: 'var(--nav-h)',
      zIndex: 90,
      background: 'var(--chrome-bg)',
      backdropFilter: 'var(--blur-chrome)',
      WebkitBackdropFilter: 'var(--blur-chrome)',
      borderBottom: '1px solid var(--border-card)',
      padding: '12px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 'var(--gap-control)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-label"
  }, "\u8D77\u59CB"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.fromYear,
    onChange: v => set('fromYear', v),
    options: YEARS
  }), /*#__PURE__*/React.createElement(Select, {
    value: filters.fromMonth,
    onChange: v => set('fromMonth', v),
    options: MONTHS
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-label"
  }, "\u7D50\u675F"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.toYear,
    onChange: v => set('toYear', v),
    options: YEARS
  }), /*#__PURE__*/React.createElement(Select, {
    value: filters.toMonth,
    onChange: v => set('toMonth', v),
    options: MONTHS
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 30,
      background: 'var(--line-soft)',
      alignSelf: 'flex-end',
      marginBottom: 1
    }
  }), /*#__PURE__*/React.createElement(Multi, {
    k: "districts",
    label: "\u884C\u653F\u5340",
    options: DISTRICTS
  }), /*#__PURE__*/React.createElement(Multi, {
    k: "types",
    label: "\u985E\u578B",
    options: TYPES
  }), /*#__PURE__*/React.createElement(Select, {
    label: "\u6210\uFF0F\u9810\u552E",
    value: filters.presale,
    onChange: v => set('presale', v),
    options: PRESALE
  }), /*#__PURE__*/React.createElement(Select, {
    label: "\u5C4B\u9F61",
    value: filters.age,
    onChange: v => set('age', v),
    options: AGE
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 30,
      background: 'var(--line-soft)',
      alignSelf: 'flex-end',
      marginBottom: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignSelf: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    loading: loading,
    onClick: onApply
  }, "\u5957\u7528\u7BE9\u9078"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    onClick: onClear
  }, "\u6E05\u9664"))));
}
window.FilterBar = FilterBar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/FilterBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Navbar.jsx
try { (() => {
/* Top navigation bar. Composes Badge from the DS bundle. */
function Navbar({
  view,
  onNav
}) {
  const {
    Badge,
    ThemeToggle
  } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const links = [{
    id: 'dashboard',
    label: '數據看板',
    icon: '▦'
  }, {
    id: 'analytics',
    label: '趨勢分析',
    icon: '◈'
  }, {
    id: 'chat',
    label: 'AI 問答',
    icon: '◇'
  }];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '1px solid var(--border-card)',
      background: 'var(--chrome-bg)',
      backdropFilter: 'var(--blur-chrome)',
      WebkitBackdropFilter: 'var(--blur-chrome)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 'var(--nav-h)',
      padding: '0 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 'var(--radius-md)',
      background: 'var(--gradient-brand)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      font: 'var(--weight-bold) 15px var(--font-cjk)',
      boxShadow: 'var(--glow-accent)'
    }
  }, "\u5357"), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.15
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-semibold) 14px var(--font-sans)',
      color: 'var(--text-strong)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, "\u53F0\u5357\u5E02\u4E0D\u52D5\u7522\u5206\u6790"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '10px var(--font-sans)',
      color: 'var(--text-faint)'
    }
  }, "\u6C11\u570B 110 \u5E74\u81F3\u4ECA"), /*#__PURE__*/React.createElement(Badge, {
    tone: "brass",
    dot: true,
    pulse: true
  }, "\u6700\u65B0 115\u5E746\u6708")))), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, links.map(l => {
    const active = view === l.id;
    return /*#__PURE__*/React.createElement("button", {
      key: l.id,
      onClick: () => onNav(l.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 13px',
        height: 32,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-base)',
        font: 'var(--weight-medium) 12px var(--font-sans)',
        color: active ? 'var(--accent-tint)' : 'var(--text-muted)',
        background: active ? 'var(--accent-wash)' : 'transparent',
        border: active ? '1px solid var(--accent-wash-border)' : '1px solid transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        opacity: 0.75
      }
    }, l.icon), l.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 22,
      background: 'var(--line-soft)'
    }
  }), /*#__PURE__*/React.createElement(ThemeToggle, {
    labels: false
  }))));
}
window.Navbar = Navbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Navbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/charts.jsx
try { (() => {
/* Lightweight SVG charts for the Analytics screen. Data-viz only —
   colours come from --series-* tokens. Attaches to window. */

function useTokenColor(varName, fallback) {
  return `var(${varName}, ${fallback})`;
}

/* ── Area + line trend ─────────────────────────────────────── */
function LineChart({
  data,
  xKey,
  yKey,
  color = 'var(--series-1)',
  height = 220,
  format = v => v
}) {
  const w = 720,
    h = height,
    padL = 44,
    padR = 16,
    padT = 16,
    padB = 28;
  const xs = data.map(d => d[xKey]);
  const ys = data.map(d => d[yKey]);
  const min = Math.min(...ys),
    max = Math.max(...ys);
  const range = max - min || 1;
  const ix = i => padL + i / (data.length - 1) * (w - padL - padR);
  const iy = v => padT + (1 - (v - min) / range) * (h - padT - padB);
  const line = ys.map((v, i) => `${i === 0 ? 'M' : 'L'}${ix(i).toFixed(1)},${iy(v).toFixed(1)}`).join(' ');
  const area = `${line} L${ix(data.length - 1).toFixed(1)},${h - padB} L${ix(0).toFixed(1)},${h - padB} Z`;
  const gridVals = [min, min + range / 2, max];
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    width: "100%",
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: color,
    stopOpacity: "0.28"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: color,
    stopOpacity: "0"
  }))), gridVals.map((g, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: w - padR,
    y1: iy(g),
    y2: iy(g),
    stroke: "rgba(255,255,255,.06)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 8,
    y: iy(g) + 3,
    textAnchor: "end",
    fontSize: "10",
    fontFamily: "var(--font-mono)",
    fill: "var(--text-faint)"
  }, format(+g.toFixed(1))))), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${gid})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), ys.map((v, i) => (i % 4 === 0 || i === ys.length - 1) && /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: ix(i),
    cy: iy(v),
    r: "2.5",
    fill: "var(--bg-app)",
    stroke: color,
    strokeWidth: "1.5"
  })), xs.map((x, i) => (i % 4 === 0 || i === xs.length - 1) && /*#__PURE__*/React.createElement("text", {
    key: i,
    x: ix(i),
    y: h - 8,
    textAnchor: "middle",
    fontSize: "9.5",
    fontFamily: "var(--font-mono)",
    fill: "var(--text-faint)"
  }, x)));
}

/* ── Vertical bar chart ────────────────────────────────────── */
function BarChart({
  data,
  xKey,
  yKey,
  color = 'var(--series-1)',
  height = 220,
  format = v => v
}) {
  const w = 720,
    h = height,
    padL = 44,
    padR = 12,
    padT = 14,
    padB = 30;
  const ys = data.map(d => d[yKey]);
  const max = Math.max(...ys) || 1;
  const bw = (w - padL - padR) / data.length;
  const iy = v => padT + (1 - v / max) * (h - padT - padB);
  const ticks = [0, max / 2, max];
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${w} ${h}`,
    width: "100%",
    style: {
      display: 'block'
    }
  }, ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: padL,
    x2: w - padR,
    y1: iy(t),
    y2: iy(t),
    stroke: "rgba(255,255,255,.06)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: padL - 8,
    y: iy(t) + 3,
    textAnchor: "end",
    fontSize: "10",
    fontFamily: "var(--font-mono)",
    fill: "var(--text-faint)"
  }, format(Math.round(t))))), data.map((d, i) => {
    const bh = (h - padT - padB) * (d[yKey] / max);
    const x = padL + i * bw + bw * 0.16;
    const bwInner = bw * 0.68;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: h - padB - bh,
      width: bwInner,
      height: bh,
      rx: "4",
      fill: color,
      opacity: "0.85"
    }), /*#__PURE__*/React.createElement("text", {
      x: x + bwInner / 2,
      y: h - 10,
      textAnchor: "middle",
      fontSize: "10",
      fontFamily: "var(--font-sans)",
      fill: "var(--text-muted)"
    }, d[xKey]));
  }));
}

/* ── Donut / share chart ───────────────────────────────────── */
function DonutChart({
  data,
  valueKey,
  labelKey,
  size = 200,
  colors
}) {
  const palette = colors || ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const r = size / 2,
    ir = r * 0.62,
    cx = r,
    cy = r;
  let a0 = -Math.PI / 2;
  const arc = val => {
    const a1 = a0 + val / total * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rad) => [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    const [x0, y0] = p(a0, r),
      [x1, y1] = p(a1, r);
    const [x2, y2] = p(a1, ir),
      [x3, y3] = p(a0, ir);
    a0 = a1;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ir},${ir} 0 ${large} 0 ${x3},${y3} Z`;
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      flex: 'none'
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: arc(d[valueKey]),
    fill: palette[i % palette.length]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: palette[i % palette.length],
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '12px var(--font-sans)',
      color: 'var(--text-default)',
      minWidth: 64
    }
  }, d[labelKey]), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-semibold) 12px var(--font-mono)',
      color: 'var(--text-muted)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, (d[valueKey] / total * 100).toFixed(1), "%")))));
}
Object.assign(window, {
  LineChart,
  BarChart,
  DonutChart
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/charts.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/data.js
try { (() => {
/* Mock Tainan real-estate data for the UI kit (representative, not real). */
window.TRA_DATA = function () {
  const districts = [{
    district: '永康區',
    count: 3184,
    unit_price: 28.4,
    area: 38.2,
    avg_total: 1085,
    sales: 345,
    pct: 14.2
  }, {
    district: '安南區',
    count: 2351,
    unit_price: 24.1,
    area: 41.6,
    avg_total: 1002,
    sales: 236,
    pct: 10.5
  }, {
    district: '東區',
    count: 1980,
    unit_price: 41.2,
    area: 33.1,
    avg_total: 1364,
    sales: 270,
    pct: 8.8
  }, {
    district: '中西區',
    count: 1742,
    unit_price: 45.8,
    area: 31.4,
    avg_total: 1438,
    sales: 251,
    pct: 7.8
  }, {
    district: '北區',
    count: 1611,
    unit_price: 38.6,
    area: 32.0,
    avg_total: 1235,
    sales: 199,
    pct: 7.2
  }, {
    district: '南區',
    count: 1488,
    unit_price: 33.2,
    area: 35.5,
    avg_total: 1179,
    sales: 175,
    pct: 6.6
  }, {
    district: '仁德區',
    count: 1320,
    unit_price: 26.7,
    area: 39.8,
    avg_total: 1063,
    sales: 140,
    pct: 5.9
  }, {
    district: '歸仁區',
    count: 1104,
    unit_price: 23.9,
    area: 42.1,
    avg_total: 1006,
    sales: 111,
    pct: 4.9
  }];
  const types = [{
    type: '住宅大樓',
    count: 9820,
    sales: 1180,
    pct: 43.8
  }, {
    type: '透天厝',
    count: 6240,
    sales: 980,
    pct: 27.8
  }, {
    type: '華廈',
    count: 2710,
    sales: 268,
    pct: 12.1
  }, {
    type: '公寓',
    count: 1980,
    sales: 150,
    pct: 8.8
  }, {
    type: '套房',
    count: 1010,
    sales: 64,
    pct: 4.5
  }, {
    type: '辦公商業',
    count: 670,
    sales: 92,
    pct: 3.0
  }];
  const rooms = [{
    rooms: 1,
    count: 1820,
    unit_price: 39.1,
    area: 14.2,
    avg_total: 555,
    pct: 8.1
  }, {
    rooms: 2,
    count: 5240,
    unit_price: 36.4,
    area: 23.8,
    avg_total: 866,
    pct: 23.4
  }, {
    rooms: 3,
    count: 8910,
    unit_price: 32.7,
    area: 35.6,
    avg_total: 1164,
    pct: 39.8
  }, {
    rooms: 4,
    count: 4520,
    unit_price: 30.1,
    area: 45.9,
    avg_total: 1381,
    pct: 20.2
  }, {
    rooms: 5,
    count: 1940,
    unit_price: 28.3,
    area: 58.4,
    avg_total: 1653,
    pct: 8.5
  }];

  // 24-month unit-price trend (萬/坪) + volume
  const months = [];
  let base = 30.2;
  for (let i = 0; i < 24; i++) {
    const y = 113 + Math.floor((i + 6) / 12);
    const m = (i + 6) % 12 + 1;
    base += Math.sin(i / 3) * 0.5 + 0.28 + (i > 16 ? 0.4 : 0);
    months.push({
      label: `${y}/${String(m).padStart(2, '0')}`,
      unit_price: +base.toFixed(1),
      volume: Math.round(1500 + Math.sin(i / 2) * 420 + i * 22)
    });
  }
  const cases = [{
    case_type: '預售',
    district: '永康區',
    name: '永康之心',
    total_count: 320,
    count: 268,
    sales_ratio: 84,
    common_ratio: 33,
    unit_price: 31.2,
    area: 38,
    avg_total: 1186
  }, {
    case_type: '成屋',
    district: '東區',
    name: '東寧寓所',
    total_count: 96,
    count: 96,
    sales_ratio: 100,
    common_ratio: 31,
    unit_price: 43.5,
    area: 32,
    avg_total: 1392
  }, {
    case_type: '預售',
    district: '中西區',
    name: '府城一號院',
    total_count: 168,
    count: 121,
    sales_ratio: 72,
    common_ratio: 34,
    unit_price: 48.9,
    area: 30,
    avg_total: 1467
  }, {
    case_type: '成屋',
    district: '安南區',
    name: '安南學區華廈',
    total_count: 144,
    count: 138,
    sales_ratio: 96,
    common_ratio: 30,
    unit_price: 25.6,
    area: 41,
    avg_total: 1050
  }, {
    case_type: '預售',
    district: '北區',
    name: '成功匯',
    total_count: 240,
    count: 156,
    sales_ratio: 65,
    common_ratio: 32,
    unit_price: 39.8,
    area: 34,
    avg_total: 1353
  }];
  const kpi = {
    total: 22430,
    avg_unit_price: 33.6,
    avg_area: 35.4,
    avg_total: 1189,
    total_sales: 1204
  };
  return {
    districts,
    types,
    rooms,
    months,
    cases,
    kpi
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.KpiCard = __ds_scope.KpiCard;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.StatBar = __ds_scope.StatBar;

__ds_ns.TabPills = __ds_scope.TabPills;

__ds_ns.ChatBubble = __ds_scope.ChatBubble;

__ds_ns.TypingDots = __ds_scope.TypingDots;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.TextInput = __ds_scope.TextInput;

})();
