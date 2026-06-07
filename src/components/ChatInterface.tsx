'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { ChartConfig } from '@/app/api/chat/route'

const ChatChart = dynamic(() => import('./ChatChart'), { ssr: false })

/* ── Types ─────────────────────────────────────────────── */
interface Message {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  rows?: Record<string, unknown>[]
  chart?: ChartConfig | null
  streaming?: boolean
  error?: boolean
}

/* ── Suggestions ───────────────────────────────────────── */
const SUGGESTIONS = [
  '東區最近一年的平均單價是多少？',
  '永康區透天厝的均價趨勢如何？',
  '各行政區交易量排名',
  '2024年預售屋 vs 成屋均價比較',
]

/* ── Helpers ───────────────────────────────────────────── */
function thStyle(): React.CSSProperties {
  return {
    padding: '6px 10px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--text-faint)',
    background: 'var(--surface-card)',
    borderBottom: '1px solid var(--border-card)',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
  }
}

function tdStyle(numeric = false): React.CSSProperties {
  return {
    padding: '5px 10px',
    fontSize: 11,
    color: numeric ? 'var(--text-strong)' : 'var(--text-default)',
    fontFamily: numeric ? 'var(--font-mono)' : 'var(--font-sans)',
    borderBottom: '1px solid var(--border-card)',
    whiteSpace: 'nowrap',
  }
}

function isNumeric(v: unknown) {
  return typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v !== '')
}

/* ── Mini DataTable ─────────────────────────────────────── */
function MiniTable({ rows }: { rows: Record<string, unknown>[] }) {
  const [expanded, setExpanded] = useState(false)
  if (!rows.length) return null

  const keys = Object.keys(rows[0])
  const displayRows = expanded ? rows : rows.slice(0, 5)
  const hasMore = rows.length > 5

  return (
    <div style={{ marginTop: 10, overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {keys.map(k => <th key={k} style={thStyle()}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? 'var(--bg-sunken)' : 'transparent' }}>
              {keys.map(k => (
                <td key={k} style={tdStyle(isNumeric(row[k]))}>
                  {row[k] == null ? '—' : String(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', padding: '5px', fontSize: 10,
            color: 'var(--text-muted)', background: 'var(--surface-card)',
            border: 'none', borderTop: '1px solid var(--border-card)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {expanded ? `▲ 收起（共 ${rows.length} 筆）` : `▼ 顯示全部 ${rows.length} 筆`}
        </button>
      )}
    </div>
  )
}

/* ── Message Bubble ─────────────────────────────────────── */
function MessageBubble({ msg }: {
  msg: Message
}) {
  const isUser = msg.role === 'user'

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
      {/* AI avatar */}
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: 'var(--gradient-brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--on-accent)', fontWeight: 700,
          fontFamily: 'var(--font-sans)', marginTop: 2,
        }}>南</div>
      )}

      <div style={{ maxWidth: '88%', minWidth: 0 }}>
        {/* Main bubble */}
        <div style={{
          padding: '11px 15px',
          borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-sm)',
          lineHeight: 'var(--leading-normal)',
          fontFamily: 'var(--font-sans)',
          ...(isUser ? {
            background: 'var(--accent-wash)',
            border: '1px solid var(--accent-wash-border)',
            color: 'var(--accent-tint)',
            borderBottomRightRadius: 'var(--radius-sm)',
          } : {
            background: 'var(--surface-control)',
            border: '1px solid var(--border-card)',
            color: msg.error ? 'var(--negative)' : 'var(--text-default)',
            borderBottomLeftRadius: 'var(--radius-sm)',
          })
        }}>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {msg.content}
            {msg.streaming && (
              <span style={{
                display: 'inline-block', width: 2, height: '1em',
                background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom',
                animation: 'tra-blink .7s step-end infinite',
              }} />
            )}
          </div>

          {/* Chart */}
          {!isUser && msg.chart && msg.rows && msg.rows.length >= 2 && (
            <ChatChart rows={msg.rows} chart={msg.chart} />
          )}

          {/* Data table (when no chart, but has rows) */}
          {!isUser && !msg.chart && msg.rows && msg.rows.length > 0 && (
            <MiniTable rows={msg.rows} />
          )}

        </div>

        {/* Row count badge */}
        {!isUser && msg.rows && msg.rows.length > 0 && !msg.streaming && (
          <div style={{
            marginTop: 4, fontSize: 10, color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)', paddingLeft: 2,
          }}>
            {msg.rows.length} 筆資料
            {msg.chart ? `　${msg.chart.type === 'bar' ? '▦' : '〜'} 已視覺化` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────── */
export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '您好！我是台南實價登錄 AI 助手\n\n可幫您查詢 2021 年至今的實價資料，例如各行政區均價、交易趨勢、特定建物行情等。支援多輪對話，可以追問「那永康區呢？」',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text?: string) => {
    const question = (text || input).trim()
    if (!question || loading) return
    setInput('')

    // 準備對話歷史（送 API 用，只含 role+content）
    const history = messages
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }))

    // 加入使用者訊息
    setMessages(prev => [...prev, { role: 'user', content: question }])

    // 加入 AI placeholder（streaming 中）
    const aiIdx = history.length + 1  // 使用者在前
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      streaming: true,
    }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })

      if (!res.body) throw new Error('no body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const updateLast = (updater: (m: Message) => Partial<Message>) => {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, ...updater(last) }
          }
          return next
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let event: Record<string, unknown>
          try { event = JSON.parse(line) } catch { continue }

          switch (event.type) {
            case 'sql':
              updateLast(() => ({ sql: event.sql as string }))
              break
            case 'rows':
              updateLast(() => ({
                rows: event.rows as Record<string, unknown>[],
                chart: (event.chart as ChartConfig | null) ?? null,
              }))
              break
            case 'text':
              updateLast(m => ({ content: m.content + (event.delta as string) }))
              break
            case 'error':
              updateLast(() => ({ content: event.message as string, error: true, streaming: false }))
              break
            case 'done':
              updateLast(() => ({ streaming: false }))
              break
          }
        }
      }

      // 確保 streaming 結束
      updateLast(() => ({ streaming: false }))

    } catch {
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: '連線發生問題，請稍後再試。', streaming: false, error: true }
        }
        return next
      })
    } finally {
      setLoading(false)
    }

    void aiIdx // suppress unused warning
  }, [input, loading, messages])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 640,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>

      {/* ── 訊息列表 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* 載入中（SQL 生成期間） */}
        {loading && messages[messages.length - 1]?.content === '' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 36 }}>
            <div style={{
              background: 'var(--surface-control)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              borderBottomLeftRadius: 'var(--radius-sm)',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 150, 300].map(delay => (
                  <span key={delay} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--text-muted)', display: 'inline-block',
                    animation: 'tra-bounce 1.1s ease-in-out infinite',
                    animationDelay: `${delay}ms`,
                  }} />
                ))}
                <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 6, fontFamily: 'var(--font-sans)' }}>
                  生成中…
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── 建議問題 ── */}
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
                cursor: 'pointer', transition: 'var(--transition-base)',
              }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-default)'; el.style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'var(--border-control)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── 輸入區 ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-card)' }}>
        {/* 對話輪數指示 */}
        {messages.length > 1 && (
          <div style={{ marginBottom: 6, fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
            ◎ 支援追問 ·{' '}
            <button
              onClick={() => setMessages(msgs => [msgs[0]])}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-sans)', padding: 0, textDecoration: 'underline' }}
            >
              清除對話
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="輸入問題，可追問上一輪…"
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
              fontSize: 'var(--text-sm)', fontWeight: 600,
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
        @keyframes tra-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
