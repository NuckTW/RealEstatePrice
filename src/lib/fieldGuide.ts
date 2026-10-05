/**
 * 村里明細「不計分」欄位的白話說明
 * 明細面板（點欄位名稱展開）與「指數說明」頁籤（對照表）共用這一份，改文字只改這裡
 * 文字原則：how 一句說怎麼算、read 一句說怎麼看；單位跟明細面板顯示的一致
 */
export interface FieldGuide {
  key: string
  label: string
  unit: string
  how: string    // 怎麼算
  read: string   // 怎麼看
}

export interface FieldGuideGroup {
  title: string
  period: string  // 資料期間（白話）
  items: FieldGuide[]
}

export const FIELD_GUIDE: FieldGuideGroup[] = [
  {
    title: '其他觀察', period: '最近 12 個月，每月更新（租金比除外）',
    items: [
      { key: 'hhSize', label: '戶量', unit: '人／戶', how: '人口 ÷ 戶數。', read: '越小代表小家庭、單身戶越多。' },
      { key: 'splitSpeed', label: '分戶速度', unit: '百分點', how: '戶數成長率 − 人口成長率。兩個 % 相減，所以單位是百分點。', read: '正值＝人沒變多、戶卻變多，代表有人成家或搬出獨立；接近 0 就是沒在分戶。' },
      { key: 'netOtherCity', label: '跨縣市淨移入', unit: '‰', how: '從外縣市遷入 − 遷出到外縣市，換算成每千人。', read: '+5‰ 代表每 1,000 人一年淨多 5 人從外縣市搬來。' },
      { key: 'netOtherTown', label: '市內他區淨移入', unit: '‰', how: '從台南其他區遷入 − 遷出到其他區，換算成每千人。', read: '正值代表吸引台南其他區的人搬來。' },
      { key: 'netSameTown', label: '同區跨里淨移入', unit: '‰', how: '從同一區其他里遷入 − 遷出，換算成每千人。', read: '正值代表同區的人往這個里搬，多半是新住宅入住。' },
      { key: 'women1549', label: '育齡婦女（15–49 歲）', unit: '人（占人口 %）', how: '15–49 歲女性人數；括號是占全里人口比例。', read: '比例越高，未來出生數的底子越厚。' },
      { key: 'divorce', label: '離婚對數／行政區離婚率', unit: '對／‰', how: '前者是這個里近 12 月離婚對數；後者是所屬行政區每千人一年離婚對數。', read: '里和里之間的差異經檢定多為隨機波動，所以看行政區的數字比較準。' },
      { key: 'rentRatio', label: '大樓租金／房貸月付比', unit: '倍', how: '行政區大樓每坪月租 ÷ 同坪數房貸月付（八成、30 年、臺南最新一季新增房貸平均利率）。', read: '越接近 1 越容易從租屋轉買房；0.5 代表租金只要房貸一半，租比買划算很多。利率可在「房市與負擔」頁籤調整。' },
    ],
  },
  {
    title: '家戶結構', period: '戶長資料每季、學歷與戶數每年',
    items: [
      { key: 'headAvgAge', label: '戶長平均年齡', unit: '歲', how: '全里戶長年齡的平均。', read: '越年輕，正在成家、買房階段的家戶越多。' },
      { key: 'head2645', label: '26–45 歲戶長占比', unit: '%（較一年前：百分點）', how: '26–45 歲戶長 ÷ 全部戶長；括號是跟一年前同一季相比。', read: '從 23.5% 變成 22.0% 寫成 −1.5 百分點，不是「少了 1.5%」。' },
      { key: 'head65p', label: '65 歲以上戶長占比', unit: '%', how: '65 歲以上戶長 ÷ 全部戶長。', read: '越高通常購屋需求越低。' },
      { key: 'multiHh', label: '一宅多戶占比', unit: '%（較一年前：百分點）', how: '同一間住宅設籍 2 戶以上的住宅比例。', read: '市區多是成年子女跟父母同住（潛在分戶買房）；偏鄉多是三代同堂，要搭配年齡結構看。' },
      { key: 'soloDwelling', label: '1 人一宅占比', unit: '%', how: '以「住宅」為單位：整間只有 1 人設籍的住宅比例。', read: '跟「單獨生活戶」不同，一間住宅可能設好幾戶。' },
      { key: 'dwellingsGrowth', label: '設籍宅數年增', unit: '%', how: '有人設戶籍的住宅數，跟一年前同一季相比。', read: '反映新住宅入住；跟指數裡的「設籍宅數成長」是同一個數。' },
      { key: 'eduUnivPlus', label: '大學以上學歷占比', unit: '%', how: '15 歲以上人口中大學以上畢業的比例。', read: '大致反映白領程度與購屋能力。' },
      { key: 'singleHh', label: '單獨生活戶占比', unit: '%', how: '以「戶」為單位：一人一戶的戶數 ÷ 全部戶數。', read: '通常比「1 人一宅」高，因為一間住宅可設好幾戶。' },
    ],
  },
  {
    title: '生活機能', period: 'OpenStreetMap 最新資料',
    items: [
      { key: 'poi', label: '學校、公園、超市等', unit: '處', how: '里界內 OpenStreetMap 標記的點數。', read: '社群資料，覆蓋率不一，0 不代表一定沒有。' },
    ],
  },
]

/** key → 說明，給明細面板查 */
export const FIELD_GUIDE_BY_KEY: Map<string, FieldGuide> = new Map(FIELD_GUIDE.flatMap(g => g.items).map(f => [f.key, f]))
