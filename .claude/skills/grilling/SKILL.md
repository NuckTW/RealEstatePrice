---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea until every branch of the design tree is resolved. Use when the user wants to stress-test their thinking, or says "grill me" / "拷問我" / "逼問我" / "先問清楚再做".
---

在寫任何 code 之前，先把使用者（Nuck）的計畫拷問到沒有模糊地帶為止。

把整件事畫成一棵 **design tree**：每個決策底下掛著依賴它的決策。

## 進行方式：分回合（rounds）

**Frontier** = 所有前置條件已經確定、現在就能問的問題。每一回合把整個 frontier 一次問完，編號並附上你自己推薦的答案，然後**停下來等回答**。

問題格式：

```
❓ **Q1** - **<問題標題>**：<問題內容，可以多段，可以列選項>

➡️ <你推薦的答案 + 一句話理由>
```

使用者每回合的回答會重塑這棵樹：已確定的決策把 frontier 往外推，解鎖原本被擋住的問題。重新計算 frontier，進入下一回合。

**答案取決於本回合另一個未決問題的，屬於下一回合，不要放在這回合問。**

## 事實自己查，決策才問人

查得到的事實是你的工作，不是使用者的。frontier 上的問題若需要環境裡的事實（檔案系統、DB schema、既有實作、部署設定），**開 sub-agent 去查，不要問使用者**。

不要因此卡住：進行中的探索是一個未確定的前置條件，只有依賴它的問題要等；frontier 上其他問題現在就問。

**決策是使用者的**——一個一個攤開來問，然後等。

## 結束條件

Frontier 清空 = design tree 每個分支都走過、沒有任何東西是默默假設的。

**在使用者明確確認「我們已經有共識」之前，不准開始動工。**

---

## 在這個 repo（Tainan Realty Analytics / 實價登錄）裡

拷問前先讀，別拿這些問使用者：

- `AGENTS.md`（`CLAUDE.md` 只是它的 include）— 特別注意：這版 Next.js 有 breaking changes，寫 code 前要讀 `node_modules/next/dist/docs/`
- `docs/ARCHITECTURE.md` — 系統架構
- `docs/data-format.md` — 實價登錄資料欄位格式
- `supabase/` — DB schema 與 migration 現況
- `scripts/`、`data/` — 現有的資料處理管線

這個專案特別容易踩的模糊地帶，該問就問：

- 這是**資料層**（抓取 / 清洗 / 匯入）還是**呈現層**（Next.js 頁面 / 圖表）的改動？
- 牽不牽涉 **DB schema 變更或 migration**？（動 DB 前一定要先問過）
- 資料範圍：哪些行政區、哪個時間區間、建物型態（住宅／店面／土地）？
- 這個數字要怎麼**驗證正確**？對得上內政部原始資料的哪一份？
- 跟碩論那套 **NN + GIS 估價**（`~/AI/nn-appraisal`）是要共用、還是刻意分開？
