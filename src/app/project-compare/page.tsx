import { redirect } from 'next/navigation'

// 改版：建案比較併入「建案」頁；保留 ?projects=（比較籃）等參數
export default async function ProjectComparePage({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') p.set(k, v)
  }
  const qs = p.toString()
  redirect(`/projects${qs ? `?${qs}` : ''}`)
}
