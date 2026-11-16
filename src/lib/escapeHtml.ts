/**
 * HTML 跳脫：Leaflet 的 bindPopup / bindTooltip / divIcon 會把字串當 HTML 插入，
 * 建案名稱、地址、自訂標籤等來自資料庫或使用者輸入的文字都要先經過這裡。
 */
export function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 放進 inline 事件屬性（onclick="fn('…')"）裡的字串參數：
 * 先做 JS 字串跳脫（反斜線、單引號、換行），再做 HTML 屬性跳脫。
 */
export function escapeJsAttr(v: unknown): string {
  const js = String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ')
  return escapeHtml(js)
}
