'use client'

import { useSyncExternalStore } from 'react'

/* ── AI 功能密碼（存 localStorage，換裝置需重輸；被 401 時清掉重問）──
 * AI 問答與潛在客群「自訂指數」共用同一組密碼與儲存位置，輸入一次兩邊都能用
 * 用 useSyncExternalStore 讀 localStorage：server snapshot 回 null（尚未 hydrate），client 回字串 */
const PW_KEY = 'tra_chat_pw'
const pwListeners = new Set<() => void>()

export function subscribePassword(cb: () => void) {
  pwListeners.add(cb)
  return () => { pwListeners.delete(cb) }
}
export function loadPassword(): string {
  try { return localStorage.getItem(PW_KEY) ?? '' } catch { return '' }
}
export function savePassword(pw: string) {
  try {
    if (pw) localStorage.setItem(PW_KEY, pw)
    else localStorage.removeItem(PW_KEY)
  } catch { /* private mode 等情況忽略 */ }
  pwListeners.forEach(cb => cb())
}
/** null = 尚未 hydrate；'' = 尚未輸入 */
export function usePassword(): string | null {
  return useSyncExternalStore(subscribePassword, loadPassword, () => null)
}
