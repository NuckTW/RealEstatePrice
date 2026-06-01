# 台南不動產實價登錄儀表板

台南市不動產交易資料視覺化平台，資料來源為內政部不動產交易實價查詢服務網。

🔗 **線上網址：https://tainan-realestate-ai.vercel.app**

---

## 功能

- **數據看板** — 行政區排行、類型統計、房型統計、個案統計，搭配進度條視覺化
- **篩選器** — 日期區間、行政區（多選）、建物類型、房型、成屋／預售屋、屋齡
- **AI 問答** — 輸入自然語言問題，自動產生 SQL 查詢並回答
- **資料自動更新** — GitHub Actions 每月 1 日、11 日、21 日自動抓取最新資料

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
