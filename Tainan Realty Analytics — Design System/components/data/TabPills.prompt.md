Segmented pill tabs — the view switcher (數據看板 / 地圖) and section nav. Active pill takes the brass wash.

```jsx
<TabPills value={tab} onChange={setTab} tabs={[
  { value:'data', label:'數據看板', icon:'▦' },
  { value:'map',  label:'地圖',     icon:'◵' },
]} />
```

`tabs` accepts plain strings or `{value, label, icon}`. Controlled via `value` + `onChange`.
