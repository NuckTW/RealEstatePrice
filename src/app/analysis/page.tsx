import { redirect } from 'next/navigation'

// 改版：數據分析併入「市場」頁的趨勢比較段落，舊網址導過去
export default function AnalysisPage() {
  redirect('/market#trend')
}
