'use client'

import { useEffect, useRef, useState } from 'react'
import type * as L from 'leaflet'
import type { FeatureCollection, Geometry } from 'geojson'

export type VillageGeo = FeatureCollection<Geometry, { code: string }>

interface Props {
  geojson: VillageGeo
  /** village_code → 色階級距（0–4，對應 CSS 變數 --pb-ramp-N）；不在表內的村里畫成灰底（被行政區篩選排除） */
  classByCode: Map<string, number>
  /** 低信度村里：降低不透明度 + 虛線框 */
  lowConfidence: Set<string>
  tooltipByCode: Map<string, string>
  selected: string | null
  onSelect: (code: string) => void
  /** 變更時將地圖縮放到這些村里（行政區篩選、表格點選） */
  focusCodes: string[] | null
  /** 客源分析：點地圖任一處回傳座標（同時仍會觸發 onSelect） */
  onMapClick?: (lat: number, lon: number) => void
  /** 客源分析：標記分析位置，並畫出距離圈（公里） */
  marker?: { lat: number; lon: number; label?: string } | null
  rings?: number[]
  /** 客源分析：建案小圓點，點選觸發 onPointClick */
  points?: { id: string; lat: number; lon: number; label: string }[]
  onPointClick?: (id: string) => void
}

// 與站內其他地圖相同用 OSM 底圖；暗色主題以 CSS 濾鏡壓暗（見元件底部 <style>）
const BASE_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/** 色塊濃度：使用者可調，記在瀏覽器（四張村里地圖共用同一個設定） */
const OPACITY_KEY = 'tra-map-opacity'
const DEFAULT_OPACITY = 0.8
function loadOpacity(): number {
  try {
    const v = Number(localStorage.getItem(OPACITY_KEY))
    return v >= 0.1 && v <= 1 ? v : DEFAULT_OPACITY
  } catch { return DEFAULT_OPACITY }
}

/** 站內主題：<html data-theme="light"> 為亮色，未設定為暗色（見 ThemeToggle） */
function isLightTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'light'
}

export default function VillageChoroplethMap({
  geojson, classByCode, lowConfidence, tooltipByCode, selected, onSelect, focusCodes,
  onMapClick, marker, rings, points, onPointClick,
}: Props) {
  const mapRef   = useRef<HTMLDivElement>(null)
  const mapInst  = useRef<L.Map | null>(null)
  const geoLayer = useRef<L.GeoJSON | null>(null)
  const [ready, setReady] = useState(false)
  const [opacity, setOpacity] = useState(loadOpacity)

  // Leaflet 的 style / tooltip / click 只在建立圖層時綁一次，透過 ref 讀最新值
  const classRef    = useRef(classByCode)
  const lowRef      = useRef(lowConfidence)
  const tooltipRef  = useRef(tooltipByCode)
  const selectedRef = useRef(selected)
  const opacityRef  = useRef(opacity)
  const onSelectRef = useRef(onSelect)
  const onMapClickRef = useRef(onMapClick)
  const onPointClickRef = useRef(onPointClick)
  const markerLayer = useRef<L.LayerGroup | null>(null)
  const pointLayer  = useRef<L.LayerGroup | null>(null)
  useEffect(() => {
    onMapClickRef.current   = onMapClick
    onPointClickRef.current = onPointClick
    classRef.current    = classByCode
    lowRef.current      = lowConfidence
    tooltipRef.current  = tooltipByCode
    selectedRef.current = selected
    opacityRef.current  = opacity
    onSelectRef.current = onSelect
  })

  const styleFor = (code: string): L.PathOptions => {
    // Canvas 繪圖不吃 var()，從 :root 讀出目前主題的實際色碼
    const cls = classRef.current.get(code)
    const fill = cls == null ? undefined
      : getComputedStyle(document.documentElement).getPropertyValue(`--pb-ramp-${cls}`).trim() || undefined
    const isSel = selectedRef.current === code
    const isLow = lowRef.current.has(code)
    const light = isLightTheme()
    return {
      fillColor:   fill ?? (light ? '#d8d2c6' : '#3a3226'),
      fillOpacity: (fill ? (isLow ? 0.51 : 1) : 0.32) * opacityRef.current,
      color:       isSel ? (light ? '#2a1f10' : '#f6f1e8') : (light ? 'rgba(42,31,16,0.35)' : 'rgba(12,10,6,0.55)'),
      weight:      isSel ? 3 : 0.6,
      dashArray:   isLow && !isSel ? '2 3' : undefined,
    }
  }

  /* 初始化地圖與村里圖層 */
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    let cancelled = false

    ;(async () => {
      const Lx = (await import('leaflet')).default as typeof L
      if (cancelled || !mapRef.current) return

      if (!document.querySelector('#leaflet-css')) {
        const l = document.createElement('link')
        l.id = 'leaflet-css'; l.rel = 'stylesheet'
        l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(l)
      }

      const map = Lx.map(mapRef.current, { zoomControl: true, preferCanvas: true })
      mapInst.current = map

      Lx.tileLayer(BASE_TILES, {
        attribution: '© OpenStreetMap contributors｜村里界：內政部國土測繪中心',
        maxZoom: 18, className: 'vcm-tiles',
      }).addTo(map)

      const layer = Lx.geoJSON(geojson, {
        style: f => styleFor(f!.properties.code),
        onEachFeature: (f, lyr) => {
          const code = f.properties.code
          lyr.bindTooltip(() => tooltipRef.current.get(code) ?? '', { sticky: true, direction: 'top' })
          lyr.on('click', () => onSelectRef.current(code))
        },
      }).addTo(map)
      // 點選位置：村里多邊形的 click 會冒泡到地圖，所以點里內、里外都只在這裡處理
      map.on('click', e => onMapClickRef.current?.(e.latlng.lat, e.latlng.lng))
      pointLayer.current  = Lx.layerGroup().addTo(map)
      markerLayer.current = Lx.layerGroup().addTo(map)
      geoLayer.current = layer
      map.fitBounds(layer.getBounds(), { padding: [8, 8] })

      // 切換明暗主題時重設村里外框顏色（底圖由 CSS 濾鏡處理）
      const obs = new MutationObserver(() => {
        layer.setStyle(f => styleFor(f!.properties.code))
      })
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      map.on('unload', () => obs.disconnect())

      setReady(true)
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 填色、選取變更 → 重設樣式（選取的村里移到最上層，外框才不會被鄰里蓋住） */
  useEffect(() => {
    if (!ready || !geoLayer.current) return
    geoLayer.current.eachLayer(lyr => {
      const path = lyr as L.Path & { feature: { properties: { code: string } } }
      const code = path.feature.properties.code
      path.setStyle(styleFor(code))
      if (code === selected) path.bringToFront()
    })
  }, [ready, classByCode, lowConfidence, selected, opacity])

  const changeOpacity = (v: number) => {
    setOpacity(v)
    try { localStorage.setItem(OPACITY_KEY, String(v)) } catch { /* 無痕模式等存不了就算了 */ }
  }

  /* 縮放到指定村里 */
  useEffect(() => {
    if (!ready || !geoLayer.current || !mapInst.current) return
    import('leaflet').then(mod => {
      const Lx = mod.default as typeof L
      const set = focusCodes ? new Set(focusCodes) : null
      const bounds = Lx.latLngBounds([])
      geoLayer.current!.eachLayer(lyr => {
        const path = lyr as L.Polygon & { feature: { properties: { code: string } } }
        if (!set || set.has(path.feature.properties.code)) bounds.extend(path.getBounds())
      })
      if (bounds.isValid()) mapInst.current!.flyToBounds(bounds, { padding: [16, 16], maxZoom: 14, duration: 0.6 })
    })
  }, [ready, focusCodes])

  /* 建案小圓點 */
  useEffect(() => {
    if (!ready || !pointLayer.current) return
    import('leaflet').then(mod => {
      const Lx = mod.default as typeof L
      const g = pointLayer.current!
      g.clearLayers()
      const light = isLightTheme()
      for (const p of points ?? []) {
        Lx.circleMarker([p.lat, p.lon], {
          radius: 3, weight: 1, color: light ? '#1f2a2b' : '#e8eeec', fillColor: light ? '#1f7a6e' : '#4fbfae', fillOpacity: 0.9,
          bubblingMouseEvents: false,
        })
          .bindTooltip(p.label, { direction: 'top' })
          .on('click', () => onPointClickRef.current?.(p.id))
          .addTo(g)
      }
    })
  }, [ready, points])

  /* 分析位置標記與距離圈 */
  useEffect(() => {
    if (!ready || !markerLayer.current) return
    import('leaflet').then(mod => {
      const Lx = mod.default as typeof L
      const g = markerLayer.current!
      g.clearLayers()
      if (!marker) return
      const light = isLightTheme()
      const ink = light ? '#2a1f10' : '#f6f1e8'
      for (const km of rings ?? []) {
        Lx.circle([marker.lat, marker.lon], { radius: km * 1000, color: ink, weight: 1, dashArray: '4 4', fill: false, interactive: false })
          .bindTooltip(`${km} 公里`, { permanent: false })
          .addTo(g)
      }
      Lx.circleMarker([marker.lat, marker.lon], { radius: 8, weight: 3, color: ink, fillColor: '#d9534f', fillOpacity: 1, interactive: false })
        .addTo(g)
      if (marker.label) {
        Lx.tooltip({ permanent: true, direction: 'right', offset: [10, 0] }).setLatLng([marker.lat, marker.lon]).setContent(marker.label).addTo(g)
      }
    })
  }, [ready, marker, rings])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }} />
      {/* 色塊濃度滑桿：放在地圖容器外層（不是 Leaflet 控制項），拖曳時不會連帶拖動地圖 */}
      <label className="vcm-opacity" title="調淡一點可以看清楚底圖的路名、地名">
        <span>色塊濃度</span>
        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
          onChange={e => changeOpacity(Number(e.target.value))} aria-label="色塊濃度" />
        <span style={{ fontFamily: 'var(--font-mono)', minWidth: '3ch', textAlign: 'right' }}>{Math.round(opacity * 100)}%</span>
      </label>
      <style>{`
        /* 暗色主題（未設 data-theme）：OSM 底圖轉灰階並反相，讓填色成為視覺主體 */
        :root:not([data-theme="light"]) .vcm-tiles { filter: grayscale(1) invert(1) brightness(0.75) contrast(0.9); }
        :root[data-theme="light"] .vcm-tiles { filter: grayscale(0.85) brightness(1.03); }
        .vcm-opacity {
          position: absolute; top: 10px; right: 10px; z-index: 1000;
          display: flex; align-items: center; gap: 6px; padding: 4px 10px;
          background: var(--surface-card); border: 1px solid var(--border-control); border-radius: var(--radius-full);
          font-size: var(--text-2xs); color: var(--text-muted); box-shadow: 0 1px 4px rgba(0,0,0,0.18); cursor: default;
        }
        .vcm-opacity input { width: 90px; accent-color: var(--accent); margin: 0; cursor: pointer; }
      `}</style>
    </div>
  )
}
