KPI stat card — label, big mono value, unit, tinted accent rail, optional signed delta.

```jsx
<KpiCard label="成交戶數" value="28,431" unit="戶" tone="brass" delta="+4.2%" />
<KpiCard label="均單價" value="41.6" unit="萬/坪" tone="sky" />
<KpiCard label="總銷售額" value="1,204" unit="億" tone="clay" />
```

Tones: `brass`, `clay`, `sky`, `coral`, `positive` (or any CSS colour). `value` is pre-formatted — keep thousands separators. A `+` delta renders teal-green, `-` red. Lay out 5-up in a grid.
