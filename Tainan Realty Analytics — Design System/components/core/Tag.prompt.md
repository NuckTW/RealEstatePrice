Active-filter chip — brass by default; pass `onRemove` to make it a removable filter tag (hovers to red).

```jsx
<Tag>不限屋齡</Tag>
<Tag onRemove={() => drop('永康區')}>永康區</Tag>
```

Renders above data tables to show applied districts / types / rooms. The removable variant turns the whole chip red on hover to signal deletion.
