Styled native select with custom chevron — the filter-bar dropdown. Pass `label` for a stacked micro-label.

```jsx
<Select label="屋齡" value={age} onChange={setAge}
  options={[{label:'不限屋齡',value:'all'},{label:'5年以內',value:'5'}]} />
<Select value={year} onChange={setYear} options={['114年','115年']} />
```

`options` accepts plain strings or `{label, value}`. `onChange` returns the value string directly.
