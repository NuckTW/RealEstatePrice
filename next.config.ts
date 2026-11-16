import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/*
 * Content-Security-Policy
 * 頁面都是靜態產生（無法用 nonce），而且站上有 inline script（layout 的主題還原、地圖 popup 的 onclick），
 * 所以 script-src 仍需 'unsafe-inline'；CSP 在這裡的作用是限制「可以載入哪些來源」：
 *   - script 只能來自本站（擋掉注入外部 script）
 *   - 連線（fetch / WebSocket）只能打本站 API
 *   - 禁止被其他網站用 iframe 嵌入、禁止 <object>、限制 <base> 與表單送出目標
 * 新增外部資源時要同步更新這裡，否則瀏覽器會擋掉：
 *   - Google Fonts（Noto Sans TC）：style 來自 fonts.googleapis.com、字型檔來自 fonts.gstatic.com
 *   - Leaflet 的 CSS 與標記圖示：unpkg.com
 *   - 地圖圖磚：*.tile.openstreetmap.org
 *   - data: / blob:：圖表匯出 PNG、Leaflet 內建圖示
 * 開發模式另外放行 'unsafe-eval'（React 除錯用）與 HMR 的 WebSocket。
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com",
  "font-src 'self' https://fonts.gstatic.com",
  `connect-src 'self'${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // 正式站才強制升級成 https（本機是 http）
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // 舊瀏覽器不認 frame-ancestors，用這個擋 iframe 嵌入（防 clickjacking）
  { key: "X-Frame-Options", value: "DENY" },
  // 禁止瀏覽器猜測 MIME type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 連到外站時只帶來源網域，不帶完整網址（篩選條件在 query string 裡）
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 站上沒用到的瀏覽器功能一律關閉
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // 強制 https 兩年（只在 https 連線下生效，本機 http 不受影響）
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // 不對外透露使用的框架
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
