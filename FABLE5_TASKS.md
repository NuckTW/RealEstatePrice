# Fable 5 開發任務清單（RealEstatePrice）

> 使用方式：在 Claude Code session 中輸入
> 「請讀取 docs/FABLE5_TASKS.md，執行任務 N」
> 每個任務開新 session（或 /clear），完成、驗收、commit 後再進下一個。
> 模型：/model claude-fable-5
> 全域規則：地圖熱力圖模式維持「僅預售屋」，任何任務都不得擴展到成屋。

## 執行順序

1. ✅ 前置：將 `tainan_housing_price_index_10108-11503.csv` 放入 `data/housing_price_index.csv`
2. ✅ 任務 2：大型重構（先做，地基穩了再蓋功能）
3. ⬜ 任務 4：AI 問答改用 Claude Haiku 4.5
4. ⬜ 任務 5：數據分析頁自訂分組軸
5. ⬜ 任務 3-1：行政區房價趨勢預測
6. ⬜ 任務 3-2：建案比較頁
7. ✅ 任務 6：住宅價格指數趨勢圖
8. ✅ 任務 7：整合台南市不動產公會開放資料

---

## 任務 2｜大型重構

請先閱讀 CLAUDE.md 與整個 src/ 目錄，理解現有架構後，執行以下重構：

1. 盤點所有 Next.js API Routes，將過長、職責混雜的 route 拆分：
   - 抽出共用的 Supabase 查詢邏輯到 src/lib/queries/ 下，依領域分檔（kpi、map、analytics、projects）
   - 抽出共用的篩選條件解析（日期區間、行政區、建物型態、房型、成屋/預售屋、屋齡）成單一 util，所有 API 共用
2. 優化 Supabase 查詢效能：
   - 檢查每個查詢是否有對應索引，產出一份 supabase/migrations 的索引建議 SQL（不要直接執行，列出讓我確認）
   - 把前端做的聚合運算盡量下推到 PostgreSQL（用 RPC 或 view）
   - 找出 N+1 查詢與重複查詢，加上適當的快取（Next.js revalidate 或 unstable_cache）
3. 重構過程不可改變任何現有功能行為與 API 回傳格式，每完成一個模組就跑 npm run build 確認可編譯
4. 完成後輸出重構報告：改了哪些檔案、效能優化點、建議我手動在 Supabase 執行的 SQL 清單

注意：地圖熱力圖模式維持「僅預售屋」，不要擴展到成屋。

---

## 任務 4｜AI 問答改用 Claude Haiku 4.5

將 AI 問答功能的 LLM 從 Google Gemini 2.5 Flash 換成 Anthropic Claude Haiku 4.5：

1. 安裝 @anthropic-ai/sdk，模型字串使用 claude-haiku-4-5-20251001
2. 新增環境變數 ANTHROPIC_API_KEY（更新 .env.example，並提醒我去 Vercel 補上）
3. 改寫 text-to-SQL 的呼叫層：
   - 保留現有的 schema 描述與安全限制（只允許 SELECT、禁止 DDL/DML）
   - 把 system prompt 重新打磨：完整描述資料表 schema、欄位意義（民國年月格式、預售屋/成屋判斷邏輯）、加入 5 個以上 few-shot 範例（中文問題 → 正確 SQL）
   - 圖表類型自動偵測的判斷也一併改用 Haiku
4. 設計成 provider 可切換的架構（lib/ai/provider.ts），保留 Gemini 作為 fallback，用環境變數 AI_PROVIDER 切換
5. 用至少 10 個典型中文問題實測（例：「永康區近一年大樓平均單價走勢」「東區三房成交量最多的建案」），列出每題生成的 SQL 與結果給我驗收

---

## 任務 5｜數據分析頁：自訂分組軸

數據分析頁目前 X 軸只能以時間（月/季/年）分組，請新增「自訂分組維度」功能：

1. 在現有「月/季/年」之外，新增分組維度選項：行政區、建物型態、房型、屋齡區間（0-5、5-10、10-20、20-30、30年以上）、總價區間、面積（坪數）區間、單價區間
2. 區間型維度（總價/面積/單價）允許使用者自訂級距，提供合理預設值
3. Y 軸指標沿用現有的單價、總價、面積、車位價格、交易量、成交額，統計模式（平均/最大/最小）與現有篩選器都要能和新分組維度組合使用
4. 圖表型態：分類型維度預設長條圖，並保留切換折線/散佈
5. tooltip 維持可查看來源交易明細
6. 後端聚合在 PostgreSQL 完成，不要把全量資料拉到前端分組
7. 完成後示範三個組合給我看：行政區×平均單價、屋齡區間×交易量、總價區間×成交戶數

---

## 任務 3-1｜行政區房價趨勢預測

新增「行政區房價趨勢預測」功能：

1. 以實價登錄月度聚合資料（各行政區平均單價）為基礎，實作時間序列預測（可用簡單但穩健的方法如 Holt-Winters 或線性回歸＋季節性，在 TypeScript 端或 PostgreSQL 實作，不要引入重量級 ML 依賴）
2. 預測未來 6 個月，圖上以虛線＋信賴區間呈現，歷史實線、預測虛線
3. 頁面上明確標示「預測僅供參考，不構成投資建議」
4. 可多選行政區並列比較預測走勢

---

## 任務 3-2｜建案比較頁

新增「建案比較頁」：

1. 可搜尋並加入最多 4 個建案（預售屋建案名稱／成屋地址）並列比較
2. 比較欄位：成交戶數、均單價、均總價、均坪數、單價走勢小圖（sparkline）、房型分布、車位均價、最新成交日期、銷售比（若為預售屋）
3. 從現有建案排行頁可以直接點「加入比較」
4. 比較狀態存在 URL query string，方便分享連結

---

## 任務 6｜住宅價格指數趨勢圖

repo 的 data/housing_price_index.csv 是台南市政府「住宅價格指數」官方資料（民國101年8月～115年3月，月資料；欄位：年月（民國YYYMM）、全市、大廈、透天厝，以及14個行政區/區域）。請新增「住宅價格指數」頁面：

1. 寫一個 script 把 CSV 匯入 Supabase 新資料表 housing_price_index（先給我 migration SQL 確認）
2. 趨勢圖功能：
   - 可多選比較：全市/大廈/透天厝/各行政區，預設顯示全市
   - 可切換顯示「指數值」或「年增率 YoY%」
   - 基期說明標注：110年1月=100
   - 民國年月在軸上顯示為「110/01」格式
3. 加一個重點摘要卡片：最新指數、月增率、年增率、距歷史高點（114年9月前後）的回落幅度
4. 資料來源標注：臺南市實價登錄大數據輔助區段地價平衡之研究（第六期）
5. 在主導覽加入此頁入口

---

## 任務 7｜整合台南市不動產公會開放資料

請分析並整合 https://tnh.org.tw/open_gov.asp 的開放資料到本專案：

1. 先用 curl 抓取首頁與以下四個 JSON 端點，分析每個資料集的 schema、更新頻率與命名規則（注意 URL 中的期別格式：建照/使照為民國年月如 11504、交易為西元日期、餘屋為民國年+季如 114Q2）：
   - https://tnh.org.tw/open_gov_detail.asp?c=building_permit&f=open_gov%2Fbuilding_permit-11504.json （建造執照）
   - https://tnh.org.tw/open_gov_detail.asp?c=transactions&f=open_gov%2Ftransactions-20260601.json （交易資料）
   - https://tnh.org.tw/open_gov_detail.asp?c=usage_permit&f=open_gov%2Fusage_permit-11504.json （使用執照）
   - https://tnh.org.tw/open_gov_detail.asp?c=unsold_new_house&f=open_gov%2Funsold_new_house-114Q2.json （新建餘屋）

   先輸出 schema 分析報告與你建議的資料表設計給我確認，確認後才繼續。
2. 確認後：建 Supabase 資料表＋寫 Python 抓取腳本（放 scripts/，比照現有實價登錄抓取器的風格），並嘗試回補可取得的歷史期別
3. 加入 GitHub Actions 排程（比照現有 workflow，每月自動抓最新一期，依各資料集的期別規則推算 URL，抓不到時優雅跳過）
4. 新增「市場供給面」儀表板頁：建照/使照核發量趨勢（供給領先指標）、新建餘屋量按行政區、並可與實價登錄成交量疊圖對照（供需對照）
5. 資料來源標注台南市不動產開發公會開放資料
