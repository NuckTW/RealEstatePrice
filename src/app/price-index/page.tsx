import { redirect } from 'next/navigation'

// 改版：住宅價格指數併入「市場」頁，舊網址導過去
export default function PriceIndexPage() {
  redirect('/market#index')
}
