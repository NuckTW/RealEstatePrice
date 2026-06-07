'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
}

const SUGGESTIONS = [
  '東區最近一年的平均房價是多少？',
  '永康區透天厝的均價趨勢如何？',
  '台南哪個行政區交易量最多？',
  '2024年各行政區平均單價排名',
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '您好！我是台南實價登錄 AI 助手\n\n我可以幫您查詢台南市 2021 年至今的實價登錄資料，例如各行政區均價、交易趨勢、特定建物型態的行情等。請問您想了解什麼？',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSql, setShowSql] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const question = (text || input).trim()
    if (!question || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.error || data.answer,
        sql: data.sql,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '連線發生問題，請稍後再試。',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 600,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>
      {/* 訊息區 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: '11px 15px',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-sm)',
              lineHeight: 'var(--leading-normal)',
              fontFamily: 'var(--font-sans)',
              ...(msg.role === 'user' ? {
                background: 'var(--accent-wash)',
                border: '1px solid var(--accent-wash-border)',
                color: 'var(--accent-tint)',
                borderBottomRightRadius: 'var(--radius-sm)',
              } : {
                background: 'var(--surface-control)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-default)',
                borderBottomLeftRadius: 'var(--radius-sm)',
              })
            }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              {msg.sql && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => setShowSql(showSql === i ? null : i)}
                    style={{
                      fontSize: 11, color: 'var(--accent-tint)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {showSql === i ? '▲ 收起 SQL' : '▼ 查看 SQL'}
                  </button>
                  {showSql === i && (
                    <pre style={{
                      marginTop: 8, padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--ink-950)',
                      border: '1px solid var(--border-control)',
                      fontSize: 11, color: 'var(--brass-300)',
                      fontFamily: 'var(--font-mono)',
                      overflowX: 'auto', whiteSpace: 'pre',
                    }}>
                      {msg.sql}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              background: 'var(--surface-control)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              borderBottomLeftRadius: 'var(--radius-sm)',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 150, 300].map(delay => (
                  <span key={delay} style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    display: 'inline-block',
                    animation: 'tra-bounce 1.1s ease-in-out infinite',
                    animationDelay: `${delay}ms`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 建議問題 */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 10px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              style={{
                fontSize: 11, fontFamily: 'var(--font-sans)',
                background: 'var(--surface-control)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-control)',
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px',
                cursor: 'pointer',
                transition: 'var(--transition-base)',
              }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-default)'; el.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'var(--border-control)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 輸入區 */}
      <div style={{ padding: 16, borderTop: '1px solid var(--border-card)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="輸入問題，例如：東區今年平均單價是多少？"
            disabled={loading}
            style={{
              flex: 1,
              background: 'var(--surface-control)',
              color: 'var(--text-default)',
              border: '1px solid var(--border-control)',
              borderRadius: 'var(--radius-md)',
              padding: '0 16px',
              height: 40,
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'var(--transition-base)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = 'var(--glow-accent-sm)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-control)'; e.currentTarget.style.boxShadow = 'none' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              height: 40, padding: '0 20px',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
              fontFamily: 'var(--font-sans)',
              background: 'var(--gradient-accent)',
              color: 'var(--on-accent)',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !input.trim() ? 0.45 : 1,
              boxShadow: 'var(--glow-accent)',
              transition: 'var(--transition-base)',
            }}
          >
            送出
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tra-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
