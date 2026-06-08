AI-chat message bubble — brass user / surface assistant, with optional collapsible generated-SQL block.

```jsx
<ChatBubble role="user">東區最近一年的平均房價是多少？</ChatBubble>
<ChatBubble role="assistant" sql={"SELECT AVG(unit_price)\nFROM deals\nWHERE district = '東區'"}>
  東區最近一年的平均單價約為 48.2 萬／坪。
</ChatBubble>
```

`role` defaults to "assistant". Pass `sql` to reveal the 查看 SQL disclosure.
