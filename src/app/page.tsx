import HomeClient from '@/components/map/HomeClient'

/**
 * 首頁「行情地圖」：App 式地圖工作台（左地圖、右情報欄）。
 * 導覽列、篩選列、資料最新月都由 root layout 的 SiteShell 提供。
 * 原本首頁的「數據看板」（KPI、統計、明細）已搬到 /market 的概況段落，
 * 「框選分析」則併入地圖的框選／落點工具。
 */
export default function Home() {
  return <HomeClient />
}
