Primary action button — brass gradient with glow; use for the main affirmative action (套用篩選 / 送出), quiet variants for secondary actions.

```jsx
<Button variant="primary" onClick={apply}>套用篩選</Button>
<Button variant="secondary" size="sm">清除</Button>
<Button variant="primary" loading>載入中</Button>
<Button variant="ghost" icon={<span>＋</span>}>新增條件</Button>
```

Variants: `primary` (default, brass gradient + glow), `secondary` (surface), `ghost`, `danger`. Sizes: `sm` (28px), `md` (32px), `lg` (40px). Pass `loading` to show a spinner and disable.
