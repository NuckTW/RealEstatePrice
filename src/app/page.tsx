import Navbar from '@/components/Navbar'
import DashboardClient from '@/components/DashboardClient'
import { fetchMeta } from '@/lib/queries/kpi'

// 預設篩選的迄月要對齊資料最新月，所以首頁改成 ISR：每小時重產一次，
// 與 cachedQuery 的 1 小時快取一致（scraper 每月 1、11、21 日才更新，時效足夠）
export const revalidate = 3600

/** 資料最新交易日（西元 YYYY-MM-DD）；查詢失敗回 null，Dashboard 會退回以今天月份當預設 */
async function getLastDate(): Promise<string | null> {
  try {
    const rows = await fetchMeta()
    return (rows[0]?.last_date as string | undefined) ?? null
  } catch {
    return null
  }
}

export default async function Home() {
  const lastDate = await getLastDate()
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-app)', color: 'var(--text-default)' }}>
      <Navbar />
      <DashboardClient lastDate={lastDate} />
      <footer style={{
        borderTop: '1px solid var(--border-card)',
        marginTop: 32,
        padding: '20px 0',
        textAlign: 'center',
        fontSize: 'var(--text-2xs)',
        color: 'var(--text-faint)',
        fontFamily: 'var(--font-sans)',
      }}>
        資料來源：內政部不動產交易實價查詢服務網 ｜ 僅供參考，不構成投資建議
      </footer>
    </main>
  )
}
