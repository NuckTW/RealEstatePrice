---
name: tainan-realty-design
description: Use this skill to generate well-branded interfaces and assets for 台南市不動產分析 (Tainan Realty Analytics), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors (the "Brass & Clay" palette), type, fonts, assets, and UI kit components for prototyping real-estate price-registration dashboards, data-analysis charts, and the Gemini AI Q&A surface.
user-invocable: true
---

Read the `readme.md` file within this skill first — it carries the full product
context, the "Brass & Clay" colour system, content/voice rules, visual foundations,
and iconography. Then explore the other files:

- `styles.css` + `tokens/*` — link `styles.css` to inherit every colour, type,
  spacing, elevation token and the webfonts.
- `components/*` — React primitives (Button, Badge, Tag, Select, TextInput,
  Checkbox, Panel, KpiCard, StatBar, TabPills, ChatBubble, TypingDots). Each has a
  `.prompt.md` with a one-line "what & when" and a usage snippet.
- `ui_kits/dashboard/*` — a full interactive recreation of the product (dashboard,
  analytics charts, AI Q&A). Copy screens or `charts.jsx` as a starting point.
- `guidelines/*` — foundation specimen cards.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy the
assets/tokens out and produce static HTML files for the user to view. If working
on production code, copy assets and apply the rules here to design as a brand
expert.

Conventions that matter for this brand: Traditional Chinese (繁體中文) copy, the
民國/ROC calendar, fixed domain units (萬/坪, 坪, 萬, 億, 戶), mono `tabular-nums`
for all figures, monochrome geometric glyph icons (no emoji), dark ink surfaces
lifted by hairline borders, and the signature translucent **data-bar** table cell.
Colour comes from brass (primary) + clay (secondary) + the 8-step `--series-*` ramp.

If the user invokes this skill without other guidance, ask what they want to build
or design, ask a few focused questions, then act as an expert designer who outputs
HTML artifacts _or_ production code as needed.
