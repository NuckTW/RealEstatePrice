import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // 非原始碼，lint 它們只會製造雜訊蓋掉 src 的真問題
    // （實測：全專案 2,751 筆問題中 .vercel 就佔 2,670 筆）
    ".vercel/**",        // Vercel 建置產物（壓縮過的 chunk）
    ".claude/**",        // Claude Code 的 worktree 與本機狀態
    "Tainan Realty Analytics — Design System/**",  // 獨立參考用 UI kit，未被 app 引用
  ]),
]);

export default eslintConfig;
