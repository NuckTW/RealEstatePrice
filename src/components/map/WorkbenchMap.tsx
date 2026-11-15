'use client'

import { useEffect, useRef, useState } from 'react'
import type * as L from 'leaflet'
import { priceToColor, priceGradientCss, textOnColor } from '@/lib/colorScale'
import { coordKey, weightedMedianPrice, type Bounds, type MapMarker, type MapTool } from './types'

/** 熱力圖單價標籤只在此 zoom 以上顯示（縮遠時上千個標籤會疊成一團） */
const HEAT_LABEL_MIN_ZOOM = 13

export type AreaShape =
  | { shape: 'box'; bounds: [[number, number], [number, number]] }
  | { shape: 'point'; center: [number, number]; radius: number }

interface Props {
  markers: MapMarker[]
  loading: boolean
  range: [number, number]
  viewMode: 'marker' | 'heat'
  tool: MapTool
  /** 目前選取（群集、路段、框選）的建案：地圖上加黃銅外框 */
  highlightKeys: string[]
  /** 清單上滑鼠停留的建案 */
  hoverKey: string | null
  /** 要飛過去的建案（搜尋、?project=、清單點選） */
  focusKey: string | null
  /** 每次要求定位就 +1，讓重複點同一個建案也會再飛一次 */
  focusNonce: number
  area: AreaShape | null
  onViewportChange: (b: Bounds, zoom: number) => void
  onSelectKeys: (keys: string[], source: 'marker' | 'cluster') => void
  onBoxSelect: (bounds: [[number, number], [number, number]]) => void
  onPointSelect: (center: [number, number]) => void
}

/** 單一地點的標記：預售實心、成屋空心，顏色＝單價 */
function chipHtml(m: MapMarker, range: [number, number]): string {
  const color = m.unit_price > 0 ? priceToColor(m.unit_price, range[0], range[1]) : 'rgb(170,160,145)'
  const price = m.unit_price > 0 ? m.unit_price.toFixed(1) : '—'
  return m.case_type === '預售'
    ? `<div class="wb-chip" style="background:${color};color:${textOnColor(color)};border-color:${color}">${price}</div>`
    : `<div class="wb-chip wb-hollow" style="border-color:${color}">${price}</div>`
}

/** 同一座標有多個案子（路名級座標，同一條路共用一點）→ 路段膠囊 */
function pillHtml(group: MapMarker[], range: [number, number]): string {
  const med = weightedMedianPrice(group)
  const color = med != null ? priceToColor(med, range[0], range[1]) : 'rgb(170,160,145)'
  return `<div class="wb-pill" style="border-color:${color}"><i style="background:${color}"></i><b>${group.length} 案</b>${med != null ? `<span>${med.toFixed(1)}</span>` : ''}</div>`
}

export default function WorkbenchMap(props: Props) {
  const { markers, loading, range, viewMode, tool, highlightKeys, hoverKey, focusKey, focusNonce, area } = props

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)
  const LRef = useRef<typeof L | null>(null)
  const [ready, setReady] = useState(false)

  const layerRef = useRef<L.LayerGroup | null>(null)       // 標記（群集）或熱力色塊
  const labelRef = useRef<L.LayerGroup | null>(null)       // 熱力圖單價標籤
  const areaRef = useRef<L.Layer | null>(null)              // 框選／落點範圍
  const keyToMarker = useRef(new Map<string, L.Marker | L.CircleMarker>())
  const reapplyHl = useRef<() => void>(() => {})

  // callback 一律從 ref 讀最新值，Leaflet 事件只綁一次
  const cb = useRef(props)
  useEffect(() => { cb.current = props })

  /* ── 初始化（只跑一次）── */
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    let cancelled = false
    ;(async () => {
      const Lx = (await import('leaflet')).default as typeof L
      await import('leaflet.markercluster')
      if (cancelled || !mapRef.current || mapInst.current) return

      const addCss = (id: string, href: string) => {
        if (!document.querySelector(`#${id}`)) {
          const l = document.createElement('link')
          l.id = id; l.rel = 'stylesheet'; l.href = href
          document.head.appendChild(l)
        }
      }
      addCss('leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
      addCss('cluster-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css')

      // 首頁是 App 式版面（整頁不捲動），滾輪與單指拖曳可以直接操作地圖
      const map = Lx.map(mapRef.current, { zoomControl: false }).setView([23.02, 120.24], 11)
      Lx.control.zoom({ position: 'bottomright' }).addTo(map)
      Lx.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map)

      const emit = () => {
        const b = map.getBounds()
        cb.current.onViewportChange({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }, map.getZoom())
      }
      map.on('moveend', emit)
      map.on('zoomend', () => reapplyHl.current())

      LRef.current = Lx
      mapInst.current = map
      emit()
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => { mapInst.current?.remove(); mapInst.current = null }, [])

  /* ── 標記／熱力圖 ── */
  useEffect(() => {
    const map = mapInst.current, Lx = LRef.current
    if (!ready || !map || !Lx) return
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    if (labelRef.current) { map.removeLayer(labelRef.current); labelRef.current = null }
    keyToMarker.current.clear()
    const offZoom: (() => void)[] = []

    if (viewMode === 'heat') {
      // 熱力圖維持「僅預售屋」：每個點依自身單價上色，模糊疊色
      if (!map.getPane('wbHeat')) {
        const pane = map.createPane('wbHeat')
        pane.style.filter = 'blur(10px) saturate(1.2)'
        pane.style.zIndex = '410'
      }
      if (!map.getPane('wbHeatLabel')) map.createPane('wbHeatLabel').style.zIndex = '450'
      const renderer = Lx.canvas({ pane: 'wbHeat' })
      const heat = Lx.layerGroup(), labels = Lx.layerGroup()
      markers.filter(m => m.case_type === '預售' && m.unit_price > 0).forEach(m => {
        const color = priceToColor(m.unit_price, range[0], range[1])
        const c = Lx.circleMarker([m.lat, m.lon], { renderer, radius: 34, stroke: false, fillColor: color, fillOpacity: 0.5 })
          .on('click', () => cb.current.onSelectKeys([m.location_key], 'marker'))
          .addTo(heat)
        keyToMarker.current.set(m.location_key, c)
        Lx.marker([m.lat, m.lon], {
          pane: 'wbHeatLabel',
          icon: Lx.divIcon({ html: `<div class="wb-heat-label">${m.unit_price}</div>`, className: '', iconSize: Lx.point(44, 18), iconAnchor: Lx.point(22, 9) }),
        }).on('click', () => cb.current.onSelectKeys([m.location_key], 'marker')).addTo(labels)
      })
      map.addLayer(heat)
      layerRef.current = heat
      labelRef.current = labels
      const sync = () => {
        const show = map.getZoom() >= HEAT_LABEL_MIN_ZOOM
        if (show && !map.hasLayer(labels)) map.addLayer(labels)
        if (!show && map.hasLayer(labels)) map.removeLayer(labels)
      }
      sync()
      map.on('zoomend', sync)
      offZoom.push(() => map.off('zoomend', sync))
    } else {
      // 先依座標分組：同一點多個案子合併成一顆「路段膠囊」，不再假裝是精確位置
      const groups = new Map<string, MapMarker[]>()
      for (const m of markers) {
        const k = coordKey(m)
        const g = groups.get(k)
        if (g) g.push(m); else groups.set(k, [m])
      }
      const dataOf = new WeakMap<L.Marker, MapMarker[]>()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (Lx as any).markerClusterGroup({
        maxClusterRadius: 56,
        zoomToBoundsOnClick: false,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        // 群集依子標記的加權中位單價上色；全是成屋時用空心樣式
        iconCreateFunction: (c: { getAllChildMarkers: () => L.Marker[] }) => {
          const all = c.getAllChildMarkers().flatMap(mk => dataOf.get(mk) ?? [])
          const presale = all.filter(m => m.case_type === '預售')
          const basis = presale.length ? presale : all
          const med = weightedMedianPrice(basis)
          const color = med != null ? priceToColor(med, range[0], range[1]) : 'rgb(170,160,145)'
          const hollow = !presale.length
          const style = hollow
            ? `background:var(--surface-overlay);color:var(--text-strong);border-color:${color}`
            : `background:${color};color:${textOnColor(color)}`
          return Lx.divIcon({
            html: `<div class="wb-cluster${hollow ? ' wb-hollow' : ''}" style="${style}" title="${all.length} 個地點・中位 ${med?.toFixed(1) ?? '—'} 萬/坪"><b>${med != null ? med.toFixed(1) : '—'}</b><span>${all.length}</span></div>`,
            className: '', iconSize: Lx.point(46, 46),
          })
        },
      }) as L.LayerGroup & { getVisibleParent: (m: L.Marker) => L.Marker | null; zoomToShowLayer: (m: L.Marker, cb: () => void) => void }

      cluster.on('clusterclick', (e: L.LeafletEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = (e as any).layer
        const keys = (layer.getAllChildMarkers() as L.Marker[]).flatMap(mk => (dataOf.get(mk) ?? []).map(m => m.location_key))
        cb.current.onSelectKeys(keys, 'cluster')
        layer.zoomToBounds({ padding: [48, 48] })
      })

      for (const group of groups.values()) {
        const single = group.length === 1
        const html = single ? chipHtml(group[0], range) : pillHtml(group, range)
        const mk = Lx.marker([group[0].lat, group[0].lon], {
          icon: Lx.divIcon({ html, className: '', iconSize: Lx.point(single ? 48 : 96, 24), iconAnchor: Lx.point(single ? 24 : 48, 12) }),
          title: single ? group[0].display_name : `${group.length} 個建案共用同一個路段代表點`,
          keyboard: true,
        })
        mk.on('click', () => cb.current.onSelectKeys(group.map(m => m.location_key), 'marker'))
        dataOf.set(mk, group)
        group.forEach(m => keyToMarker.current.set(m.location_key, mk))
        mk.addTo(cluster)
      }
      map.addLayer(cluster)
      layerRef.current = cluster
      cluster.on('animationend', () => reapplyHl.current())
    }

    reapplyHl.current()
    return () => offZoom.forEach(f => f())
  }, [ready, markers, range, viewMode])

  /* ── 高亮：選取＝黃銅外框，滑鼠停留＝放大 ── */
  useEffect(() => {
    const apply = () => {
      const root = mapRef.current
      if (!root) return
      root.querySelectorAll('.is-hl, .is-hover').forEach(el => el.classList.remove('is-hl', 'is-hover'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = layerRef.current as any
      const elOf = (key: string): Element | null => {
        const mk = keyToMarker.current.get(key)
        if (!mk) return null
        // 標記被收進群集時，高亮的是它所在的群集
        const visible = cluster?.getVisibleParent ? cluster.getVisibleParent(mk) : mk
        const target = visible ?? mk
        const el = (target as L.Marker).getElement?.() ?? null
        return el?.firstElementChild ?? el
      }
      highlightKeys.forEach(k => elOf(k)?.classList.add('is-hl'))
      if (hoverKey) elOf(hoverKey)?.classList.add('is-hover')
    }
    reapplyHl.current = apply
    apply()
  }, [highlightKeys, hoverKey, markers, viewMode])

  /* ── 飛到指定建案 ── */
  useEffect(() => {
    const map = mapInst.current
    if (!ready || !map || !focusKey) return
    const mk = keyToMarker.current.get(focusKey)
    if (!mk) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cluster = layerRef.current as any
    const center = (mk as L.Marker).getLatLng()
    if (cluster?.zoomToShowLayer && viewMode === 'marker') {
      cluster.zoomToShowLayer(mk, () => { map.panTo(center); reapplyHl.current() })
    } else {
      map.setView(center, Math.max(map.getZoom(), 15))
    }
  }, [ready, focusKey, focusNonce, markers, viewMode])

  /* ── 框選／落點工具 ── */
  useEffect(() => {
    const map = mapInst.current, Lx = LRef.current
    if (!ready || !map || !Lx) return
    const container = map.getContainer()
    container.style.cursor = tool === 'none' ? '' : 'crosshair'
    if (tool === 'none') return

    if (tool === 'point') {
      const onClick = (e: L.LeafletMouseEvent) => cb.current.onPointSelect([e.latlng.lat, e.latlng.lng])
      map.on('click', onClick)
      return () => { map.off('click', onClick); container.style.cursor = '' }
    }

    // 框選：按住拖曳畫矩形（框選時暫停地圖拖曳）
    map.dragging.disable()
    let start: L.LatLng | null = null
    let rect: L.Rectangle | null = null
    const down = (e: L.LeafletMouseEvent) => { start = e.latlng }
    const move = (e: L.LeafletMouseEvent) => {
      if (!start) return
      const b = Lx.latLngBounds(start, e.latlng)
      if (rect) rect.setBounds(b)
      else rect = Lx.rectangle(b, { color: '#d9912a', weight: 1.5, dashArray: '5 4', fillOpacity: 0.08, interactive: false }).addTo(map)
    }
    const up = (e: L.LeafletMouseEvent) => {
      if (!start) return
      const b = Lx.latLngBounds(start, e.latlng)
      start = null
      if (rect) { map.removeLayer(rect); rect = null }
      if (b.getNorth() - b.getSouth() < 1e-4 && b.getEast() - b.getWest() < 1e-4) return  // 只是點一下，不算框選
      cb.current.onBoxSelect([[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]])
    }
    map.on('mousedown', down)
    map.on('mousemove', move)
    map.on('mouseup', up)
    return () => {
      map.off('mousedown', down); map.off('mousemove', move); map.off('mouseup', up)
      if (rect) map.removeLayer(rect)
      map.dragging.enable()
      container.style.cursor = ''
    }
  }, [ready, tool])

  /* ── 目前的框選／落點範圍 ── */
  useEffect(() => {
    const map = mapInst.current, Lx = LRef.current
    if (!ready || !map || !Lx) return
    if (areaRef.current) { map.removeLayer(areaRef.current); areaRef.current = null }
    if (!area) return
    const style = { color: '#d9912a', weight: 1.5, dashArray: '5 4', fillColor: '#d9912a', fillOpacity: 0.08, interactive: false }
    areaRef.current = area.shape === 'box'
      ? Lx.rectangle(area.bounds, style).addTo(map)
      : Lx.circle(area.center, { ...style, radius: area.radius }).addTo(map)
  }, [ready, area])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, background: 'var(--bg-sunken)' }} />

      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div className="wb-float" style={{ padding: '6px 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-default)' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--border-strong)', borderTopColor: 'var(--accent)', animation: 'tra-spin .6s linear infinite' }} />
            載入地圖資料…
          </div>
        </div>
      )}

      {/* 圖例 */}
      <div className="wb-float wb-legend" style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 1000, padding: '8px 10px', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 5, maxWidth: 'calc(100% - 80px)' }}>
        <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>
          {viewMode === 'heat' ? '預售單價（萬/坪）' : '中位單價（萬/坪）'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono">{range[0] ? range[0].toFixed(0) : '—'}</span>
          <span style={{ width: 96, height: 7, borderRadius: 4, background: priceGradientCss() }} />
          <span className="mono">{range[1] ? `${range[1].toFixed(0)}+` : '—'}</span>
        </div>
        {viewMode === 'marker' && (
          <div className="wb-legend-extra" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span><i className="wb-dot" />預售</span>
            <span><i className="wb-dot wb-dot-hollow" />成屋</span>
            <span><i className="wb-pill-key" />同點多案</span>
          </div>
        )}
        <span style={{ color: 'color-mix(in srgb, var(--warning) 50%, var(--text-strong))', lineHeight: 1.4 }}>
          ⚠ 位置為路段代表點，非建案精確位置
        </span>
      </div>

      <style>{`
        .wb-float { background: color-mix(in srgb, var(--surface-overlay) 94%, transparent); border: 1px solid var(--border-control);
          box-shadow: var(--shadow-pop); color: var(--text-muted); font-size: var(--text-2xs); font-family: var(--font-sans); }
        .wb-legend .mono { font-family: var(--font-mono); }
        .wb-dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:-1px; background: rgb(192,92,56); }
        .wb-dot-hollow { background: transparent; border: 2px solid rgb(192,92,56); }
        .wb-pill-key { display:inline-block; width:16px; height:9px; border-radius:5px; margin-right:4px; vertical-align:-1px; border:1.5px solid rgb(192,92,56); background: var(--surface-overlay); }
        @media (max-width: 767px) { .wb-legend-extra { display: none !important; } }

        /* 地圖標記是固定尺寸的圖形，字級刻意不跟 --font-scale 縮放，避免爆出圖形外 */
        .wb-chip { display:inline-flex; align-items:center; justify-content:center; min-width:40px; height:22px; padding:0 6px;
          border-radius:11px; border:2px solid; font:600 11px/1 var(--font-mono); white-space:nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,.3); transition: transform .12s; cursor:pointer; }
        .wb-hollow.wb-chip { background:#fff; color:#2a1f10; }
        .wb-pill { display:inline-flex; align-items:center; gap:5px; height:24px; padding:0 9px 0 6px; border-radius:12px;
          border:2px solid; background:#fff; color:#2a1f10; font:600 11px/1 var(--font-sans); white-space:nowrap;
          box-shadow: 0 1px 4px rgba(0,0,0,.3); cursor:pointer; transition: transform .12s; }
        .wb-pill i { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
        .wb-pill span { font-family: var(--font-mono); color:#5a4a36; }
        .wb-cluster { width:100%; height:100%; border-radius:50%; border:2px solid rgba(255,255,255,.9); display:flex; flex-direction:column;
          align-items:center; justify-content:center; line-height:1.05; font-family:var(--font-mono); box-shadow:0 2px 8px rgba(0,0,0,.35);
          cursor:pointer; transition: transform .12s; }
        .wb-cluster.wb-hollow { border-width:3px; }
        .wb-cluster b { font-size:12px; font-weight:700; }
        .wb-cluster span { font-size:9.5px; opacity:.85; }
        .wb-heat-label { color:#fff; font:700 11px/1 var(--font-mono); text-align:center; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,.85); }
        /* 選取＝黃銅外框（互動色），滑鼠停留＝放大 */
        .is-hl { outline: 3px solid var(--accent); outline-offset: 2px; }
        .is-hover { transform: scale(1.25); outline: 3px solid var(--accent); outline-offset: 2px; z-index: 1; }
        .leaflet-container { font-family: var(--font-sans); }
        @keyframes tra-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
