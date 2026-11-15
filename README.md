# 台南不動產實價登錄儀表板

台南市不動產交易資料視覺化平台，資料來源為內政部不動產交易實價查詢服務網。

🔗 **線上網址：https://tainan-realestate-ai.vercel.app**

---

## 功能

> 📖 **完整功能說明（每項功能 30 字內）：見 [docs/USER-GUIDE.md](docs/USER-GUIDE.md)**
>
> 🧭 **開發中：購屋潛在客群分析（資料來源、評估、實作與下一步）：見 [docs/potential-buyer-analysis-plan.md](docs/potential-buyer-analysis-plan.md)**

| 頁面 | 內容 |
|------|------|
| 行情地圖（首頁 `/`） | 左地圖、右情報欄的工作台：群集依中位單價上色、點群集／路段列出建案、點建案看交易明細、框選與落點（半徑 800m 起）統計 |
| 市場（`/market`） | 概況（KPI、量價走勢、分布統計、逐筆明細）、行政區趨勢比較、住宅價格指數、建照使照與餘屋供給 |
| 建案（`/projects`） | 可排序搜尋的建案表（完整銷售期中位數），比較籃最多 8 案，散佈圖與規格並排 |
| 客群（`/potential-buyers`） | 村里客群指數地圖（含自訂指數）、客源分析、區域輪廓、重大建設 |
| AI 問答（右上抽屜） | 自然語言轉 SQL 查詢並自動視覺化（限內部，需密碼）；`/chat` 為全頁版 |

全站共用篩選列（期間快捷、行政區／重劃區、成屋／預售、類型，更多篩選含房型、屋齡），切頁會保留條件，網址可直接分享。手機版有底部 tab bar、篩選 sheet 與地圖 bottom sheet。字級與明暗主題在右上齒輪。

舊網址（`/analysis`、`/price-index`、`/supply`、`/project-compare`、`/search`、`/area-analysis`）會自動導到新位置。

### 資料自動更新
- GitHub Actions 每月 1 日、11 日、21 日自動抓取內政部最新實價登錄資料
- GitHub Actions 每月 3 日自動抓取公會開放資料（建照、使照、新建餘屋）

---

## 技術架構

> 📐 **系統架構圖與資料更新流程圖**：見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

| 層級 | 技術 |
|------|------|
| 前端 | Next.js 16 App Router + Tailwind CSS |
| 後端 | Next.js API Routes (Server) |
| 資料庫 | Supabase PostgreSQL |
| AI 問答 | Google Gemini 3.5 Flash-Lite（免費層，429 時備援 2.5 Flash-Lite） |
| 部署 | Vercel |
| 資料抓取 | Python + GitHub Actions |

---

## 本地開發

```bash
# 安裝依賴
npm install

# 設定環境變數（複製後填入你的金鑰）
cp .env.local.example .env.local

# 啟動開發伺服器
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) 查看結果。

---

## 環境變數

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase 專案網址
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase 公開金鑰
SUPABASE_SERVICE_ROLE_KEY=      # Supabase 服務金鑰（伺服器端專用）
GEMINI_API_KEY=                 # Google Gemini API 金鑰
GEMINI_MODEL=                   # 選填，預設 gemini-3.5-flash-lite
CHAT_PASSWORD=                  # AI 問答密碼閘（未設定則功能回 503）
```

---

## 資料來源

內政部不動產交易實價查詢服務網・台南市不動產開發公會開放資料・臺南市實價登錄大數據輔助區段地價平衡之研究（第六期）｜資料僅供參考，不構成投資建議
