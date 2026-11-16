import { redirect } from 'next/navigation'

// 改版：建案搜尋併入「建案」頁的搜尋框；保留 ?q= 關鍵字
export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { q } = await searchParams
  redirect(typeof q === 'string' && q ? `/projects?q=${encodeURIComponent(q)}` : '/projects')
}
