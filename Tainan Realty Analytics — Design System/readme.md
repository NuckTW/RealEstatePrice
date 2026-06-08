# 台南市不動產分析 — Design System
### Tainan Realty Analytics · "Brass & Clay"

A design system for **台南市不動產分析**, a Tainan City real-estate
price-registration (實價登錄) analytics dashboard. It visualises Ministry of the
Interior open transaction data and answers natural-language questions through a
Gemini-powered NL→SQL assistant.

> **This system re-skins the source product.** The live app ships a navy
> (`#080d16`) + violet/indigo theme. Per the briefs (`我要改變色系`, then `不要綠色主題`)
> the palette is re-anchored to Tainan's temple heritage: a warm, brown-tinted
> **ink** ground, a **brass** (amber) primary, and a terracotta **clay** secondary —
> confident and financial, with **no green** in the brand. The note (`增加數據分析`)
> is met by a net-new **趨勢分析 / Analytics** surface (trend, volume, distribution
> charts), and (`增加明或暗底的切換鈕`) by a full **light / dark theme** with a
> `ThemeToggle`.

### Sources used to build this system
- **Live product:** https://tainan-realestate-ai.vercel.app
- **Codebase:** https://github.com/NuckTW/RealEstatePrice — Next.js 16 + Tailwind v4,
  Supabase Postgres, Google Gemini 2.5 Flash, recharts, Leaflet. The token values,
  component anatomy, copy and layout here were lifted from this repo's
  `src/components/*` (Navbar, KpiBar, DataTable, FilterBar, Dashboard,
  ChatInterface). Browse it for deeper fidelity when extending this kit.

The data shown anywhere in this system is **representative mock data**, not the
real registry.

---

## CONTENT FUNDAMENTALS

**Language.** Traditional Chinese (繁體中文 / zh-Hant) is primary; English appears
only as a secondary label in this design guide. UI copy is Chinese throughout
(`套用篩選`, `清除`, `數據看板`, `成交戶數`).

**Calendar & units.** Dates use the **ROC / 民國 calendar** (`民國 110 年至今`,
`115年6月`) — convert Gregorian by subtracting 1911. Domain units are fixed and
always shown: `萬/坪` (unit price), `坪` (area), `萬` (total price), `億` (gross
sales), `戶` (unit count), `%` (share). Numbers are grouped with thousands commas
and set in mono with `tabular-nums`.

**Voice.** Calm, precise, civic-data tone — like a government open-data portal,
not a sales brokerage. No hype, no exclamation. The AI assistant is courteous and
first-person-helpful: *"您好！我是台南實價登錄 AI 助手… 請問您想了解什麼？"*. It uses 您
(formal "you"), never 你.

**Labels.** Field labels are terse 2–4 character nouns (`行政區`, `類型`, `房型`,
`屋齡`, `成／預售`). Column heads are micro-set, uppercase-tracked where Latin.
Empty states are gentle and literal: `無符合條件的資料`.

**Disclaimers.** Every data surface carries the provenance line:
*資料來源：內政部不動產交易實價查詢服務網｜資料僅供參考，不構成投資建議.*

**Emoji.** The source uses a few emoji in KPI cards (🏠📐📏💰📊) and tabs (🗺️). This
system **replaces them with monochrome geometric glyphs** (see Iconography) for a
more restrained, analytical feel — prefer glyphs over emoji in new work.

---

## VISUAL FOUNDATIONS

**Mood.** A dense, number-forward analytics console. Confident and financial,
warmed by brass and terracotta. Information per pixel is high; chrome is
quiet so the data bars and figures carry the colour. Ships dark by default with
a first-class light mode.

**Colour.** Warm, brown-tinted ink near-blacks (`--ink-900` app, `--ink-800` cards,
`--ink-750` controls) layered with translucent-white hairline borders
(`.06 / .09 / .14`). **Brass** (`--brass-500` solid, `--brass-400` tint) is the
primary accent — actions, active states, the first data series. **Clay**
(`--clay-500/400`) is the sparing terracotta secondary (avg-total KPI, brand
gradient end, highlights). An 8-colour categorical ramp (`--series-1…8`: brass,
clay, sky, plum, rose, teal, slate, sand) colours charts and table-bar columns —
refined, evenly-spaced hues, never neon, **no leafy green**. Status: positive =
teal (成屋), info = sky (預售), warning = amber, negative = red.

**Type.** **Geist** for Latin UI, **Noto Sans TC** for 中文 (declared first so CJK
never falls back), **Geist Mono** for all numbers, ROC dates and SQL. The scale is
compact (10 → 30px); KPI values are 24px bold mono with tight tracking. Micro
labels are 10px, uppercase, `.08em` tracked, in `--text-faint`.

**Spacing & radii.** 4px base step. Controls are tight (`10×6` padding, 28px
high); cards pad 16; page gutters 20; card-to-card gap 16. Radii ladder:
`6` bar · `8` button/select · `12` KPI · `16` panel · `20` dialog · `full` pills.

**Surfaces & cards.** Panels are `--ink-800` with a `.06` hairline border, 16px
radius and a near-invisible soft shadow + inset top highlight (`--shadow-card`) —
**lift comes from borders, not drop shadows.** Each panel header carries a small
brass gradient **tick** before the title and an optional mono count chip. KPI cards
add a tinted left accent rail.

**The signature element — data bars.** Numeric table cells render a *right-aligned
mono figure over a translucent value bar* (`--bar-fill-opacity .18`) with a bright
2px **leading-edge tick** (`.75`). Bar width encodes value / column-max. This is
the system's defining motif (see the *Data-bar anatomy* card and `StatBar`).

**Elevation & glow.** Dropdowns/dialogs use `--shadow-pop` / `--shadow-overlay`.
Glow is rationed: a brass `--glow-accent` only on the primary button and live
status dots; a `--glow-accent-sm` focus ring on inputs.

**Glass.** The sticky `Navbar` and `FilterBar` sit on `--chrome-bg` (ink-900 @85%)
with `saturate(140%) blur(16px)` — content scrolls translucently beneath.

**Gradients.** Used deliberately, not decoratively: `--gradient-accent`
(brass→deep-brass) on the primary button and panel ticks; `--gradient-brand`
(brass→clay) only on the 南 brand mark. No full-bleed background gradients.

**Theming — light / dark.** Every component reads *semantic aliases*
(`--surface-*`, `--text-*`, `--accent-*`, `--border-*`, `--chrome-bg`, shadows),
never raw scales. Those aliases are defined twice: a dark default on `:root` and a
light override on `:root[data-theme="light"]`. The `ThemeToggle` flips
`data-theme` on `<html>` and persists to `localStorage`, so the whole token system
re-themes at once. Raw scales (brass/clay/series) stay fixed; only `--accent-tint`
darkens (brass-400 → brass-700) so amber text stays legible on light surfaces. The
brass button fill and its dark `--on-accent` text are identical in both modes.

**Motion.** Restrained. `--dur-base 180ms` with `--ease-standard` for hovers and
toggles; a 1.1s thinking-dot bounce and a 1.8s live-dot pulse are the only loops.
Hover = lighten surface / brighten border / raise text contrast. Press on the
primary = brightness down. Filter tags invert to **red** on hover to signal
removal. No bounce, no parallax, no scroll-jacking.

**Imagery.** The product is chart-and-table first; there is **no photography**.
"Imagery" is the data viz itself. The only branded graphic is the 南 glyph mark.

---

## ICONOGRAPHY

The source product **ships no icon library**. Its icon language is monochrome
**Unicode geometric glyphs** plus a few emoji. This system standardises on the
glyphs (dropping the emoji) — they're weightless, theme-aware (they take
`currentColor`, tinted `--accent-tint` in nav/KPIs), and match the analytical
tone. See the *Iconography — glyph set* card.

Working vocabulary: `▦` 看板 · `◈` 趨勢 · `◇` 問答 · `◳` 單價 · `◰` 坪數 · `◆` 總價 ·
`↗ ↘` 漲跌 · `◵` 地圖 · `‹ › ▾` 導覽 · `×` 移除 · `◌` 無資料 · `●` 狀態點 · `南` 品牌.

- **Brand mark:** the `南` (Tainan) CJK glyph in a rounded square with the
  brass→clay `--gradient-brand` and a brass glow. It's a CSS/text construct, not an
  image asset — recreate it, don't rasterise it. See *Brand mark & lockup*.
- **No raster logo / SVG sprite exists** in the source repo (only stock Next.js
  starter SVGs, which are not brand assets and were intentionally not imported).
- **Substitution flag:** for production surfaces needing richer icons (export,
  settings, filters), the suggested CDN match is **Lucide** (`lucide.dev`,
  1.5–2px stroke, rounded — consistent with this UI's weight). Flag any Lucide use
  in handoff. Do **not** hand-draw SVG icons or introduce emoji.

---

## VISUAL SUBSTITUTIONS — please confirm
- **Fonts are loaded from Google Fonts CDN** (`Geist`, `Geist Mono`, `Noto Sans
  TC`) rather than self-hosted binaries — the full Traditional-Chinese glyph set
  is several MB per weight. If you need a fully offline bundle, drop the `.woff2`
  files in and swap `tokens/fonts.css` for `@font-face` rules. *Geist & Geist Mono
  match the source exactly; Noto Sans TC is added as the canonical CJK face.*
- **The colour system is new by request** — confirm brass/clay-on-ink reads right
  for your audience (in both light and dark) before we propagate it further.

---

## INDEX / MANIFEST

**Root**
- `styles.css` — the single entry consumers link (`@import`s the tokens below).
- `readme.md` — this guide. · `SKILL.md` — Agent-Skill wrapper.

**`tokens/`** — `fonts.css` · `colors.css` (Brass & Clay, dark + light themes) ·
`typography.css` · `spacing.css` · `elevation.css` · `base.css`.

**`guidelines/`** — foundation specimen cards (Design System tab):
colour (brass · clay · ink · series · semantic), type (families · scale),
spacing (scale · radii · elevation), brand (mark · data-bar · iconography).

**`components/`** — React primitives (namespace
`window.TainanRealtyAnalyticsDesignSystem_e1be47`):
- `core/` — **Button**, **Badge**, **Tag**, **ThemeToggle**
- `forms/` — **Select**, **TextInput**, **Checkbox**
- `data/` — **Panel**, **KpiCard**, **StatBar**, **TabPills**
- `feedback/` — **ChatBubble**, **TypingDots**

**`ui_kits/dashboard/`** — interactive recreation of the full product
(`index.html`): 數據看板 / 趨勢分析 / AI 問答. See its own `README.md`.

Starting points (consuming-project picker): `Button`, `Panel`, `KpiCard`.
