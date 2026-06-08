Data panel — the rounded card wrapping tables and charts. Brass tick + title + optional count, with right-aligned `actions`.

```jsx
<Panel title="行政區排行" count={37} actions={<Button size="sm" variant="ghost">匯出</Button>}>
  …chart or table…
</Panel>
<Panel title="類型統計" flush>{/* edge-to-edge table */}</Panel>
```

Use `flush` for tables that should reach the card edges. Omit `title` for a plain card.
