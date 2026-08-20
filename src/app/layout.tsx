import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoSansTC = Noto_Sans_TC({ variable: "--font-noto-tc", subsets: ["latin"], weight: ["300","400","500","700"] });

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
    <html lang="zh-Hant" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
