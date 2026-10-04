/**
 * 臺南重大建設時程表（人工整理，非自動匯入）
 *
 * 整理日期：2026-10-04（Claude 依公開報導與政府新聞稿整理，使用者確認）
 * ⚠️ 時程以官方最新公告為準；各來源說法不一時，於 note 註明
 * 更新方式：直接編輯本檔（新增項目、更新 status / timeline / sources），並更新 VERIFIED_AT
 */

export const VERIFIED_AT = '2026-10-04'

export type ProjectCategory = '捷運' | '鐵路' | '道路' | '產業' | '重劃區'
export type ProjectStatus = '規劃中' | '已核定' | '發包中' | '施工中' | '即將完工' | '已完工'

export interface MajorProject {
  id: string
  name: string
  category: ProjectCategory
  status: ProjectStatus
  /** 直接受影響的行政區（用來對應頁面的行政區篩選與村里明細） */
  districts: string[]
  /** 預定完成（年或年月）；不確定時保留文字說明 */
  expected: string
  /** 排序用：預定完成年（西元） */
  expectedYear: number | null
  budget?: string
  summary: string
  /** 對購屋客群的意義 */
  impact: string
  timeline: { date: string; label: string }[]
  note?: string
  sources: { title: string; url: string }[]
}

export const MAJOR_PROJECTS: MajorProject[] = [
  {
    id: 'rail-underground',
    name: '臺南市區鐵路地下化（第一階段）',
    category: '鐵路',
    status: '即將完工',
    districts: ['東區', '北區', '南區'],
    expected: '2026-10 地下化通車',
    expectedYear: 2026,
    budget: '293.6 億元',
    summary: '大橋站以南至保安站以北共 8.23 公里改為地下，改建臺南站、新設林森站、復設南臺南站，消除平交道與陸橋。',
    impact: '東區鐵道兩側長期被切割的生活圈縫合，原軌道將改為綠園道；臺南、林森、南臺南站周邊為最直接受惠區。',
    timeline: [
      { date: '2009-09', label: '行政院核定' },
      { date: '2017-03', label: '主體工程開工' },
      { date: '2025-10', label: '隧道主結構全線完成' },
      { date: '2026-01', label: '永久軌全線接合' },
      { date: '2026-10', label: '地下化切換通車（10/17）' },
    ],
    note: '通車日：鐵道局 2026-10-04 公布為 10/17；部分較早報導為 10/18。地面綠園道與站區開發為後續工程。',
    sources: [
      { title: '維基百科：臺南市區鐵路地下化計畫', url: 'https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8D%97%E5%B8%82%E5%8D%80%E9%90%B5%E8%B7%AF%E5%9C%B0%E4%B8%8B%E5%8C%96%E8%A8%88%E7%95%AB' },
      { title: '中央社：台南鐵路地下化隧道主結構完成 邁向2026年底通車（2025-10-28）', url: 'https://www.cna.com.tw/news/aloc/202510280364.aspx' },
    ],
  },
  {
    id: 'rail-yongkang',
    name: '永康鐵路地下化（延伸段）',
    category: '鐵路',
    status: '已核定',
    districts: ['永康區'],
    expected: '2038',
    expectedYear: 2038,
    budget: '357.24 億元（可行性研究估算）',
    summary: '延續市區段往北 6.72 公里，永康、大橋站改建為地下站，並增設康橋站，消除 3 處平交道與 3 座陸橋。',
    impact: '永康區鐵道兩側整合、新增康橋站；工期長，屬中長期題材。',
    timeline: [
      { date: '2025-09', label: '行政院核定可行性研究' },
      { date: '2026-12', label: '鐵道局目標完成綜合規劃' },
      { date: '2038', label: '預定完工' },
    ],
    sources: [
      { title: '中央社：行政院核定南鐵地下化延伸永康 估總經費357億元（2025-09-27）', url: 'https://www.cna.com.tw/news/aloc/202509270090.aspx' },
      { title: '華視：南鐵地下化延伸永康 鐵道局擬年底完成綜合規劃（2026-09）', url: 'https://news.cts.com.tw/cna/local/202609/202609043075127.html' },
    ],
  },
  {
    id: 'mrt-blue-1',
    name: '臺南捷運藍線第一期',
    category: '捷運',
    status: '發包中',
    districts: ['永康區', '東區', '仁德區'],
    expected: '2032（部分來源 2033）',
    expectedYear: 2032,
    budget: '332.83 億元（中央補助 59.27%）',
    summary: '高架跨座式單軌，大橋站至仁德轉運站（含文化中心支線）約 8.6 公里、10 站及仁德機廠，串聯台鐵大橋站、平實轉運站、文化中心。',
    impact: '臺南第一條捷運；大橋、平實、文化中心、仁德沿線站點周邊為主要受惠區。',
    timeline: [
      { date: '2018-12', label: '行政院核定' },
      { date: '2025-10', label: '行政院核定綜合規劃' },
      { date: '2026-06', label: '基本設計通過中央審議' },
      { date: '2026-08', label: '統包招標（約 294 億元，9/29 截止收件）' },
      { date: '2026-12', label: '預定動工' },
      { date: '2032', label: '預定通車' },
    ],
    note: '通車年：市府與多數報導為 2032 年，維基百科記載 2033 年。',
    sources: [
      { title: '中央社：台南捷運第1期藍線擬2026年動工 2032年通車（2024-12-06）', url: 'https://www.cna.com.tw/news/aloc/202412060083.aspx' },
      { title: '聯合報：台南首條捷運今起招標 294億統包拚9月底收件（2026-08-18）', url: 'https://udn.com/vote2026/story/7326/9698247' },
      { title: '維基百科：臺南捷運藍線', url: 'https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8D%97%E6%8D%B7%E9%81%8B%E8%97%8D%E7%B7%9A' },
    ],
  },
  {
    id: 'mrt-blue-ext',
    name: '臺南捷運藍線第一期延伸線',
    category: '捷運',
    status: '規劃中',
    districts: ['仁德區', '歸仁區', '關廟區'],
    expected: '2036',
    expectedYear: 2036,
    summary: '自仁德轉運站經仁德、歸仁，分別到關廟國中站與沙崙綠能科學城站，約 15 公里、15 站及歸仁機廠。',
    impact: '把捷運延伸到沙崙高鐵特區與關廟，歸仁、關廟的通勤條件改善。',
    timeline: [
      { date: '2026', label: '爭取中央核定' },
      { date: '2036', label: '預定完工' },
    ],
    sources: [
      { title: '維基百科：臺南捷運藍線（第一期延伸線）', url: 'https://zh.wikipedia.org/zh-tw/%E8%87%BA%E5%8D%97%E6%8D%B7%E9%81%8B%E8%97%8D%E7%B7%9A' },
    ],
  },
  {
    id: 'mrt-green',
    name: '臺南捷運綠線',
    category: '捷運',
    status: '規劃中',
    districts: ['東區', '中西區', '安平區', '北區'],
    expected: '未定（可行性研究審查中）',
    expectedYear: null,
    summary: '東西向路線：東起台 39，經平實轉運站、台鐵臺南站、舊城區、永華市政中心至安平地方法院，修正方案 19 站（6 站地下）。',
    impact: '串聯市中心、平實與安平；仍在可行性研究階段，時程不確定。',
    timeline: [
      { date: '2025-10', label: '完成地方說明會，修正可行性研究' },
      { date: '2026', label: '提報交通部、行政院審議' },
    ],
    sources: [
      { title: '聯合報：台南捷運貫穿市區「綠線」修正19個站點曝 這6站在地下', url: 'https://udn.com/news/story/7326/8539518' },
    ],
  },
  {
    id: 'mrt-dark-green',
    name: '臺南捷運深綠線',
    category: '捷運',
    status: '規劃中',
    districts: ['新市區', '善化區', '永康區', '歸仁區'],
    expected: '未定（可行性研究審查中）',
    expectedYear: null,
    budget: '約 872 億元（規劃估算）',
    summary: '規劃 21.3 公里、14 站，串聯南科與沙崙。',
    impact: '南科就業中心與沙崙之間的軌道連結；路線與時程仍待中央審查。',
    timeline: [
      { date: '2026', label: '可行性研究中央審查、交通部現勘' },
    ],
    note: '行政區為依「南科—沙崙」走向推估，實際路線以核定版本為準。',
    sources: [
      { title: '自由時報：台南捷運深綠線21.3公里規劃設14站 872億規模串聯南科與沙崙', url: 'https://news.ltn.com.tw/news/Tainan/breakingnews/5553180' },
    ],
  },
  {
    id: 'freeway-north-ring',
    name: '國道1號增設北外環交流道',
    category: '道路',
    status: '即將完工',
    districts: ['安南區', '北區', '永康區'],
    expected: '2026-10 底（原訂 2026 年底）',
    expectedYear: 2026,
    budget: '13.98 億元（交流道工程）',
    summary: '國 1 約 317K 與北外環交會處增設交流道並拓寬主線，分流永康交流道車潮。',
    impact: '市區往返南科預估可省 20–30 分鐘；安南、北區上國道更方便。',
    timeline: [
      { date: '2023-04', label: '決標' },
      { date: '2024-09', label: '開工' },
      { date: '2026-03', label: '進度 78.89%（超前）' },
      { date: '2026-10', label: '目標通車' },
    ],
    sources: [
      { title: '臺南市政府：北外環連結國道1號交流道即將開工 預計115年底完工', url: 'https://www.tainan.gov.tw/News_Content.aspx?n=13370&s=8544044' },
      { title: '聯合報：國1台南段增闢北外環交流道 市區行車南科有望快30分鐘', url: 'https://udn.com/news/story/7326/9383033' },
    ],
  },
  {
    id: 'tsmc-stsp-a',
    name: '台積電南科特定區 A 區新廠',
    category: '產業',
    status: '施工中',
    districts: ['安定區', '善化區', '新市區'],
    expected: '2028',
    expectedYear: 2028,
    summary: '南科特定區開發區塊 A 區約 15.46 公頃新建半導體廠，市府以 50 年專案設定地上權提供安定區 22 筆產業專用區土地。',
    impact: '完工後約 1,400 名員工、500 名協力廠商人員進駐，南科走廊（安定、善化、新市）住宅需求持續。',
    timeline: [
      { date: '2026', label: '建築規劃、執照申請與開工' },
      { date: '2028', label: '預定完工啟用' },
    ],
    note: '台積電未公開此廠製程；媒體推測與 2 奈米擴產相關，未經證實。',
    sources: [
      { title: '中央社：AI需求爆發大投資 台積電南科擴廠預計2028年完工（2026-03-04）', url: 'https://www.cna.com.tw/news/afe/202603040043.aspx' },
      { title: '聯合報：台積電再擴廠布局台南 南科A區塊22筆地上權完成簽約', url: 'https://udn.com/news/story/7240/9558557' },
    ],
  },
  {
    id: 'shalun',
    name: '沙崙智慧綠能科學城／高鐵臺南站特定區',
    category: '產業',
    status: '施工中',
    districts: ['歸仁區'],
    expected: '持續開發',
    expectedYear: null,
    summary: '綠能科技示範場域、資安研發專區、中研院南部院區、會展中心已啟用；都市計畫滾動調整，推動 AI 生態園區、健康園區與成大醫療分區。',
    impact: '高鐵、台鐵沙崙線與未來捷運藍線延伸三線交會，是歸仁、仁德的長期就業與人口成長引擎。',
    timeline: [
      { date: '2019', label: '科學城啟用' },
      { date: '2026', label: '特定區產專區變更（約 0.93 公頃引進 AI、資安產業）' },
      { date: '2036', label: '捷運藍線延伸至沙崙站（預定）' },
    ],
    sources: [
      { title: '自由時報：推台南沙崙綠能科學城開發 都計採滾動式調整', url: 'https://estate.ltn.com.tw/article/24210' },
      { title: 'ETtoday：沙崙解鎖2813坪公有地擬引進AI產業', url: 'https://house.ettoday.net/news/3209872' },
    ],
  },
  {
    id: 'yongkang-artillery',
    name: '永康砲校區段徵收（第二期）',
    category: '重劃區',
    status: '施工中',
    districts: ['永康區'],
    expected: '2029 年底',
    expectedYear: 2029,
    summary: '原陸軍砲訓部永康校區 69.03 公頃，第一期臺南總圖等公共設施已啟用；第二期依都市計畫闢建道路、公園綠地。',
    impact: '永康大型新開發區，完工後釋出住宅與商業用地。',
    timeline: [
      { date: '2026-06', label: '公共設施工程動工（約 3 年半）' },
      { date: '2029-12', label: '預定完工' },
    ],
    sources: [
      { title: '聯合報：台南永康擁三大建設 東橋重劃區房市吸睛', url: 'https://money.udn.com/money/story/5930/9114643' },
    ],
  },
  {
    id: 'yongda',
    name: '永康永大市地重劃',
    category: '重劃區',
    status: '即將完工',
    districts: ['永康區'],
    expected: '2026',
    expectedYear: 2026,
    summary: '永康區市地重劃，土地權屬公有 5 人、私有 176 人。',
    impact: '完工後新增可建築用地，永康既有市區外圍的新住宅供給。',
    timeline: [{ date: '2026', label: '預定完工' }],
    sources: [
      { title: '臺南市不動產開發公會：永大市地重劃區預計2026年完工', url: 'https://tnh.org.tw/news.asp?ID=12871&iPage=4&q=' },
    ],
  },
  {
    id: 'jiufenzi',
    name: '九份子市地重劃',
    category: '重劃區',
    status: '已完工',
    districts: ['安南區'],
    expected: '重劃完成，公共設施陸續建置',
    expectedYear: null,
    summary: '安南區西側重劃區，保留水岸自然景觀；安南區全民運動館等公共設施興建中。',
    impact: '安南區新興住宅區，國中小新生數為全市少數成長區之一。',
    timeline: [
      { date: '2026', label: '安南區全民運動館上半年進度約 60%' },
    ],
    sources: [
      { title: '臺南市政府地政局：第一期九份子市地重劃', url: 'https://land.tainan.gov.tw/News_Content.aspx?n=29687&s=7811380' },
    ],
  },
  {
    id: 'pingshi',
    name: '平實營區市地重劃',
    category: '重劃區',
    status: '已完工',
    districts: ['東區', '永康區'],
    expected: '已完成',
    expectedYear: null,
    summary: '東區與永康交界 42.4 公頃，鄰成大、成大醫院、奇美醫院，平實轉運站為捷運藍線、綠線交會點。',
    impact: '臺南市中心最成熟的新開發區之一，未來兩條捷運交會。',
    timeline: [{ date: '—', label: '重劃完成' }],
    sources: [
      { title: '臺南市政府地政局：第二期平實營區市地重劃', url: 'https://land.tainan.gov.tw/News_Content.aspx?n=29687&s=7811382' },
    ],
  },
]
