# 台南市購屋潛在客群分析：資料串接計畫

> 交接自 claude.ai 對話（2026-10-02）。目標專案：RealEstatePrice（tainan-realestate-ai，Next.js + Supabase）。
> 工作方式：Opus 規劃與審查，Sonnet 執行。所有終端機指令執行前，先說明執行路徑並等我確認。

## 目標

在現有台南房價平台上新增「潛在客群」分析，以**村里**為最小單位，找出年輕、正在分戶、人口淨移入、所得相對高的區域。

核心邏輯：誰有需求（人口）× 誰買得起（所得）× 為什麼買在這裡（就業／交通／學區）× 市場現況（供給與成交）。

## 已做的決定

- 分兩期。第一期只接「村里級、免費、可自動化」的 5 個來源。
- 所得資料只做**相對排名**，不當絕對購買力（課稅資料不含移轉、免稅、分離課稅所得，且落後約 2 年）。
- 暫緩／放棄：電信信令人口（付費，自然人每單元 2,000、法人 9,500）、外縣市買方比例（無公開資料）、591 爬蟲（使用條款風險）。

## 第一期資料來源

| # | 資料 | 粒度 | 更新 | 取得方式 |
|---|---|---|---|---|
| 1 | 村里戶數、單一年齡人口 | 村里 | 每月 | 戶政 API `ODRP014`（新增區域代碼版；舊版 ODRP005 已停更） |
| 2 | 村里出生、死亡、結婚、離婚 | 村里 | 每月 | 戶政 API `ODRP060`（含同婚） |
| 3 | 遷入、遷出（含來源縣市） | 村里 | 每月 | 戶政 API `ODRP011`（原規劃用 SEGIS，改用此 API：同一來源、同一代碼） |
| 4 | 綜稅綜合所得總額各縣市鄉鎮村里統計分析表 | 村里 | 每年 8 月，最新為 112 年度 | `https://www.fia.gov.tw/WEB/fia/ias/ias{年度}/{年度}_165-9.csv`（data.gov.tw 103066） |
| 5 | 實價登錄（重點補租賃） | 去識別門牌 | 每月 1、11、21 日 | https://plvr.land.moi.gov.tw/DownloadOpenData（schema-main / build / land / park） |

### 主要欄位

- 戶政 API：`https://www.ris.gov.tw/rs-opendata/api/v1/datastore/{代碼}/{民國年月}?COUNTY=臺南市`，文件 https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1
- **#1–#3 共同鍵**：district_code（11 碼，如 67000010001）＝ villages.village_code；台南 650 里
- **#4**：鄉鎮市區、村里、納稅單位（戶）、綜合所得總額、平均數、中位數、第一分位數、第三分位數、標準差、變異係數
- **#5 租賃**：d_lvr_land_c.csv，35 欄（含出租型態、租賃期間、租賃住宅服務）

## 第二期（之後再做）

- 南科從業員工數（園區級、含學歷別，月更）：https://data.gov.tw/dataset/7599
- 建照／使照統計（縣市級、落後約 2 個月）：https://data.gov.tw/dataset/13488；行政區級需向台南市工務局確認
- 台南市住宅價格指數（14 項次分類，含東區、南科區域）：https://land.tainan.gov.tw/cp.aspx?n=38358
- 學區學生數、捷運藍線與重劃區進度

## 待處理的技術問題

1. **村里對齊**：戶政用 site_id 代碼，綜稅只有鄉鎮名＋村里名，SEGIS 用村里代碼。需建一張村里主檔，處理里名變更與合併。
2. **時間對齊**：所得落後約 2 年，指數計算時要標註資料年份。
3. **租賃資料**：確認平台目前是否已匯入租賃實價登錄，若無則補上（用於「租轉買」潛在客）。
4. 遵守平台既有限制：熱力圖維持只顯示預售屋。

## 待定義的指標（草案，需討論）

- 25–39 歲人口占比、近 12 個月變化
- 戶量（人口／戶數）與分戶速度（戶數成長率 − 人口成長率）
- 近 12 個月結婚對數、出生數
- 近 12 個月社會增加率
- 所得中位數於全市的百分位排名
- 租金／房貸月付比（由實價登錄估算）
→ 加權合成「村里潛在客群指數」

## 第一個任務建議

1. 先讀現有 repo 結構與 Supabase schema，回報目前有哪些資料表、租賃資料是否已存在。
2. 提出村里主檔與 5 個來源的資料表設計，**等我確認再建表**。
3. 寫第一個匯入腳本（戶政 API #1），只抓台南市，跑一個月份驗證。

---

## 實作狀態（2026-10-02，分支 `feat/potential-buyers-phase1`）

### 已完成
- `supabase/migrations/20261002_potential_buyers.sql`：villages、village_population_monthly、village_vital_monthly、village_migration_monthly、village_income_yearly、rentals（**尚未在 Supabase 執行**）
- `scripts/fetch_ris_village.py`：#1–#3，皆支援 `--dry-run`
- `scripts/fetch_fia_income.py`：#4，含異體字對照
- `scripts/fetch_rentals.py`：#5
- `scripts/gov_http.py`：Python 3.13 對政府憑證（缺 Subject Key Identifier）的相容處理
- `.github/workflows/potential-buyers.yml`：每月 5 日自動更新

### 已驗證（以真實資料 dry-run）
- 戶政 11508：650 里全數取得；年齡級距加總 = 總人口（0 筆不符）；全市 1,846,409 人、782,685 戶
- 遷徙欄位恆等式：遷入合計 = 各縣市 + 市內他區 + 國外 + 初設 + 其他，650 里全部成立
- 所得 110–112 年度：649 里中 648 里對上代碼，唯一例外為「官田區東西庄里」（戶政已分割為東庄里、西庄里，所得無法拆分，village_code 留 NULL）
- 所得 108–109 年度：另有 2–3 個舊里名對不上（安南區顯宮里、新化區山腳里、關廟區南雄里），匯入時會列印，需人工確認新舊名
- 租賃 115S1／115S2：各約 3,800–4,100 筆，住家用月租中位數 11,500／12,000 元

### 執行順序（執行路徑：專案根目錄）
1. Supabase SQL Editor 執行 migration
2. `python3 scripts/fetch_ris_village.py --backfill`（11001 起，約 70 個月 × 3 個 API，約 5 分鐘）
3. `python3 scripts/fetch_fia_income.py --backfill`
4. `python3 scripts/fetch_rentals.py --backfill`

### 下一步
- 確認指標定義與權重 → 建 `village_buyer_indicators` view
- 前端「潛在客群」頁（村里地圖需村里界線圖資：內政部村里界圖 SHP → GeoJSON）
