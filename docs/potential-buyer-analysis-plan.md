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

### 4.4 匯入結果（正式資料庫，2026-10-02）
| 資料表 | 筆數 | 範圍 |
|---|---|---|
| villages | 653 | 含已裁併／改名的舊里代碼 |
| village_population_monthly | 43,488 | 110 年 1 月～115 年 8 月 |
| village_migration_monthly | 43,488 | 同上 |
| village_vital_monthly | 42,840 | 同上，缺 11103、11308（官方 API 本身查無資料） |
| village_income_yearly | 3,245 | 108～112 年度 |
| rentals | 50,800 | 110S1～115S3 |

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

### 7.1 定義「村里潛在客群指數」（先與使用者討論，確認後再建 view）
指標草案：
- 25–34 歲（首購）、35–44 歲（換屋）人口占比，及近 12 個月變化
- 戶量（人口／戶數）與分戶速度（戶數成長率 − 人口成長率）
- 近 12 個月結婚對數、出生數（每千人）
- 近 12 個月社會增加率，拆成跨縣市淨移入、市內他區淨移入
- 所得中位數在全市的百分位排名（標註資料年度）
- 租金／房貸月付比（依行政區由 rentals 與 transactions 估算）

待決問題：權重如何配？是否分「首購型」「換屋型」兩種指數？村里人口太少（如山區）是否排除或合併？

產出：`village_buyer_indicators` view（或 materialized view）。

### 7.2 前端「潛在客群」頁
- 村里地圖需要村里界線圖資：內政部村里界圖（SHP）→ 轉 GeoJSON，以 village_code 對應
- 走 API route 讀資料（見 4.5）
- 沿用全站設計系統（`Tainan Realty Analytics — Design System`）

### 7.3 第二期資料
- 南科從業員工數：https://data.gov.tw/dataset/7599
- 行政區級建照（向台南市工務局確認是否有）
- 學區學生數、捷運藍線與重劃區進度
- 戶政年資料：ODRP020 村里教育程度、ODRP025 戶數結構表

### 7.4 其他
- 把 `scripts/gov_http.py` 套用到既有的實價登錄爬蟲，避免本機 Python 3.13 失敗
- 確認新化區山腳里新名稱，補進 `fetch_fia_income.py` 的 ALIASES
