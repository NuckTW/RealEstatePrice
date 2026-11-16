'use client'

import { useState, type ReactNode } from 'react'

export type SheetSnap = 'peek' | 'half' | 'full'

/** 三段高度：收合只露出標頭與 KPI、半開看清單、全開看詳情 */
const SNAP_HEIGHT: Record<SheetSnap, string> = {
  peek: 'var(--sheet-peek)',
  half: '52%',
  full: 'calc(100% - 16px)',
}
const ORDER: SheetSnap[] = ['peek', 'half', 'full']

/**
 * 手機版底部抽屜（放在相對定位的容器裡，貼齊容器底部）。
 * 拖曳把手切換三段高度；點把手則循環切換。
 */
export default function BottomSheet({ snap, onSnapChange, children }: {
  snap: SheetSnap
  onSnapChange: (s: SheetSnap) => void
  children: ReactNode
}) {
  // 拖曳中的起點與位移；null = 沒在拖
  const [drag, setDrag] = useState<{ y0: number; dy: number } | null>(null)

  const end = () => {
    if (!drag) return
    const i = ORDER.indexOf(snap)
    if (drag.dy < -40 && i < ORDER.length - 1) onSnapChange(ORDER[i + 1])
    else if (drag.dy > 40 && i > 0) onSnapChange(ORDER[i - 1])
    else if (Math.abs(drag.dy) <= 4) onSnapChange(ORDER[(i + 1) % ORDER.length])  // 點一下：循環切換
    setDrag(null)
  }

  return (
    <section aria-label="區域情報" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1100,
      height: `calc(${SNAP_HEIGHT[snap]} - ${drag?.dy ?? 0}px)`,
      transition: drag ? 'none' : 'height .24s var(--ease-standard)',
      background: 'var(--surface-card)', borderRadius: '18px 18px 0 0',
      boxShadow: '0 -10px 30px -12px rgba(0,0,0,.35)', borderTop: '1px solid var(--border-card)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <button
        type="button"
        aria-label={snap === 'full' ? '收合' : '展開'}
        onPointerDown={e => { setDrag({ y0: e.clientY, dy: 0 }); e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={e => { if (drag) setDrag({ y0: drag.y0, dy: e.clientY - drag.y0 }) }}
        onPointerUp={end}
        onPointerCancel={end}
        style={{
          flexShrink: 0, height: 22, border: 'none', background: 'transparent', cursor: 'grab',
          display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none',
        }}
      >
        <span style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
      </button>
      <div style={{ flex: 1, minHeight: 0, overflowY: snap === 'peek' ? 'hidden' : 'auto' }}>{children}</div>
    </section>
  )
}
