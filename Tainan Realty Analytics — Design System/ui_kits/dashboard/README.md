# 台南儀表板 — UI Kit

Interactive recreation of the **台南市不動產分析** product (Tainan real-estate
price-registration analytics), rebuilt on the *Brass & Clay* palette and extended
with a dedicated analytics surface per the brief (`增加數據分析`).

Open `index.html` — it boots the full app:

| View | File | What it shows |
|------|------|---------------|
| 數據看板 Dashboard | `DashboardScreen.jsx` | KPI row + 行政區 / 類型 / 房型 / 個案 bar-cell tables |
| 趨勢分析 Analytics | `AnalyticsScreen.jsx` | **New** — unit-price & volume trend, district bars, type donut |
| AI 問答 Chat | `ChatScreen.jsx` | Gemini-style NL→SQL Q&A with canned answers |

Chrome: `Navbar.jsx` (brand + live-data badge + view nav) and `FilterBar.jsx`
(date range, multi-select 行政區/類型, 成/預售, 屋齡, apply/clear).

### How it's wired
- `data.js` — representative mock data (`window.TRA_DATA`). **Not real registry data.**
- `charts.jsx` — lightweight SVG `LineChart` / `BarChart` / `DonutChart` (series-token colours).
- Every screen composes the DS primitives from the bundle
  (`window.TainanRealtyAnalyticsDesignSystem_e1be47`): `KpiCard`, `Panel`,
  `StatBar`, `TabPills`, `Tag`, `Badge`, `Select`, `Checkbox`, `TextInput`,
  `Button`, `ChatBubble`, `TypingDots`.

### Fidelity notes
- Layout, density, the sticky filter bar, the bar-cell table pattern and the
  chat SQL-disclosure all mirror the original code. **Colour is intentionally
  changed** (brass/clay on ink, was violet on navy).
- The Analytics view is a net-new surface — the original ships tables + a Leaflet
  map; charts here use the product's `recharts` data shapes rendered as plain SVG.
- The Leaflet map view is omitted (no map tiles in a static kit).
