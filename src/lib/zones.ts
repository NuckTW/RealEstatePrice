/**
 * 區域篩選（重劃區／生活圈／商業區）
 *
 * 實價登錄沒有「重劃區」欄位，這裡用「行政區＋路名規則」把交易歸到區域：
 *   - roadPrefixes：路名前綴，'平道' 會命中平道路、平道二路、平道十六街…（之後新開的路也會自動納入）
 *   - roads：完整路名或巷，'文成一路'、'文賢路1122巷'
 *   - sections：地段，預售屋常以「平道段239地號」登記
 *   - projects：建案名前綴，用來收邊界路上確定在區內的預售案
 *   - excludeRoads：前綴命中但位在區外的路
 *
 * 路名依 2026-10-29 實價登錄反推（新完工／預售集中的路段＋建案座標），再對照網路報導。
 * 邊界路（如西門路四段、文賢路）整條收會混入區外交易，所以只收區內巷道或建案；
 * 範圍有疑慮的地方寫在 note，請在地人確認後再調整。
 *
 * 本檔不 import 其他模組：filters.ts 的 buildWhere 會引用這裡，也方便直接用 node 執行驗證。
 */

export type ZoneType = '重劃區' | '生活圈' | '商業區'

export interface Zone {
  id: string
  name: string
  type: ZoneType
  district: string
  roadPrefixes?: string[]
  roads?: string[]
  sections?: string[]
  projects?: string[]
  excludeRoads?: string[]
  /** 涵蓋路段的白話摘要（篩選選單顯示） */
  summary: string
  /** 範圍說明與已知限制 */
  note: string
  sources: { title: string; url: string }[]
}

export const ZONES: Zone[] = [
  {
    id: 'yanhang',
    name: '鹽行重劃區',
    type: '重劃區',
    district: '永康區',
    roadPrefixes: ['平道'],
    sections: ['平道段'],
    summary: '平道路、平道X路／街',
    note: '鹽行國中周邊區段徵收（俗稱重劃區），位於國道1號與北外環之間，區內新路統一命名為「平道X路／街」。'
      + '舊鹽行市區（新行街、中正北路、永安路）與昌益綠園／綠邸所在的鹽新段不在此範圍。',
    sources: [
      { title: '好房網：永康鹽行國中重劃區', url: 'https://www.housefeel.com.tw/article/永康-鹽行國中重劃區-南科/' },
    ],
  },
  {
    id: 'jiufenzi',
    name: '九份子重劃區',
    type: '重劃區',
    district: '安南區',
    roadPrefixes: ['九份子', '樂活', '生態', '宜居'],
    summary: '九份子大道、樂活X街、生態街、宜居X路',
    note: '第一期九份子市地重劃，約 101 公頃；東臨宜居路、北至嘉南大圳、南以鹽水溪為界。',
    sources: [
      { title: '臺南市政府地政局：第一期九份子市地重劃', url: 'https://land.tainan.gov.tw/News_Content.aspx?n=29687&s=7811380' },
      { title: '臺南市體育處：安南區全民運動館工程（基地四周道路）', url: 'https://sports.tainan.gov.tw/app_tnsport/views/web/upload_file/MES-1756450628032.pdf' },
    ],
  },
  {
    id: 'dawan',
    name: '大灣生活圈',
    type: '生活圈',
    district: '永康區',
    roadPrefixes: ['大灣'],
    roads: ['南灣街'],
    sections: ['大灣段', '北灣段'],
    summary: '大灣路、大灣東路、大灣一～七街、南灣街',
    note: '生活圈沒有官方邊界，暫以大灣路系與南灣街為準；崑大路另列「崑大重劃區」。只寫里名、不寫大灣路的門牌（如大灣里民族路）不會算進來。',
    sources: [
      { title: '樂居：永康大灣生活圈', url: 'https://www.leju.com.tw/page_blog/view/2052' },
    ],
  },
  {
    id: 'pingshi',
    name: '平實重劃區',
    type: '重劃區',
    district: '東區',
    roadPrefixes: ['平實'],
    sections: ['平實段'],
    projects: ['浩瀚無極'],
    summary: '平實路、平實X街／路，加中華東路一段的浩瀚無極',
    note: '原平實營區 42.4 公頃，106 年 12 月完工；中華東路一段臨路只收浩瀚無極，對面南紡一側不算。',
    sources: [
      { title: '臺南市政府地政局：第二期平實營區市地重劃', url: 'https://land.tainan.gov.tw/News_Content.aspx?n=29687&s=7811382' },
    ],
  },
  {
    id: 'huweiliao',
    name: '虎尾寮重劃區',
    type: '重劃區',
    district: '東區',
    roadPrefixes: ['裕'],
    excludeRoads: ['裕豐街'],
    summary: '「裕」字路：裕農路、裕信路、裕孝路、裕忠路、裕文路、裕義路…',
    note: '區內道路多以「裕」字開頭。裕豐街位置偏西暫不納入；裕農路整條計入，西段可能在區外。',
    sources: [
      { title: '好房網：虎尾寮行情', url: 'https://www.housefeel.com.tw/price-area/70103/' },
      { title: '中時新聞網：宗大虎隱', url: 'https://wantrich.chinatimes.com/news/20251103900565-420501' },
    ],
  },
  {
    id: 'zhengziliao',
    name: '鄭子寮重劃區',
    type: '重劃區',
    district: '北區',
    roads: [
      '文成路', '文成一路', '文成二路', '文成三路',
      '育德一街', '育德二路', '育德三街', '育成路', '育賢街',
      '文賢三街', '文賢路1122巷',
    ],
    sections: ['北元段'],
    projects: ['藏美表參道', '國泰原美', '欣府城-進士樓'],
    summary: '文成路、文成一～三路、育德二路、育成路、文賢三街',
    note: '和緯路以北、文賢路與西門路四段之間的棋盤住宅區（亦寫作鄭仔寮）。'
      + '邊界路（西門路四段、文賢路、和緯路）整條會混入區外，只收區內巷道與確定的建案；育德路、文賢二街跨過和緯路，暫不納入。',
    sources: [
      { title: 'ETtoday：台南豪宅聚落的「隱藏版重劃區」', url: 'https://finance.ettoday.net/news/3112026' },
    ],
  },
  {
    id: 'kunda',
    name: '崑大重劃區',
    type: '重劃區',
    district: '永康區',
    roads: ['崑大路'],
    summary: '崑大路',
    note: '永大路一段與崑大路口約 4.3 公頃，剛完工，區內新路還沒出現在實價登錄。'
      + '暫以崑大路整條計（多數在區外），有新建案後要補建案名。',
    sources: [
      { title: '聯合新聞網：永康崑大市地重劃完工', url: 'https://udn.com/news/story/7326/9516365' },
    ],
  },
  {
    id: 'beian',
    name: '北安商業區',
    type: '商業區',
    district: '安南區',
    roads: ['大安街', '義吉街'],
    projects: ['北安公園', '良勳森'],
    summary: '大安街、義吉街，加北安路二段的北安公園、良勳森悅',
    note: '商60（37 公頃，2025 年完工）與北側草湖寮重劃區合稱安南副都心，範圍在安中路一段、北安路二段、安通路五段、海佃路二段之間。'
      + '商60 土地還在標售、交易很少，所以把北側住宅區一起算；四條邊界路只收確定在區內的建案。',
    sources: [
      { title: '聯合新聞網：台南市府標售重劃區抵費地（商60）', url: 'https://money.udn.com/money/story/5621/9550802' },
      { title: '樂居：北安商業區與草湖寮重劃區', url: 'https://www.leju.com.tw/page_blog/view/728' },
    ],
  },
]

const ZONE_BY_ID = new Map(ZONES.map(z => [z.id, z]))

export function findZone(id: string): Zone | undefined {
  return ZONE_BY_ID.get(id)
}

/** 選單顯示用：「鹽行重劃區（永康）」 */
export function zoneLabel(z: Zone): string {
  return `${z.name}（${z.district.replace(/區$/, '')}）`
}

const sqlStr = (s: string) => s.replace(/'/g, "''")
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const alt = (list: string[]) => list.map(reEsc).join('|')

// 路名前面只會接：開頭、行政區、里名、路口連接字（與、和、及、X、&、、）
const BOUNDARY = '(^|[區里與和及、Xx×＆&.,/])'

/** 單一區域的 SQL 條件（含行政區限定）。p 為 transactions 的欄位前綴，如 't.' */
export function zoneCondition(z: Zone, p = ''): string {
  // 門牌數字有全形也有半形，比對前先統一成半形
  const addr = `TRANSLATE(${p}address, '０１２３４５６７８９', '0123456789')`
  const hits: string[] = []
  if (z.roadPrefixes?.length) {
    // 前綴後最多 3 個字再接路／街（平道十六街、大灣東路、樂活10街），遇到巷弄號段里就停
    hits.push(`${addr} ~ '${sqlStr(`${BOUNDARY}(${alt(z.roadPrefixes)})[^巷弄號段里路街]{0,3}(路|街)`)}'`)
  }
  const exact = [...(z.roads ?? []), ...(z.sections ?? [])]
  if (exact.length) hits.push(`${addr} ~ '${sqlStr(`${BOUNDARY}(${alt(exact)})`)}'`)
  for (const name of z.projects ?? []) {
    hits.push(`${p}project_name LIKE '${sqlStr(name)}%'`)
  }
  const conds = [`${p}district = '${sqlStr(z.district)}'`, `(${hits.join(' OR ')})`]
  if (z.excludeRoads?.length) {
    conds.push(`${addr} !~ '${sqlStr(`${BOUNDARY}(${alt(z.excludeRoads)})`)}'`)
  }
  return `(${conds.join(' AND ')})`
}

/** 多個區域取聯集；沒有任何有效 id 時回傳 null（不加條件） */
export function zonesWhere(ids: string[], p = ''): string | null {
  const zones = ids.map(findZone).filter((z): z is Zone => !!z)
  if (zones.length === 0) return null
  return `(${zones.map(z => zoneCondition(z, p)).join(' OR ')})`
}
