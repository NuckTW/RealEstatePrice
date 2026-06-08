Inline data bar for table cells — translucent fill, leading-edge tick, right-aligned mono value.

```jsx
<StatBar value="3,184" pct={92} color="var(--series-1)" />
<StatBar value="41.6" pct={64} color="var(--series-3)" minWidth={72} />
```

Compute `pct` as `value / columnMax * 100`. Use a consistent `--series-*` colour per column. `align="left"` for label-leading bars.
