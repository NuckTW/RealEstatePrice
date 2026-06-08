# 交接說明 — 給桌機 Claude Code

> 台南市不動產分析 Design System（"Brass & Clay"）
> 這份檔案是要讓桌機版 Claude Code 把這套設計系統落地到正式 codebase 用的。

---

## 這包是什麼

這是一套**完整的設計系統 / UI Kit**，以 HTML + React（inline JSX）做為設計參考實作。
它不是要直接 ship 的 production code，而是「設計來源」：請在目標專案的既有環境
（React / Vue / SwiftUI…）中，用該專案既有的元件與樣式慣例**重建這些設計**；
若還沒有環境，就選最合適的框架實作。

完整的設計規格、語氣、色彩、字體、間距、元件清單都寫在 **`readme.md`**，
那份是這套系統的權威文件，請 Claude Code 先讀它。

## 怎麼在桌機 Claude Code 用（步驟）

1. 下載這個專案的 zip（聊天視窗會出現下載卡片），解壓縮。
2. 放進你本機的專案資料夾，例如 `./design-system/`。
3. 在該資料夾開 **桌機版 Claude Code**（`claude` 指令，或 IDE 外掛）。
4. 給它類似這樣的指示：

   > 「請讀 `design-system/readme.md` 和 `design-system/CLAUDE_CODE_HANDOFF.md`，
   > 把這套設計系統用 [你的框架，例如 Next.js + Tailwind] 在本專案實作。
   > 先從 design tokens（`tokens/*.css`）和 `core/` 元件開始。」

5. Claude Code 會照著 token 與元件規格逐一建出來。

## 從哪裡開始實作（建議順序）

| 順序 | 內容 | 檔案 |
|---|---|---|
| 1 | 設計 tokens（顏色、字體、間距、陰影、亮/暗主題） | `styles.css` → `@import` 的 `tokens/*.css` |
| 2 | 字體載入（Geist · Geist Mono · Noto Sans TC，目前走 Google Fonts CDN） | `tokens/fonts.css` |
| 3 | 核心元件 | `components/core/` — Button · Badge · Tag · ThemeToggle |
| 4 | 表單元件 | `components/forms/` — Select · TextInput · Checkbox |
| 5 | 資料元件（含招牌的 data-bar） | `components/data/` — Panel · KpiCard · StatBar · TabPills |
| 6 | 回饋元件 | `components/feedback/` — ChatBubble · TypingDots |
| 7 | 整合範例：完整產品頁面 | `ui_kits/dashboard/index.html` |

每個元件資料夾都有：
- `*.d.ts` — props 型別契約（實作時照這個簽名）
- `*.jsx` — 參考實作
- `*.prompt.md` — 該元件的設計意圖與細節

## 重點規格（細節以 `readme.md` 為準）

- **語言**：繁體中文為主；日期用民國曆（西元 − 1911）。
- **色彩**：暖調墨黑底 + 黃銅（brass）主色 + 陶土（clay）副色，**無綠色**品牌色；
  8 色分類 ramp 給圖表用。所有元件讀語意 token（`--surface-*` / `--text-*` /
  `--accent-*`），不直接用原始色階，這樣亮/暗主題才能整組切換。
- **字體**：Geist（拉丁）· Noto Sans TC（中文，宣告在前避免 fallback）·
  Geist Mono（所有數字、民國日期、SQL）。
- **招牌元件**：表格數字格的 **data bar**（右對齊 mono 數字疊在半透明數值條上，
  左緣 2px 亮 tick，寬度 = 值 / 欄最大值）。見 `StatBar`。
- **主題**：`ThemeToggle` 切換 `<html data-theme>` 並存 localStorage。
- **圖示**：用 Unicode 幾何字符，不用 emoji、不手繪 SVG；正式環境若要圖示庫建議 Lucide。

## 注意

- 字體目前走 Google Fonts CDN；要完全離線就把 `.woff2` 放進來、改 `tokens/fonts.css` 為 `@font-face`。
- 資料全為**代表性 mock data**，不是真實實價登錄資料。
- 原始產品與 codebase 來源：
  - 線上產品：https://tainan-realestate-ai.vercel.app
  - 原始碼：https://github.com/NuckTW/RealEstatePrice（Next.js 16 + Tailwind v4）
