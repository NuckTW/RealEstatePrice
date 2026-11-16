'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useSite } from './SiteContext'

// 打開抽屜才載入聊天元件（含 markdown、圖表），不拖慢其他頁面
const ChatInterface = dynamic(() => import('@/components/ChatInterface'), {
  ssr: false,
  loading: () => <div style={{ padding: 24, color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>載入中…</div>,
})

/** AI 問答抽屜：從右側滑出，不必離開目前頁面；手機上是全螢幕 */
export default function AiDrawer() {
  const { aiOpen, setAiOpen } = useSite()

  useEffect(() => {
    if (!aiOpen) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setAiOpen(false) }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [aiOpen, setAiOpen])

  if (!aiOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }}>
      <div onClick={() => setAiOpen(false)} aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} />
      <aside role="dialog" aria-modal="true" aria-label="AI 問答" className="tra-aidrawer" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(480px, 100vw)',
        background: 'var(--bg-app)', borderLeft: '1px solid var(--border-card)', boxShadow: 'var(--shadow-overlay)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-card)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-strong)' }}>AI 問答</span>
            <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>限內部使用（需要密碼）・用自然語言查詢實價登錄，自動產生圖表</span>
          </div>
          <button type="button" onClick={() => setAiOpen(false)} aria-label="關閉 AI 問答" className="tra-iconbtn">✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '8px 12px 12px' }}>
          <ChatInterface height="100%" />
        </div>
      </aside>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .tra-aidrawer { animation: tra-slide-in .22s var(--ease-standard); }
          @keyframes tra-slide-in { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
        }
      `}</style>
    </div>
  )
}
