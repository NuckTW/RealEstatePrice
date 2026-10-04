import type { Metadata } from "next";
import "./globals.css";

/*
 * 字型載入（不使用 next/font，build 時不需連線下載字型）：
 * - Geist、Geist Mono：latin 子集放在 public/fonts，由 globals.css 的 @font-face 宣告
 * - Noto Sans TC：中文字型完整檔每個字重 4–7 MB，不適合放進專案；改由瀏覽器在執行時
 *   向 Google Fonts 載入（依 unicode-range 只下載用到的字），呈現與原本 next/font 相同
 *   原本 next/font 在 build 時需下載約百個中文子集檔，網路不穩就會 build 失敗
 */
const NOTO_SANS_TC_CSS = "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap";

const SITE_URL  = "https://tainan-realestate-ai.vercel.app";
const SITE_DESC = "台南預售屋價格地圖：實價登錄視覺化、建案銷售成數、行政區價格走勢與市場供給，每 10 天自動更新。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "台南市不動產分析｜預售屋價格地圖",
  description: SITE_DESC,
  openGraph: {
    title: "台南預售屋價格地圖",
    description: SITE_DESC,
    url: SITE_URL,
    siteName: "台南市不動產分析",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "台南預售屋價格地圖",
    description: SITE_DESC,
    images: ["/og.png"],
  },
};

// 在 HTML 解析前套用儲存的主題與字級，避免 flash（先小字再跳大字的閃爍）
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('tra-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme','light');
    var f = localStorage.getItem('tra-fontsize');
    if (f === 'medium' || f === 'large') document.documentElement.setAttribute('data-fontsize', f);
  } catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning：themeScript 在 hydration 前就會改 data-theme / data-fontsize，屬預期差異
    <html lang="zh-Hant" suppressHydrationWarning className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preload" href="/fonts/Geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={NOTO_SANS_TC_CSS} />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
