# 台南市購屋潛在客群分析：完整交接文件

> 最後更新：2026-10-02｜分支：`feat/potential-buyers-phase1`（尚未合併進 main）
> 專案：RealEstatePrice（https://tainan-realestate-ai.vercel.app，Next.js 16 + Supabase + Python 抓取腳本 + GitHub Actions）
> 本文件整合 claude.ai 對話中的研究、評估、決定，以及 Claude Code 的實作與匯入結果。新的工作階段讀完本文即可接手。

---

## 0. 給接手的 Claude Code：工作規則

1. **任何終端機指令執行前，先說明要在哪個資料夾路徑執行，等使用者確認後才執行。** 使用者本機專案路徑：`~/AI/RealEstatePrice`（MacBook Air M5）。
2. 工作方式：Opus 規劃與審查，Sonnet 執行。
3. 全域限制：地圖熱力圖維持「只顯示預售屋」，任何任務都不得擴展到成屋。
4. 本專案的 Next.js 版本有破壞性變更，寫前端前先讀 `node_modules/next/dist/docs/`（見 `AGENTS.md`）。
5. 建表、改 schema 前先給使用者看 SQL，確認後再執行。
6. 使用者以繁體中文溝通。

---

## 1. 目標與核心邏輯

在現有台南房價平台上新增「潛在客群」分析，以**村里**為最小單位，找出年輕、正在分戶、人口淨移入、所得相對高的區域。

核心邏輯：**誰有需求（人口）× 誰買得起（所得）× 為什麼買在這裡（就業／交通／學區）× 市場現況（供給與成交）**

使用者原本已知的指標：人口年齡、戶數比、結婚數、分戶比。

---

## 2. 完整資料來源研究（六大面向）

### 2.1 人口動態
| 資料 | 用途 | 來源 |
|---|---|---|
| 遷入／遷出、社會增加率 | 哪一區在吸人，比自然增加更能反映購屋需求 | 內政部戶政司（✅ 已接，ODRP011） |
| 出生數 | 首購轉換屋（生小孩換大房）的前置指標 | 戶政司（✅ 已接，ODRP060） |
| 離婚數 | 一戶變兩戶的需求 | 戶政司（✅ 已接，ODRP060） |
| 未來人口推估 | 中長期總量 | 國發會人口推估查詢系統 |
| 最小統計區人口結構 | 比村里更細的生活圈（每區約 450 人以下） | 內政部 SEGIS https://segis.moi.gov.tw |

### 2.2 購買力
| 資料 | 用途 | 來源 |
|---|---|---|
| 綜所稅所得（村里中位數、分位數） | 最接近「這一里有多少錢」的官方數據 | 財政部財政資訊中心（✅ 已接） |
| 家庭收支調查 | 縣市級負擔能力基準 | 主計總處 |
| 房價所得比、貸款負擔率 | 首購壓力 | 內政部不動產資訊平台「住宅價格負擔能力指標」 |
| 房貸利率、新增購屋貸款 | 資金面鬆緊、新青安等政策影響 | 中央銀行金融統計 |

### 2.3 就業與產業（台南特別重要）
| 資料 | 用途 | 來源 |
|---|---|---|
| 南科從業員工數（含學歷別，月更） | 台南最大外來購屋族群來源 | https://data.gov.tw/dataset/7599 |
| 沙崙、永康、樹谷等園區就業 | 次要就業核心 | 各園區、經濟部 |
| 工業及服務業普查 | 各區就業結構 | 主計總處 |
| 通勤旅次 | 「在 A 上班、住 B」的客群 | 交通部運輸研究所 |

參考數字：南科 2025 年總就業 98,513 人，台南園區約 7.7 萬人（2026 年 7 月）。

### 2.4 市場供給與成交
| 資料 | 用途 | 來源 |
|---|---|---|
| 實價登錄買賣、預售 | 價格帶、坪數帶、總價帶 → 對應客群 | 平台已有（transactions 表） |
| 實價登錄租賃 | 「租轉買」潛在客 | ✅ 已接（rentals 表） |
| 建照、使照、開工 | 未來 2–4 年供給 | 平台已有（supply_permits，來自公會開放資料） |
| 新建餘屋 | 去化壓力 | 平台已有（unsold_new_houses） |
| 低度使用住宅、屋齡結構 | 空屋率、老屋換屋需求 | 內政部不動產資訊平台「住宅資訊統計」 |

### 2.5 區位吸引力
捷運藍線、鐵路地下化、重劃區進度（台南市都發局、捷運工程處、地政局）；學區學生數（教育部統計處、台南市教育局）；生活機能（政府資料開放平台、OSM）。

### 2.6 需求意向（非官方）
Google Trends 關鍵字熱度、591 刊登與瀏覽、代銷來客資料（客戶居住地與年齡最準）。

---

## 3. 評估與決定

### 3.1 評估結果
| 資料 | 粒度 | 更新 | 取得 | 價值 | 評分 |
|---|---|---|---|---|---|
| 村里戶數、單一年齡人口 | 村里 | 每月 | API | 核心 | ⭐⭐⭐⭐⭐ |
| 村里出生、結婚、離婚 | 村里 | 每月 | API | 核心 | ⭐⭐⭐⭐⭐ |
| 遷入遷出 | 村里 | 每月 | API | 核心 | ⭐⭐⭐⭐⭐ |
| 綜所稅村里所得 | 村里 | 每年，落後 2–3 年 | CSV | 核心 | ⭐⭐⭐⭐ |
| 實價登錄（含租賃） | 門牌 | 每月 3 次 | CSV | 核心 | ⭐⭐⭐⭐⭐ |
| 南科從業員工 | 園區 | 每月 | CSV | 高 | ⭐⭐⭐⭐ |
| 台南市住宅價格指數 | 14 個區／類型 | 每月 | 地政局 | 中（平台已有） | ⭐⭐⭐ |
| 建照、使照 | 縣市 | 每月 | API | 中（平台已有） | ⭐⭐⭐ |
| 電信信令人口 | 村里 | — | 付費 | 高但貴 | ⭐⭐ |
| 外縣市買方比例 | — | — | 無公開資料 | — | ❌ |

### 3.2 已做的決定
- **分兩期**。第一期只接「村里級、免費、可自動化」的來源（已完成）。
- **所得只做相對排名**，不當絕對購買力：課稅資料不含政府移轉、免稅、分離課稅所得，且落後 2–3 年。
- **遷徙資料改用戶政 API ODRP011**，不用 SEGIS：一樣到村里級、多了來源縣市，且與人口資料共用同一組村里代碼。
- **暫緩／放棄**：電信信令人口（付費，自然人每單元 2,000 元、法人 9,500 元）、外縣市買方比例（無公開資料，只能靠代銷客戶資料）、591 爬蟲（使用條款風險）。

---

## 4. 第一期實作（已完成）

### 4.1 檔案
| 檔案 | 內容 |
|---|---|
| `supabase/migrations/20261002_potential_buyers.sql` | 6 張表 + 索引 + RLS（**已在正式 Supabase 執行**） |
| `scripts/fetch_ris_village.py` | 戶政 ODRP014／060／011 → 人口、戶籍動態、遷徙 |
| `scripts/fetch_fia_income.py` | 財政部村里所得，含異體字對照 |
| `scripts/fetch_rentals.py` | 實價登錄租賃 d_lvr_land_c.csv |
| `scripts/gov_http.py` | 政府網站憑證相容處理（見 5.1） |
| `.github/workflows/potential-buyers.yml` | 每月 5 日 10:00 自動更新（合併進 main 後才生效） |

三支腳本都支援 `--dry-run`（不寫 DB，只預覽）、`--backfill`、指定期間（`--months`／`--years`／`--seasons`）。

### 4.2 資料來源細節
- **戶政 API**：`https://www.ris.gov.tw/rs-opendata/api/v1/datastore/{代碼}/{民國年月}?COUNTY=臺南市&PAGE=1`，文件 https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1
  - `ODRP014` 村里戶數、單一年齡人口（舊版 ODRP005 已停更，不要用）
  - `ODRP060` 村里出生、死亡、結婚、離婚（含同婚）
  - `ODRP011` 遷入遷出（含來源縣市）
  - 其他可能有用：`ODRP019` 戶數按戶別（年）、`ODRP020` 村里教育程度（年）、`ODRP025` 戶數結構表（年）
  - 查無資料時回 `responseCode: OD-0102-S`
- **財政部所得**：`https://www.fia.gov.tw/WEB/fia/ias/ias{年度}/{年度}_165-9.csv`（data.gov.tw 資料集 103066），目前最新 112 年度
- **租賃**：`https://plvr.land.moi.gov.tw/DownloadSeason?season={115S2}&fileName=d_lvr_land_c.csv`

### 4.3 資料表
| 資料表 | 主鍵 | 重點欄位 |
|---|---|---|
| `villages` | village_code | district、village、name_aliases、first_seen_ym、last_seen_ym |
| `village_population_monthly` | (ym, village_code) | households、pop_total、age_0_14／15_24／25_34／35_44／45_64／65_plus、ages_m／ages_f（單一年齡陣列 0–100） |
| `village_vital_monthly` | (ym, village_code) | births、deaths、marriages、divorces |
| `village_migration_monthly` | (ym, village_code) | in／out_total、in／out_other_city（跨縣市）、in／out_other_town（市內他區）、in／out_same_town、in／out_foreign、in／out_by_city（jsonb）、raw（jsonb） |
| `village_income_yearly` | (tax_year, district, village) | village_code（可為 NULL）、tax_units、income_mean／median／q1／q3（千元） |
| `rentals` | id；UNIQUE serial_number | district、rental_date、building_type、main_use、monthly_rent、unit_rent_sqm、rental_type |

- **村里代碼**：`village_code` = 戶政 `district_code`（11 碼，如 67000010001），所有村里級資料用它對齊。
- `ym` 為民國年月字串（'11508'），`ym_date` 為西元月初，排序與時間運算用 `ym_date`。
- 遷徙欄位已驗證恆等式（650 里全成立）：遷入合計 = 各縣市 + 市內他區 + 國外 + 初設戶籍 + 其他。同區跨里遷移（in_same_town）不計入合計，語意待官方確認。

### 4.4 匯入結果（正式資料庫，2026-10-02；2026-10-04 回補至近 10 年）
| 資料表 | 筆數 | 範圍 |
|---|---|---|
| villages | 804 | 含已裁併／改名的舊里代碼（107 年整併前的 724 里代碼） |
| village_population_monthly | 75,765 | 106 年 1 月～115 年 8 月（106 年以 107/01 里名對照代碼，缺 28 個整併前已消失的里） |
| village_migration_monthly | 75,765 | 同上 |
| village_vital_monthly | 75,117 | 同上（107/01–109/08 用 ODRP010），缺 11103、11308（官方 API 本身查無資料） |
| village_income_yearly | 5,295 | 105～112 年度（105 年度 33 個整併前舊里 village_code 為 NULL） |
| rentals | 58,630 | 105S1～115S3（105–109 年每季僅 200–700 筆，當時登錄量少） |

驗證：11508 全市 1,846,409 人、782,685 戶；年齡級距加總 = 總人口（0 筆不符）。所得中位數最高的里為善化區蓮潭里（南科旁），符合預期。

### 4.5 權限
6 張新表都啟用 RLS 且未設公開 policy：前端 anon key 讀不到（已實測為 0 筆）。後端 API（`supabaseAdmin`，service role）與匯入腳本不受影響。**前端若要直接讀這些表，必須走 API route，不要加公開 policy。**

---

## 5. 踩過的坑（接手前必讀）

1. **Python 3.13 拒絕政府網站憑證**：fia.gov.tw、plvr.land.moi.gov.tw 憑證鏈缺 Subject Key Identifier，3.13 預設的 `VERIFY_X509_STRICT` 會報 `Missing Subject Key Identifier`。新腳本用 `scripts/gov_http.py` 的 `gov_session()` 處理（仍完整驗證，只關 strict 旗標）。**既有的 `fetch_history.py`、`fetch_latest.py` 在 3.13 上也會遇到**，GitHub Actions 用 3.11 所以沒事。
2. **村里名異體字**：財政部寫 `𥂁埕里`、`𥂁田里`，戶政寫 `塩埕里`、`塩田里`；`檨林里` 兩邊 Unicode 碼位不同，用 NFKC 正規化解決。
3. **分割與改名的里**：官田區「東西庄里」已分割為東庄里、西庄里（舊代碼仍在 villages 中）；新化區山腳里在 108–109 年度所得對不到代碼，疑似改名，待人工確認。
4. **所得 CSV 欄名不一**：108–109 年度第一欄叫「鄉鎮市區」，110 年度起叫「縣市別」，且欄名內含 BOM。
5. **租賃唯一鍵**：用 `serial_number` 單獨當唯一鍵，避免同一案出現在不同發布季時重複計算。
6. **使用者 Mac 上的遠端 shell**：背景程式會在每次指令結束時被中止，長時間回補要分段在前景執行。

---

## 6. 如何執行

📁 執行路徑：`~/AI/RealEstatePrice`（執行前請先確認）

```bash
# 預覽（不寫 DB）
python3 scripts/fetch_ris_village.py --months 11508 --dry-run
python3 scripts/fetch_fia_income.py --years 112 --dry-run
python3 scripts/fetch_rentals.py --seasons 115S2 --dry-run

# 增量更新（排程用的預設行為）
python3 scripts/fetch_ris_village.py     # 最近 4 個月
python3 scripts/fetch_fia_income.py      # 最新兩個年度
python3 scripts/fetch_rentals.py         # 最近 2 季
```

順序固定：先戶政（建立村里主檔），再所得（需要主檔對齊代碼）。自動更新在分支合併進 main 後生效。

---

## 7. 下一步（待辦）

### 7.1 村里潛在客群指數（✅ 已完成 2026-10-03，已在正式 Supabase 建立）
SQL：`supabase/migrations/20261003_village_buyer_indicators.sql`（materialized view `village_buyer_indicators` + `refresh_village_buyer_indicators()`）

**決定**：分「首購」「換屋」兩種指數；時間窗 12 個月；各指標轉全市百分位（0–100）後加權相加。

| 指標 | 首購 | 換屋 |
|---|---|---|
| 世代淨移入（今年 26–35 − 去年 25–34；換屋用 36–45 − 35–44） | 30 | 20 |
| 年齡層占比（25–34／35–44） | 20 | 20 |
| 結婚率／出生率（每千人・年，EB 收縮） | 20 | 20 |
| 所得中位數百分位（最新年度） | 20 | 30 |
| 社會增加率（含同區跨里） | 10 | 10 |

**試算後的修正（與草案不同處）**：
- 「25–34 占比的 12 個月變化」主要是年齡推移（與 35–44 占比相關 −0.32），改用世代淨移入（單一年齡陣列同一批人比較）。
- 村里社會增加必須加回同區跨里遷移（`in_total` 不含）：例如北區元美里跨區淨移入 −4‰，但同區跨里淨移入 +175‰。
- 分戶速度、戶量訊號弱（分戶速度全市中位數 +1.4%，與淨移入相關 −0.21），只供顯示、不計分。
- 結婚／出生率的村里差異多半是雜訊：以動差法估計，收縮強度 M ≈ 7,000 人年，往行政區平均收縮。
- 租金／房貸比：transactions、rentals 都只有行政區欄位 → 不進村里指數，改當行政區背景資訊（尚未實作）。
- 小里（人口 < 1000，111 里）不排除，以 `low_confidence` 標記；12 個月內新設的里（東庄里、西庄里）世代指標以 50 代入，所得沿用母里東西庄里。
- materialized view 不受 RLS 保護 → SQL 內 `REVOKE ... FROM anon, authenticated`。

**試算結果（11508、所得 112 年度）**：首購與換屋指數排名相關 0.77；首購前段為永康光復、歸仁沙崙、安平國平、東區東智、善化嘉北；換屋前段為安南國安、東和、海南、永康東橋、善化蓮潭。行政區平均前段為安定、新市、永康、善化（南科走廊）。

**更新機制**：`fetch_ris_village.py`、`fetch_fia_income.py` 寫入資料後自動呼叫 `refresh_village_buyer_indicators()`（約 1 秒）。已驗證 650 筆、anon key 讀取回 permission denied。

### 7.2 前端「潛在客群」頁（✅ 已完成 2026-10-03，`/potential-buyers`）
- 村里界線：內政部國土測繪中心 村(里)界 1150817 版 → `scripts/build_village_geojson.sh`（npx mapshaper，簡化 10 公尺）→ `public/geo/tainan_villages.json`（1.26 MB、gzip 約 300 KB）；VILLCODE 與 village_code 650 里全數對上
- API：`/api/potential-buyers`（service role 讀 materialized view，1 小時快取）；戶政造字 U+FB56F 於 API 換成「塭」
- 元件：`PotentialBuyersPanel`（首購／換屋切換、行政區篩選、前 10 名、村里明細、前 30 名排行、方法說明）、`VillageChoroplethMap`（Leaflet GeoJSON 分級著色）
- 色階：brass 單一色相五分位，CSS 變數 `--pb-ramp-0..4`；暗色主題翻轉為高分＝亮色；人口 < 1000 淡色虛線
- 底圖沿用 OSM（CARTO 已需 API key），暗色主題以 CSS 濾鏡壓暗
- ⚠️ Vercel Preview 環境缺 Supabase 環境變數（只設 Production），非 main 分支的 Preview build 會失敗；需在 Vercel 設定勾選 Preview

### 7.3 第二期資料

#### 已完成（2026-10-03）
- **租金／房貸月付比**（行政區）：`fetchDistrictRentVsPrice()` 直接以 execute_query 計算，不需新表
  - 租金：rentals 整棟(戶)出租、住家用、不含車位、**排除社會住宅包租代管**（占整戶出租 68%，租金約低於市價 10–20%）；一般市場樣本少 → 24 個月
  - 房價：transactions 成屋、排除特殊關係交易，12 個月；皆以「最新月的前一月」為終點
  - 以每坪比較（抵銷坪數差），分「大樓華廈」「透天」；樣本 < 20 不計算（大樓 13 區、透天 10 區有值）
  - 利率、成數、年限由前端輸入（預設 2.2%、8 成、30 年 ⚠️ 預設利率需依市場調整）
- **南科從業員工**：`science_park_employees_monthly` + `scripts/fetch_science_park.py`
  - 園區級歷史：國科會統計資料庫 ScienceParkReport（ASP.NET 表單 POST），105/11 起 118 個月 × 3 園區
  - 子園區（臺南園區、高雄園區…）：data.gov.tw 7599 CSV 只有最新一期、無日期 → 南科合計 = 統計資料庫最新月才寫入，逐月累積
  - 前端：南科總數趨勢、年增、碩博占比、子園區分布

- **育齡婦女數**（村里）：view v2 新增 `women_15_49`、`women_15_49_share`（ages_f 15–49 歲），僅顯示
- **離婚數**：view v2 新增 `divorces`（近 12 月）、`divorce_k_district`；**村里間離婚率差異經檢定全為隨機雜訊**（村里間變異 ≤ Poisson 雜訊），故不提供村里離婚率
- **屋齡結構**（行政區）：初版用成交物件推算，**已改用房屋稅籍住宅存量**（見下方 housing_market_stats）
- **住宅市場統計** `housing_market_stats`（長格式：indicator × area_level × area × period）+ `scripts/fetch_housing_stats.py`
  - 內政部不動產資訊平台 pip.moi.gov.tw（多為 JS 表單，需 `__RequestVerificationToken`；回應標頭寫 big5 但實際多為 UTF-8 BOM）
    - `E2010Data?dataGroup=group03/04/06`（JSON）：房價所得比、貸款負擔率（縣市・季，91Q1 起）、五大銀行房貸利率（全國・月，f01/f02 為民國 yyymm）
    - `E3030` POST `T/K/N`：5-3-2／3／4 新增購置住宅貸款 利率／成數／期數（縣市・季）；同頁還有住宅存量、建物買賣移轉棟數、建築貸款等 100+ 項
    - `E1040` POST `F01=DataGroup3&F02=114H2&F03=67000`：低度使用（用電）住宅（行政區・半年，109H1 起）
    - `E4041?m=csv&k=K02&n=T13`：房屋稅籍住宅類數量依屋齡區分（行政區・季，98Q1 起，含平均屋齡）；E4040 另有 30 項主題資料（含村里級戶長年齡、宅內人口數）
  - 臺南市政府資料開放平台：`{年}年臺南市建物第一次移轉統計表`、`{年}年臺南市不動產買賣統計表`（行政區・月，104 年 6 月起），以標題搜尋資料集 → 每月一個 CSV 資源（`/File/DirectDownload/{id}`）；沒有全市合計列
  - 結果（115Q1 臺南）：房價所得比 8.76 倍、貸款負擔率 38.3%、新增房貸利率 2.71%、成數 62%、期數 334 月；低度使用 114H2 10.92%
  - 租金／房貸比的預設利率改為臺南市最新新增房貸平均利率

- **資料期間原則（使用者 2026-10-04 指定）**：潛在客群相關資料一律回補到**民國 105 年起**（固定起點）；更早的已匯入資料保留、照常匯入
  - 做不到 105 的：戶政 API 最早 106/01（村里月資料、年資料皆是）；南科統計資料庫最早 105/11
  - 106 年戶政舊版資料集（ODRP005／001／002、106 年 ODRP025）沒有 district_code → 以 107/01 ODRP014 的「行政區＋里名」對照；平台村里季資料以 villages 的 first_seen～last_seen 依期別挑代碼
  - 財政部 105 年度「廍」為造字 U+FFFB4、「赤崁里」＝戶政「赤嵌里」，已加對照
- **村里戶政年資料、戶長年齡**（分支 feat/potential-buyers-village-annual）：`village_annual_stats`（ODRP020 教育程度、ODRP025 戶數結構，106 年起）、`village_household_quarterly`（平台 T06 戶長年齡、T02 宅內人口數、T04 宅內戶數，105Q1 起）+ `scripts/fetch_village_household.py`；view v3 新增顯示欄位（一宅多戶、26–45 歲戶長占比等），權重待討論

- **南科產業別員工**（分支 feat/potential-buyers-sp-industry-projection）：`science_park_industry_yearly`，data.gov.tw 101986（`serialno=398&fileodr=2`），由 `fetch_science_park.py` 一併匯入；**開放資料只有 107～113 年**，105～106 年僅見於南科年報 PDF（南科管理局網站 2026-10 連不上）
- **臺南市人口推估**：`population_projection` + `scripts/fetch_population_projection.py`；臺南市政府 data.gov.tw 134546（行政區 × 單一年齡 × 高中低推估），從 data.gov.tw API 自動挑最新版次（目前 2025-2070、2024-2070），匯入時彙整成年齡級距並加總全市；⚠️ 官方只計出生、死亡、未計遷徙
  - 2025 版中推估：全市 2025 年 185.2 萬 → 2070 年 107.6 萬

#### 待辦（使用者要求清單全做，依建議順序）
| # | 資料 | 粒度 | 來源 | 備註 |
|---|---|---|---|---|
| 10 | 家庭收支調查（可支配所得） | 縣市／年 | 主計總處 | |
| 11 | 行政區級建照、開工量 | 行政區 | 台南市工務局（需確認是否公開） | |
| 13 | 學區學生數 | 學校 | 教育部統計處、台南市教育局 | |
| 14 | 捷運藍線、鐵路地下化、重劃區進度 | 點／面 | 都發局、捷運工程處、地政局 | 多為文件，需人工整理 |
| 15 | 生活機能（醫院、商場、公園） | 點 | 政府資料開放平台、OSM | |
| 16 | 沙崙、永康、樹谷等園區就業 | 園區 | 各園區、經濟部 | 公開程度不一 |
| 17 | 工業及服務業普查 | 行政區／5 年 | 主計總處 | |
| 18 | 通勤旅次 | 行政區 | 交通部運研所、SEGIS | |
| 19 | Google Trends 關鍵字熱度 | 縣市 | Google Trends | 無官方 API |
| — | 591 刊登與瀏覽 | — | — | ❌ 使用條款風險，不做 |
| — | 代銷來客資料 | — | — | ❌ 無公開來源 |

### 7.4 其他
- 把 `scripts/gov_http.py` 套用到既有的實價登錄爬蟲，避免本機 Python 3.13 失敗
- 確認新化區山腳里新名稱，補進 `fetch_fia_income.py` 的 ALIASES
