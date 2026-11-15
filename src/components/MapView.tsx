'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
  avg_area?: number | null
  lat: number
  lon: number
  // 預售屋專屬（成屋為 null）
  total_units?: number | null
  sold_total?: number | null
  sales_ratio?: number | null
  last_tx_month?: string | null   // 'YYYY-MM'
}

/** 熱力圖單價標籤只在此 zoom 以上顯示（縮遠時 1,500+ 標籤會疊成一團） */
const HEAT_LABEL_MIN_ZOOM = 13

/** 成屋標記色（成屋不依單價上色，固定一色與預售區分） */
const EXISTING_COLOR = '#14b8a6'

/** 中位數（輸入需已排序） */
function medianOf(sorted: number[]): number {
  const n = sorted.length
  if (!n) return 0
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
}

/** 依底色亮度決定上面文字用深色或白色（黃色底配白字會看不清） */
function textOn(color: string): string {
  let r = 0, g = 0, b = 0
  const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3] }
  else if (/^#[0-9a-f]{6}$/i.test(color)) {
    r = parseInt(color.slice(1, 3), 16); g = parseInt(color.slice(3, 5), 16); b = parseInt(color.slice(5, 7), 16)
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1206' : '#ffffff'
}

/** 地圖浮層共用樣式：跟著站上主題 token 走（原本寫死深藍色，亮色模式下很突兀） */
const overlayStyle: CSSProperties = {
  background: 'color-mix(in srgb, var(--surface-overlay) 94%, transparent)',
  border: '1px solid var(--border-control)',
  color: 'var(--text-muted)',
  boxShadow: 'var(--shadow-pop)',
  fontSize: 'var(--text-xs)',
}

/** 'YYYY-MM' → '115/05'（民國年月） */
function rocMonth(ym?: string | null): string {
  if (!ym || ym.length < 7) return ''
  return `${parseInt(ym.slice(0, 4)) - 1911}/${ym.slice(5, 7)}`
}

/** popup HTML（標記模式與熱力圖模式共用） */
function buildPopup(m: Marker, color: string): string {
  const price = m.unit_price ? `${m.unit_price}萬/坪` : '—'
  // 預售屋：銷售成數 + 最新成交月（建商/房仲判斷去化速度的關鍵）
  const salesRow = m.case_type === '預售' && (m.total_units || m.last_tx_month) ? `
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.08);font-size:var(--text-2xs);color:#9ca3af">
      ${m.total_units
        ? `銷售 <span style="color:#e2e8f0;font-weight:600">${m.sold_total ?? '—'}/${m.total_units}</span> 戶${m.sales_ratio != null ? `（<span style="color:${color};font-weight:600">${m.sales_ratio}%</span>）` : ''}`
        : ''}
      ${m.last_tx_month ? `${m.total_units ? ' · ' : ''}最新成交 <span style="color:#e2e8f0">${rocMonth(m.last_tx_month)}</span>` : ''}
    </div>` : ''

  return `
    <div style="font-family:sans-serif;font-size:var(--text-xs);min-width:170px">
      <div style="font-weight:600;margin-bottom:4px">${m.display_name}</div>
      <div style="color:#888;margin-bottom:6px">${m.district} · ${m.case_type}</div>
      <div style="display:flex;gap:12px">
        <div><div style="color:#888;font-size:var(--text-3xs)">均單價</div><div style="color:${color};font-weight:600">${price}</div></div>
        <div><div style="color:#888;font-size:var(--text-3xs)">均總價</div><div style="font-weight:600">${m.avg_total ? m.avg_total.toLocaleString()+'萬' : '—'}</div></div>
        <div><div style="color:#888;font-size:var(--text-3xs)">均坪數</div><div style="font-weight:600">${m.avg_area != null ? m.avg_area + '坪' : '—'}</div></div>
        <div><div style="color:#888;font-size:var(--text-3xs)">戶數</div><div style="font-weight:600">${m.count}</div></div>
      </div>
      ${salesRow}
      <button
        onclick="window.__mapClick('${m.location_key.replace(/'/g,"\\'")}','${m.case_type}','${m.district}')"
        style="margin-top:8px;width:100%;background:#1e293b;color:#e2e8f0;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:var(--text-2xs)">
        查看交易明細
      </button>
    </div>`
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
  const labelRef   = useRef<L.LayerGroup | null>(null)
  const zoomHandlerRef = useRef<(() => void) | null>(null)
  const [loading, setLoading] = useState(true)
  const [count, setCount]     = useState(0)
  const [presaleRange, setPresaleRange] = useState<[number, number]>([0, 0])
  const [viewMode, setViewMode] = useState<'marker' | 'heat'>('marker')
  // 操作提示：滾輪沒按 Ctrl／觸控只用一指時，告訴使用者怎麼縮放（不再劫持整頁捲動）
  const [hint, setHint] = useState<null | 'wheel' | 'touch'>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showHint = (kind: 'wheel' | 'touch') => {
    setHint(kind)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), 1400)
  }

  // loadMarkers 移到兩個會呼叫它的 effect 之前宣告 —— react-hooks 的新規則要求「用到的函式
  // 必須先於使用處被宣告」（原本放在檔案後段雖然因 function 宣告會 hoist、執行時沒問題，
  // 但仍會被判 react-hooks/immutability：Cannot access variable before it is declared）。
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
    if (labelRef.current) {
      map.removeLayer(labelRef.current)
      labelRef.current = null
    }
    if (zoomHandlerRef.current) {
      map.off('zoomend', zoomHandlerRef.current)
      zoomHandlerRef.current = null
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
    if (f.zones.length     > 0) p.set('zones',     f.zones.join(','))

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
          pane.style.filter = 'blur(10px) saturate(1.3)'
          pane.style.zIndex = '410'
        }
        if (!map.getPane('priceHeatLabelPane')) {
          const labelPane = map.createPane('priceHeatLabelPane')
          labelPane.style.zIndex = '450'
        }
        const renderer = Lx.canvas({ pane: 'priceHeatPane' })

        const heatGroup  = Lx.layerGroup()  // 色塊（永遠顯示）
        const labelGroup = Lx.layerGroup()  // 單價標籤（拉近才顯示，避免全市視角疊成一團）
        markers
          .filter(m => m.case_type === '預售' && m.unit_price > 0)
          .forEach(m => {
            const color = priceToColor(m.unit_price, presaleMin, presaleMax)
            const popup = buildPopup(m, color)

            // 色塊（模糊疊色，混合模式讓底圖仍可見）；直接綁 popup，縮遠沒標籤也能點
            Lx.circleMarker([m.lat, m.lon], {
              renderer,
              radius: 36,
              stroke: false,
              fillColor: color,
              fillOpacity: 0.42,   // 透一點讓底圖路名可讀
            }).bindPopup(popup).addTo(heatGroup)

            // 中心標示單價數值
            Lx.marker([m.lat, m.lon], {
              pane: 'priceHeatLabelPane',
              icon: Lx.divIcon({
                html: `<div class="map-heat-label">${m.unit_price}</div>`,
                className: '', iconSize: Lx.point(44, 18), iconAnchor: Lx.point(22, 9),
              }),
            }).bindPopup(popup).addTo(labelGroup)
          })

        heatRef.current  = heatGroup
        labelRef.current = labelGroup
        map.addLayer(heatGroup)

        // 標籤依 zoom 顯示／隱藏
        const syncLabels = () => {
          const show = map.getZoom() >= HEAT_LABEL_MIN_ZOOM
          if (show && !map.hasLayer(labelGroup)) map.addLayer(labelGroup)
          if (!show && map.hasLayer(labelGroup)) map.removeLayer(labelGroup)
        }
        syncLabels()
        map.on('zoomend', syncLabels)
        zoomHandlerRef.current = syncLabels
      } else {
        // 每個 Leaflet 標記對應的原始資料，群集圖示要靠它算子標記的中位單價
        const dataOf = new WeakMap<L.Marker, Marker>()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cluster = (Lx as any).markerClusterGroup({
          maxClusterRadius: 60,
          // 群集依「子標記中的預售中位單價」上色、圓內顯示該單價，與圖例色階一致；
          // 全是成屋（無預售單價）的群集用成屋色、只顯示棟數
          iconCreateFunction: (c: { getChildCount: () => number; getAllChildMarkers: () => L.Marker[] }) => {
            const n = c.getChildCount()
            const prices = c.getAllChildMarkers()
              .map(mk => dataOf.get(mk))
              .filter((d): d is Marker => !!d && d.case_type === '預售' && d.unit_price > 0)
              .map(d => d.unit_price)
              .sort((a, b) => a - b)
            if (!prices.length) {
              return Lx.divIcon({
                html: `<div class="map-cluster" style="background:${EXISTING_COLOR};color:#fff"><b>${n}</b></div>`,
                className: '', iconSize: Lx.point(40, 40),
              })
            }
            const med   = medianOf(prices)
            const color = priceToColor(med, presaleMin, presaleMax)
            return Lx.divIcon({
              html: `<div class="map-cluster" style="background:${color};color:${textOn(color)}" title="預售中位單價 ${med.toFixed(1)} 萬/坪 · ${n} 棟"><b>${med.toFixed(1)}</b><span>${n}</span></div>`,
              className: '', iconSize: Lx.point(46, 46),
            })
          },
        }) as L.LayerGroup

        clusterRef.current = cluster

        markers.forEach(m => {
          const isPresale = m.case_type === '預售'
          const color     = isPresale
            ? (m.unit_price > 0 ? priceToColor(m.unit_price, presaleMin, presaleMax) : '#cda86a')
            : EXISTING_COLOR
          const price     = m.unit_price ? `${m.unit_price}萬/坪` : '—'

          const icon = Lx.divIcon({
            html: `<div class="map-marker" style="border-color:${color}"><div class="map-marker-price" style="color:${color}">${price}</div></div>`,
            className: '', iconSize: Lx.point(72, 28), iconAnchor: Lx.point(36, 14),
          })

          const mk = Lx.marker([m.lat, m.lon], { icon }).bindPopup(buildPopup(m, color))
          dataOf.set(mk, m)
          mk.addTo(cluster)
        })

        map.addLayer(cluster)
      }
    } catch (e) {
      console.error('[MapView]', e)
    } finally {
      setLoading(false)
    }
  }

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

      // 觸控裝置：單指留給整頁捲動，兩指才移動／縮放地圖（關掉 dragging 後，
      // Leaflet 的 touchZoom 仍會跟著兩指中心點平移）
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const map = Lx.map(mapRef.current!, {
        zoomControl: true,
        scrollWheelZoom: false,   // 預設不吃滾輪，避免捲頁面時被地圖攔截；按住 Ctrl/⌘ 才縮放
        dragging: !coarse,
      }).setView([23.0, 120.2], 11)
      mapInst.current = map

      const container = map.getContainer()
      // capture 階段先判斷修飾鍵：有按 Ctrl/⌘（含 Mac 觸控板雙指捏合）才交給 Leaflet 縮放，
      // 並擋掉瀏覽器的整頁縮放；沒按就讓頁面正常捲動、顯示提示
      container.addEventListener('wheel', (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable()
        } else {
          if (map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable()
          showHint('wheel')
        }
      }, { capture: true, passive: false })
      if (coarse) {
        container.addEventListener('touchstart', (e: TouchEvent) => {
          if (e.touches.length === 1) showHint('touch')
        }, { passive: true })
      }

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

  // 全域 popup callback
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__mapClick = (
      name: string, caseType: string, district: string
    ) => onCaseClick?.(name, caseType === '預售' ? 'presale' : 'existing', district)
  }, [onCaseClick])

  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 260px)', minHeight: 480 }}>
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-[1000]"
          style={{ background: 'color-mix(in srgb, var(--bg-app) 55%, transparent)' }}>
          <div className="flex items-center gap-2" style={{ ...overlayStyle, fontSize: 'var(--text-sm)', borderRadius: 999, padding: '6px 14px', color: 'var(--text-default)' }}>
            <span className="w-4 h-4 rounded-full animate-spin" style={{ border: '1.5px solid var(--border-strong)', borderTopColor: 'var(--accent)' }} />
            載入地圖資料…
          </div>
        </div>
      )}

      {/* left-14 避開 Leaflet zoom 控制鈕（避免蓋住 +/- 造成點不到） */}
      <div className="absolute top-3 left-14 z-[1000] rounded-full p-1 flex gap-1" style={overlayStyle}>
        {([
          { v: 'marker', l: '標記' },
          { v: 'heat',   l: '熱力圖（預售屋）' },
        ] as const).map(o => (
          <button
            key={o.v}
            onClick={() => setViewMode(o.v)}
            className="px-3 py-1 rounded-full transition-colors"
            style={viewMode === o.v
              ? { background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600 }
              : { background: 'transparent', color: 'var(--text-muted)' }}
          >
            {o.l}
          </button>
        ))}
      </div>

      {!loading && (
        <div className="absolute top-3 right-3 z-[1000] rounded-full px-3 py-1" style={overlayStyle}>
          {count.toLocaleString()} 棟
        </div>
      )}

      {/* 操作提示：不劫持頁面捲動後，告訴使用者怎麼縮放地圖 */}
      {hint && (
        <div className="absolute inset-x-0 top-1/2 z-[1001] flex justify-center pointer-events-none" style={{ transform: 'translateY(-50%)' }}>
          <div className="rounded-full px-4 py-2" style={{ ...overlayStyle, color: 'var(--text-strong)', fontSize: 'var(--text-sm)' }}>
            {hint === 'wheel' ? '按住 Ctrl（Mac 為 ⌘）再捲動滾輪即可縮放地圖' : '用兩指移動或縮放地圖'}
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-3 z-[1000] rounded-xl px-3 py-2 flex flex-col gap-1.5" style={{ ...overlayStyle, maxWidth: 'calc(100% - 24px)' }}>
        <div className="flex flex-col gap-0.5">
          <span>預售屋單價（萬/坪，{viewMode === 'heat' ? '熱力強度' : '標記與群集顏色'}）</span>
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
          <>
            <span style={{ fontSize: 'var(--text-3xs)', color: 'var(--text-faint)' }}>群集圓內：上＝預售中位單價，下＝棟數</span>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: EXISTING_COLOR }} />成屋</div>
          </>
        )}
        {/* 座標是以路名 geocode，同一條路共用一點；必須明講，否則使用者會把標記當成建案位置 */}
        <span style={{ fontSize: 'var(--text-3xs)', color: 'color-mix(in srgb, var(--warning) 50%, var(--text-strong))', lineHeight: 1.45 }}>
          ⚠ 位置為路段代表點（同路段共用一點），非建案精確位置
        </span>
      </div>

      <style>{`
        .map-marker { background:rgba(13,20,32,0.92); border:1.5px solid; border-radius:8px; padding:2px 6px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,.4); }
        /* 以下三個是「地圖圖形標記」而非排版文字，字級刻意固定、不跟隨 --font-scale：
           marker 與 cluster 是固定尺寸的圓形/膠囊，字放大會直接爆出圖形外；
           heat-label 疊在熱力色塊上，放大會蓋掉相鄰色塊。
           地圖疊層的 UI（模式切換、棟數、圖例）與 popup 內文則已改用字級 token。 */
        .map-marker-price { font-size:11px; font-weight:600; line-height:1.4; }
        .map-heat-label { color:#f1f5f9; font-size:11px; font-weight:700; text-align:center; white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,.85), 0 0 6px rgba(0,0,0,.6); }
        /* 群集：底色由 JS 依預售中位單價決定（與圖例同一色階），白框讓它在底圖上浮起來 */
        .map-cluster { width:100%; height:100%; border:2px solid rgba(255,255,255,.85); border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.05; box-shadow:0 2px 8px rgba(0,0,0,.35); font-family:var(--font-mono); }
        .map-cluster b { font-size:12px; font-weight:700; }
        .map-cluster span { font-size:9.5px; opacity:.85; }
        .leaflet-popup-content-wrapper { background:#0d1420!important; color:#e2e8f0!important; border:1px solid rgba(255,255,255,.1)!important; border-radius:12px!important; box-shadow:0 8px 32px rgba(0,0,0,.5)!important; }
        .leaflet-popup-tip { background:#0d1420!important; }
        .leaflet-popup-close-button { color:#9ca3af!important; }
      `}</style>
    </div>
  )
}
