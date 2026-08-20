# 台南不動產實價登錄儀表板

台南市不動產交易資料視覺化平台，資料來源為內政部不動產交易實價查詢服務網。

🔗 **線上網址：https://tainan-realestate-ai.vercel.app**

---

## 功能

> 📖 **完整功能說明（每項功能 30 字內）：見 [docs/USER-GUIDE.md](docs/USER-GUIDE.md)**

| 頁面 | 內容 |
|------|------|
| 數據看板 | KPI 總覽、實價登錄明細、個案排行、行政區／類型／房型統計 |
| ↳ 地圖 | 群集標記與預售屋單價熱力圖，點擊查看建案交易明細 |
| ↳ 框選分析 | 地圖框選建案（最多 8 案）比較單價、類型分布與月度走勢 |
| 數據分析 | 多行政區並列比較單價、總價、面積、車位、交易量、成交額走勢 |
| 住宅價格指數 | 全市／建物型態／行政區指數趨勢（基期 110 年 1 月 = 100） |
| 市場供給面 | 建照／使照核發量疊上成交量，及各區待售新成屋餘屋趨勢 |
| 建案比較 | 中位單價 × 中位坪數散佈定位產品，附總價等值線 |
| 建案搜尋 | 搜尋預售建案，查看位置與完整實價登錄明細 |
| AI 問答 | 自然語言轉 SQL 查詢並自動視覺化（尚未公開） |

全站共用篩選器（日期區間、行政區、建物類型、房型、成屋／預售屋、屋齡）、深色／亮色主題、三段字級切換，篩選條件會寫入網址可直接分享。

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
| AI 問答 | Google Gemini 2.5 Flash |
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
```

---

## 資料來源

內政部不動產交易實價查詢服務網・台南市不動產開發公會開放資料・臺南市實價登錄大數據輔助區段地價平衡之研究（第六期）｜資料僅供參考，不構成投資建議
