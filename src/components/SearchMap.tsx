'use client'

import { useEffect, useRef } from 'react'
import type * as L from 'leaflet'

interface Props {
  lat: number
  lon: number
  name: string
}

/**
 * 建案搜尋頁的單一標記地圖。
 * 只顯示一個定位點，不需要 cluster / heatmap，圖磚與初始化方式沿用 MapView.tsx。
 * 由父層以 key={project.key} 掛載，換建案時整個元件會重新 mount，
 * 不需要在 effect 內處理座標變動，維持跟 MapView 一致的「只跑一次」寫法。
 */
export default function SearchMap({ lat, lon, name }: Props) {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return

    let cancelled = false

    ;(async () => {
      const Lx = (await import('leaflet')).default as typeof L

      if (cancelled || !mapRef.current) return

      // CSS（跟 MapView 共用同一份 leaflet.css，重複掛載會被 id 擋掉）
      if (!document.querySelector('#leaflet-css')) {
        const l = document.createElement('link')
        l.id = 'leaflet-css'; l.rel = 'stylesheet'
        l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(l)
      }

      // 修正預設圖示路徑（同 MapView 的作法）
      const Icons = Lx.Icon.Default as unknown as { prototype: Record<string, unknown>; mergeOptions: (o: unknown) => void }
      delete Icons.prototype._getIconUrl
      Icons.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = Lx.map(mapRef.current, { zoomControl: true }).setView([lat, lon], 17)
      mapInst.current = map

      Lx.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      Lx.marker([lat, lon]).addTo(map).bindPopup(name).openPopup()
    })()

    return () => {
      cancelled = true
      mapInst.current?.remove()
      mapInst.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />
}
