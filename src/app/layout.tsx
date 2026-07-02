import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const notoSansTC = Noto_Sans_TC({ variable: "--font-noto-tc", subsets: ["latin"], weight: ["300","400","500","700"] });

export const metadata: Metadata = {
  title: "台南市實價登錄 AI 分析助手",
  description: "台南市實價登錄資料視覺化看板，搭配 AI 自然語言查詢",
};

// 在 HTML 解析前套用儲存的主題，避免 flash
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('tra-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme','light');
  } catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning：themeScript 在 hydration 前就會改 data-theme，屬預期差異
    <html lang="zh-Hant" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
