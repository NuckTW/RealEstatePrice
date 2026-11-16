import { redirect } from 'next/navigation'

// 改版：市場供給面併入「市場」頁，舊網址導過去
export default function SupplyPage() {
  redirect('/market#supply')
}
