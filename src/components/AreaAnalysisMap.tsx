'use client'

import { useEffect, useRef, useState } from 'react'
import type * as L from 'leaflet'
import { seriesColor } from '@/lib/areaSelection'

export interface PresaleMarker {
  location_key: string
  display_name: string
  district: string
  count: number
  unit_price: number
  avg_total: number
  lat: number
  lon: number
}

interface Props {
  markers: PresaleMarker[]
  selected: string[]
  onBoundsSelect: (keys: string[]) => void
  onMarkerToggle: (key: string) => void
}

export default function AreaAnalysisMap({ markers, selected, onBoundsSelect, onMarkerToggle }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapInst   = useRef<L.Map | null>(null)
  const layerRef  = useRef<L.LayerGroup | null>(null)
  const drawRef   = useRef<L.LayerGroup | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Leaflet 事件 handler 在地圖初始化時綁定一次，透過 ref 讀最新值（避免 closure 過期）
  const markersRef  = useRef<PresaleMarker[]>(markers)
  const onBoundsRef = useRef(onBoundsSelect)
  const onToggleRef = useRef(onMarkerToggle)
  markersRef.current  = markers
  onBoundsRef.current = onBoundsSelect
  onToggleRef.current = onMarkerToggle

  /* 初始化地圖 */
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    let cancelled = false;

    (async () => {
      const Lx = (await import('leaflet')).default as typeof L
      await import('leaflet-draw')

      if (cancelled || !mapRef.current) return

      const addCss = (id: string, href: string) => {
        if (!document.querySelector(`#${id}`)) {
          const l = document.createElement('link')
          l.id = id; l.rel = 'stylesheet'; l.href = href
          document.head.appendChild(l)
        }
      }
      addCss('leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
      addCss('leaflet-draw-css', 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css')

      const Icons = Lx.Icon.Default as unknown as { prototype: Record<string, unknown>; mergeOptions: (o: unknown) => void }
      delete Icons.prototype._getIconUrl
      Icons.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = Lx.map(mapRef.current!, { zoomControl: true }).setView([23.0, 120.2], 11)
      mapInst.current = map

      Lx.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map)

      // 框選圖層
      const drawnItems = new Lx.FeatureGroup()
      map.addLayer(drawnItems)
      drawRef.current = drawnItems

      // leaflet-draw 控制
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DrawControl = (Lx as any).Control.Draw
      const drawControl = new DrawControl({
        position: 'topright',
        draw: {
          rectangle: {
            shapeOptions: { color: '#f59e0b', weight: 2, fillOpacity: 0.08 },
          },
          polyline: false, polygon: false, circle: false,
          marker: false, circlemarker: false,
        },
        edit: { featureGroup: drawnItems, remove: true },
      })
      map.addControl(drawControl)

      // 框選完成：取框內建案
      map.on(Lx.Draw.Event.CREATED, (e: L.LeafletEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = (e as any).layer as L.Rectangle
        drawnItems.clearLayers()
        drawnItems.addLayer(layer)
        const bounds = layer.getBounds()
        const keys = markersRef.current
          .filter(m => bounds.contains([m.lat, m.lon]))
          .map(m => m.location_key)
        onBoundsRef.current(keys)
      })

      // 框刪除時清空選取
      map.on(Lx.Draw.Event.DELETED, () => onBoundsRef.current([]))

      layerRef.current = Lx.layerGroup().addTo(map)
      setMapReady(true)
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* markers 或 selected 變更時重繪標記（mapReady 確保 Leaflet 已初始化） */
  useEffect(() => {
    if (!mapReady || !mapInst.current || !layerRef.current) return

    import('leaflet').then(mod => {
      const Lx = mod.default as typeof L
      layerRef.current!.clearLayers()

      markers.forEach(m => {
        const idx     = selected.indexOf(m.location_key)
        const isSelec = idx >= 0
        const color   = isSelec ? seriesColor(idx) : '#6b7280'
        const opacity = isSelec ? 1 : 0.45

        Lx.circleMarker([m.lat, m.lon], {
          radius: isSelec ? 10 : 6,
          color,
          fillColor: color,
          fillOpacity: opacity,
          weight: isSelec ? 2 : 1,
        })
          .bindTooltip(m.display_name, { permanent: false, direction: 'top' })
          .on('click', () => onToggleRef.current(m.location_key))
          .addTo(layerRef.current!)
      })
    })
  }, [markers, selected, mapReady])

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" />
      <style>{`
        .leaflet-draw-toolbar a { background-color: #1e293b !important; color: #e2e8f0 !important; border-color: rgba(255,255,255,.15) !important; }
        .leaflet-draw-toolbar a:hover { background-color: #334155 !important; }
        .leaflet-control-draw { box-shadow: 0 2px 8px rgba(0,0,0,.4) !important; }
      `}</style>
    </div>
  )
}
