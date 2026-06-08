# 台南不動產實價登錄儀表板

台南市不動產交易資料視覺化平台，資料來源為內政部不動產交易實價查詢服務網。

🔗 **線上網址：https://tainan-realestate-ai.vercel.app**

---

## 功能

### 數據看板
- KPI 總覽：成交戶數、均單價、均坪數、均總價、總銷售額
- 行政區排行榜、建物型態統計、房型統計
- 建案排行（預售屋建案／成屋地址 Top 500，含銷售比）

### 互動地圖
- **標記模式**：以群集標記顯示預售屋與成屋分布，點擊可查看建案資訊與交易明細
- **熱力圖模式（預售屋）**：依各建案「自身單價」呈現藍→黃→紅漸層色塊，色塊大小可呈現價格分布的連續趨勢；中心顯示單價數值，點擊可查看該建案的交易明細；左下角圖例顯示目前單價範圍與配色說明

### 數據分析
- 多行政區（最多 37 區）並列比較單價、總價、面積、車位價格、交易量、成交額等指標走勢
- 折線／長條／散佈圖，可切換月／季／年呈現
- 細部篩選：建物型態、房型、成屋／預售屋
- 統計模式：平均／最大／最小，並可在 tooltip 中查看來源交易明細（建案／地址／日期）

### AI 問答
- 輸入自然語言問題，自動產生 PostgreSQL 查詢並回答（採用 Google Gemini 2.5 Flash）
- 自動偵測適合的圖表類型並視覺化查詢結果

### 篩選器
- 日期區間（民國年月）、行政區（多選）、建物類型、房型、成屋／預售屋、屋齡

### 資料自動更新
- GitHub Actions 每月 1 日、11 日、21 日自動抓取內政部最新實價登錄資料

---

## 技術架構

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

內政部不動產交易實價查詢服務網｜資料僅供參考，不構成投資建議
