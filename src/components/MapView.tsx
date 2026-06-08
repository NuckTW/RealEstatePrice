'use client'

import { useEffect, useRef, useState } from 'react'
import type * as L from 'leaflet'
import { FilterValues } from './FilterBar'
import { priceToColor } from '@/lib/colorScale'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HeatLayer = any

interface Marker {
  location_key: string
  case_type: '預售' | '成屋'
  district: string
  display_name: string
  count: number
  unit_price: number
  avg_total: number
  lat: number
  lon: number
}

interface Props {
  filters: FilterValues
  onCaseClick?: (name: string, caseType: 'presale' | 'existing', district: string) => void
}

export default function MapView({ filters, onCaseClick }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const mapInst    = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.LayerGroup | null>(null)
  const heatRef    = useRef<HeatLayer | null>(null)
  const [loading, setLoading] = useState(true)
  const [count, setCount]     = useState(0)
  const [presaleRange, setPresaleRange] = useState<[number, number]>([0, 0])
  const [viewMode, setViewMode] = useState<'marker' | 'heat'>('marker')

  /* ── 初始化地圖（只跑一次）── */
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return

    let cancelled = false;

    (async () => {
      const Lx = (await import('leaflet')).default as typeof L
      await import('leaflet.markercluster')
      await import('leaflet.heat')

      if (cancelled || !mapRef.current) return

      // CSS
      const addCss = (id: string, href: string) => {
        if (!document.querySelector(`#${id}`)) {
          const l = document.createElement('link')
          l.id = id; l.rel = 'stylesheet'; l.href = href
          document.head.appendChild(l)
        }
      }
      addCss('leaflet-css',         'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
      addCss('cluster-css',         'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css')
      addCss('cluster-default-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css')

      // Fix icon paths
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
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      await loadMarkers(Lx, map, filters)
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── 篩選器或檢視模式變更 → 重新載入 ── */
  useEffect(() => {
    if (!mapInst.current) return
    import('leaflet').then(mod => {
      const Lx = mod.default as typeof L
      loadMarkers(Lx, mapInst.current!, filters)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, viewMode])

  /* ── 清理 ── */
  useEffect(() => {
    return () => {
      mapInst.current?.remove()
      mapInst.current = null
    }
  }, [])

  async function loadMarkers(Lx: typeof L, map: L.Map, f: FilterValues) {
    setLoading(true)
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
      clusterRef.current = null
    }
    if (heatRef.current) {
      map.removeLayer(heatRef.current)
      heatRef.current = null
    }

    const p = new URLSearchParams({
      dateFromYear:  f.dateFromYear,
      dateFromMonth: f.dateFromMonth,
      dateToYear:    f.dateToYear,
      dateToMonth:   f.dateToMonth,
      presale:       f.presale,
      buildingAge:   f.buildingAge,
    })
    if (f.types.length     > 0) p.set('types',     f.types.join(','))
    if (f.rooms.length     > 0) p.set('rooms',     f.rooms.join(','))
    if (f.districts.length > 0) p.set('districts', f.districts.join(','))

    try {
      const res     = await fetch(`/api/map?${p}`)
      const json    = await res.json()
      const markers: Marker[] = json.markers ?? []
      setCount(markers.length)

      // 預售屋單價範圍，用於計算漸層顏色／熱力強度
      const presalePrices = markers
        .filter(m => m.case_type === '預售' && m.unit_price > 0)
        .map(m => m.unit_price)
      const presaleMin = presalePrices.length ? Math.min(...presalePrices) : 0
      const presaleMax = presalePrices.length ? Math.max(...presalePrices) : 0
      setPresaleRange([presaleMin, presaleMax])

      if (viewMode === 'heat') {
        // 熱力圖：每個點依「自身單價」決定顏色（藍→黃→紅），而非依密度疊加成單一顏色
        if (!map.getPane('priceHeatPane')) {
          const pane = map.createPane('priceHeatPane')
          pane.style.filter = 'blur(14px) saturate(1.4)'
          pane.style.zIndex = '410'
        }
        if (!map.getPane('priceHeatLabelPane')) {
          const labelPane = map.createPane('priceHeatLabelPane')
          labelPane.style.zIndex = '450'
        }
        const renderer = Lx.canvas({ pane: 'priceHeatPane' })

        const heatGroup = Lx.layerGroup()
        markers
          .filter(m => m.case_type === '預售' && m.unit_price > 0)
          .forEach(m => {
            const color = priceToColor(m.unit_price, presaleMin, presaleMax)

            // 色塊（模糊疊色，混合模式讓底圖仍可見）
            Lx.circleMarker([m.lat, m.lon], {
              renderer,
              radius: 36,
              stroke: false,
              fillColor: color,
              fillOpacity: 0.72,
            }).addTo(heatGroup)

            // 中心標示單價數值（不顯示單位，畫面更乾淨；點擊可查看該筆資料）
            const priceText = `${m.unit_price}萬/坪`
            const popup = `
              <div style="font-family:sans-serif;font-size:12px;min-width:160px">
                <div style="font-weight:600;margin-bottom:4px">${m.display_name}</div>
                <div style="color:#888;margin-bottom:6px">${m.district} · ${m.case_type}</div>
                <div style="display:flex;gap:12px">
                  <div><div style="color:#888;font-size:10px">均單價</div><div style="color:${color};font-weight:600">${priceText}</div></div>
                  <div><div style="color:#888;font-size:10px">均總價</div><div style="font-weight:600">${m.avg_total ? m.avg_total.toLocaleString()+'萬' : '—'}</div></div>
                  <div><div style="color:#888;font-size:10px">戶數</div><div style="font-weight:600">${m.count}</div></div>
                </div>
                <button
                  onclick="window.__mapClick('${m.location_key.replace(/'/g,"\\'")}','${m.case_type}','${m.district}')"
                  style="margin-top:8px;width:100%;background:#1e293b;color:#e2e8f0;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">
                  查看交易明細
                </button>
              </div>`

            Lx.marker([m.lat, m.lon], {
              pane: 'priceHeatLabelPane',
              icon: Lx.divIcon({
                html: `<div class="map-heat-label">${m.unit_price}</div>`,
                className: '', iconSize: Lx.point(44, 18), iconAnchor: Lx.point(22, 9),
              }),
            }).bindPopup(popup).addTo(heatGroup)
          })

        heatRef.current = heatGroup
        map.addLayer(heatGroup)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cluster = (Lx as any).markerClusterGroup({
          maxClusterRadius: 60,
          iconCreateFunction: (c: { getChildCount: () => number }) => Lx.divIcon({
            html: `<div class="map-cluster">${c.getChildCount()}</div>`,
            className: '', iconSize: Lx.point(40, 40),
          }),
        }) as L.LayerGroup

        clusterRef.current = cluster

        markers.forEach(m => {
          const isPresale = m.case_type === '預售'
          const color     = isPresale
            ? (m.unit_price > 0 ? priceToColor(m.unit_price, presaleMin, presaleMax) : '#8b5cf6')
            : '#14b8a6'
          const price     = m.unit_price ? `${m.unit_price}萬/坪` : '—'

          const icon = Lx.divIcon({
            html: `<div class="map-marker" style="border-color:${color}"><div class="map-marker-price" style="color:${color}">${price}</div></div>`,
            className: '', iconSize: Lx.point(72, 28), iconAnchor: Lx.point(36, 14),
          })

          const popup = `
            <div style="font-family:sans-serif;font-size:12px;min-width:160px">
              <div style="font-weight:600;margin-bottom:4px">${m.display_name}</div>
              <div style="color:#888;margin-bottom:6px">${m.district} · ${m.case_type}</div>
              <div style="display:flex;gap:12px">
                <div><div style="color:#888;font-size:10px">均單價</div><div style="color:${color};font-weight:600">${price}</div></div>
                <div><div style="color:#888;font-size:10px">均總價</div><div style="font-weight:600">${m.avg_total ? m.avg_total.toLocaleString()+'萬' : '—'}</div></div>
                <div><div style="color:#888;font-size:10px">戶數</div><div style="font-weight:600">${m.count}</div></div>
              </div>
              <button
                onclick="window.__mapClick('${m.location_key.replace(/'/g,"\\'")}','${m.case_type}','${m.district}')"
                style="margin-top:8px;width:100%;background:#1e293b;color:#e2e8f0;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px">
                查看交易明細
              </button>
            </div>`

          Lx.marker([m.lat, m.lon], { icon })
            .bindPopup(popup)
            .addTo(cluster)
        })

        map.addLayer(cluster)
      }
    } catch (e) {
      console.error('[MapView]', e)
    } finally {
      setLoading(false)
    }
  }

  // 全域 popup callback
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__mapClick = (
      name: string, caseType: string, district: string
    ) => onCaseClick?.(name, caseType === '預售' ? 'presale' : 'existing', district)
  }, [onCaseClick])

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 140px)', minHeight: 500 }}>
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080d16]/60 rounded-2xl z-[1000]">
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <span className="w-4 h-4 border border-gray-600 border-t-violet-400 rounded-full animate-spin" />
            載入地圖資料…
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 z-[1000] bg-[#0d1420]/90 border border-white/10 rounded-full p-1 text-xs flex gap-1">
        <button
          onClick={() => setViewMode('marker')}
          className={`px-3 py-1 rounded-full transition-colors ${viewMode === 'marker' ? 'bg-amber-500/90 text-[#0d1420] font-medium' : 'text-gray-400 hover:text-gray-200'}`}
        >
          標記
        </button>
        <button
          onClick={() => setViewMode('heat')}
          className={`px-3 py-1 rounded-full transition-colors ${viewMode === 'heat' ? 'bg-amber-500/90 text-[#0d1420] font-medium' : 'text-gray-400 hover:text-gray-200'}`}
        >
          熱力圖（預售屋）
        </button>
      </div>

      {!loading && (
        <div className="absolute top-3 right-3 z-[1000] bg-[#0d1420]/90 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-400">
          {count.toLocaleString()} 棟
        </div>
      )}

      <div className="absolute bottom-6 left-3 z-[1000] bg-[#0d1420]/90 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 flex flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <span>預售屋單價（萬/坪，{viewMode === 'heat' ? '熱力強度' : '標記顏色'}）</span>
          <div className="flex items-center gap-1.5">
            <span>{presaleRange[0] || '—'}</span>
            <span
              className="w-24 h-2 rounded-full"
              style={{ background: 'linear-gradient(to right, rgb(59,130,246), rgb(250,204,21), rgb(239,68,68))' }}
            />
            <span>{presaleRange[1] || '—'}</span>
          </div>
        </div>
        {viewMode === 'marker' && (
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500" />成屋</div>
        )}
      </div>

      <style>{`
        .map-marker { background:rgba(13,20,32,0.92); border:1.5px solid; border-radius:8px; padding:2px 6px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,.4); }
        .map-marker-price { font-size:11px; font-weight:600; line-height:1.4; }
        .map-heat-label { color:#f1f5f9; font-size:11px; font-weight:700; text-align:center; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,.85), 0 0 6px rgba(0,0,0,.6); }
        .map-cluster { width:36px; height:36px; background:rgba(139,92,246,.85); border:2px solid rgba(139,92,246,.4); border-radius:50%; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.4); }
        .leaflet-popup-content-wrapper { background:#0d1420!important; color:#e2e8f0!important; border:1px solid rgba(255,255,255,.1)!important; border-radius:12px!important; box-shadow:0 8px 32px rgba(0,0,0,.5)!important; }
        .leaflet-popup-tip { background:#0d1420!important; }
        .leaflet-popup-close-button { color:#9ca3af!important; }
      `}</style>
    </div>
  )
}
