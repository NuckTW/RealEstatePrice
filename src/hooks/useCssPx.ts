'use client'

import { useEffect, useState } from 'react'

/**
 * 讀取 CSS 變數換算後的實際 px 數值。
 *
 * 用途：Recharts 的座標軸刻度（tick）與 <Label> 是畫在 SVG 座標系裡的文字，
 * Recharts 內部會用 canvas 量測文字寬度來做刻度防重疊/自動換行等版面計算，
 * 而 canvas 的 font 字串不吃 CSS `var(...)`，所以這類 prop 不能直接塞
 * `'var(--text-xs)'` 字串，必須傳真正的數字 px。
 *
 * 這個 hook 在掛載時讀一次 --font-scale 換算後的實際值，並用 MutationObserver
 * 監聽 <html data-fontsize> 屬性變化，字級切換時重新讀取、觸發元件重繪，
 * 讓圖表的軸標籤字級跟著全站字級縮放同步。
 */
export function useCssPx(varName: string, fallback: number): number {
  const [px, setPx] = useState(fallback)

  useEffect(() => {
    if (typeof document === 'undefined') return

    // 不能直接讀 getPropertyValue(varName)：custom property 回傳的是「宣告原文」，
    // 也就是 "calc(10px * var(--font-scale))" 這種字串，parseFloat 會得到 NaN，
    // 結果永遠停在 fallback、字級切換完全不生效。
    // 改用一個離屏探針元素把變數套進真正的 font-size，讓瀏覽器解析完 calc()
    // 之後再從 computed style 讀出實際 px。
    const read = () => {
      const probe = document.createElement('span')
      probe.style.cssText =
        `position:absolute;visibility:hidden;pointer-events:none;font-size:var(${varName})`
      document.body.appendChild(probe)
      const parsed = parseFloat(getComputedStyle(probe).fontSize)
      probe.remove()
      if (!Number.isNaN(parsed)) setPx(parsed)
    }

    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-fontsize'] })
    return () => observer.disconnect()
  }, [varName])

  return px
}
