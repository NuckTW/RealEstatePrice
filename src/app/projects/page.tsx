import { Suspense } from 'react'
import type { Metadata } from 'next'
import ProjectsPanel from '@/components/projects/ProjectsPanel'

export const metadata: Metadata = {
  title: '建案｜台南市不動產分析',
  description: '台南預售與成屋建案的中位單價、坪數、總價排行與多案比較。',
}

export default function ProjectsPage() {
  // ProjectsPanel 透過 useSearchParams 讀篩選與比較籃，靜態預產需要 Suspense 邊界
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>載入中…</div>}>
      <ProjectsPanel />
    </Suspense>
  )
}
