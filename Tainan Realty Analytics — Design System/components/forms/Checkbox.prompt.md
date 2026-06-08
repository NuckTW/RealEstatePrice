Brass-fill checkbox with check glyph — the filter multi-select rows.

```jsx
<Checkbox checked={sel.includes('永康區')} onChange={() => toggle('永康區')}>
  永康區
</Checkbox>
```

Controlled: `onChange` receives the next boolean. Compose a list of these inside a dropdown for district / type / room multi-select.
