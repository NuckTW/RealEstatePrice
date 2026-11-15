'use client'

import { useEffect, useState } from 'react'

/*
 * 資料最新交易日（西元 'YYYY-MM-DD'）。
 * 多個圖表元件都需要它來標示補登期，用模組層級的 promise 快取，
 * 同一頁不管幾個元件呼叫都只打一次 /api/meta。
 */
let cached: Promise<string | null> | null = null

function loadLastDataDate(): Promise<string | null> {
  if (!cached) {
    cached = fetch('/api/meta')
      .then(r => r.json())
      .then(d => (typeof d.last_date === 'string' ? d.last_date : null))
      .catch(() => {
        cached = null // 失敗不快取，下次重試
        return null
      })
  }
  return cached
}

export function useLastDataDate(): string | null {
  const [date, setDate] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadLastDataDate().then(d => { if (alive) setDate(d) })
    return () => { alive = false }
  }, [])
  return date
}
