/* AI Q&A screen — natural-language → SQL → answer.
   Composes ChatBubble, TypingDots, TextInput, Button from the DS bundle. */
function ChatScreen() {
  const { ChatBubble, TypingDots, TextInput, Button } = window.TainanRealtyAnalyticsDesignSystem_e1be47;
  const SUGGESTIONS = [
    '東區最近一年的平均房價是多少？',
    '永康區透天厝的均價趨勢如何？',
    '台南哪個行政區交易量最多？',
    '2024年各行政區平均單價排名',
  ];
  const CANNED = {
    default: {
      text: '依實價登錄資料，該條件下的平均單價約為 33.6 萬／坪，成交量以永康區（3,184 戶）居首。下方為產生的查詢。',
      sql: "SELECT district, AVG(unit_price) AS avg_price, COUNT(*) AS n\nFROM deals\nWHERE deal_date BETWEEN '2024-06-01' AND '2025-06-30'\nGROUP BY district\nORDER BY n DESC;",
    },
  };
  const [messages, setMessages] = React.useState([
    { role: 'assistant', text: '您好！我是台南實價登錄 AI 助手。\n我可查詢台南市民國 110 年至今的實價登錄資料 — 各行政區均價、交易趨勢、特定建物型態行情等。請問您想了解什麼？' },
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const feedRef = React.useRef(null);

  React.useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, loading]);

  const send = (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((p) => [...p, { role: 'user', text: q }]);
    setLoading(true);
    setTimeout(() => {
      const a = CANNED.default;
      setMessages((p) => [...p, { role: 'assistant', text: a.text, sql: a.sql }]);
      setLoading(false);
    }, 1100);
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px', height: 'calc(100vh - var(--nav-h))', display: 'flex', flexDirection: 'column' }}>
      <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 10 }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} sql={msg.sql}>{msg.text}</ChatBubble>
        ))}
        {loading && <TypingDots />}
      </div>

      {messages.length <= 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} style={{
              font: '12px var(--font-sans)', color: 'var(--text-default)',
              background: 'var(--surface-control)', border: '1px solid var(--border-control)',
              borderRadius: 'var(--radius-full)', padding: '7px 13px', cursor: 'pointer', transition: 'var(--transition-base)',
            }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TextInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="輸入問題，例如：東區今年平均單價是多少？"
          wrapStyle={{ flex: 1 }}
        />
        <Button variant="primary" size="lg" onClick={() => send()} disabled={!input.trim() || loading}>送出</Button>
      </div>
      <p style={{ font: '10px var(--font-sans)', color: 'var(--text-faint)', textAlign: 'center', marginTop: 10 }}>
        資料來源：內政部不動產交易實價查詢服務網｜AI 回答僅供參考，不構成投資建議
      </p>
    </div>
  );
}
window.ChatScreen = ChatScreen;
