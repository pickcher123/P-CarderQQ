---
trigger: always_on
description: P+Carder 專案視覺設計規範（暗黑曜石 × 香檳金 Dark Obsidian & Champagne Gold），適用於所有新增、優化與美化 UI 元件、彈窗、卡片與頁面。
---

# P+Carder UI 設計規範：暗黑曜石 × 香檳金（Dark Obsidian & Champagne Gold）

在新增、修改、優化或美化本專案的任何前端介面（頁面、彈窗、卡片、表格、按鈕與導航元件）時，請統一遵循以下視覺與互動規範：

## 1. 核心色彩系統（Color Tokens）
- **主背景（Obsidian Base）**：使用 `#0a0f1c`（可搭配 `backdrop-blur-2xl` 與深層陰影 `shadow-[0_24px_64px_rgba(0,0,0,0.85)]`）。
- **次級玻璃表面（Glass Surfaces）**：
  - 卡片／區塊底色：`bg-white/[0.03]`（hover：`bg-white/[0.05]`）
  - 深槽／分頁切換器底色：`bg-black/40`
- **邊框（Borders）**：
  - 一般分隔與卡片邊框：`border-white/[0.08]` 或 `border-white/[0.1]`
  - 選中／重點強調邊框：`border-amber-300/35` 至 `border-amber-300/65`
  - 頂部光線邊條：彈窗或主要容器頂部可使用 `border-t-amber-300/65` 或 `bg-gradient-to-r from-transparent via-amber-300/70 to-transparent`
- **主強調色（Champagne Gold）**：
  - 文字、圖標與數值高亮：`#FDE68A`、`text-amber-200`、`text-amber-300`
  - 主 CTA 按鈕／高價值徽章漸層：`bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400`，文字統一使用深黑棕 `text-[#120d02]` 以維持高對比度。
- **克制的語意輔助色**：
  - 鑽石／冰藍：`text-cyan-300`（僅用於鑽石圖標與微光點綴，避免大面積青藍漸層按鈕或背景）
  - 安全／成功：`text-emerald-400`
  - 警戒／錯誤／限時加倍：`text-rose-400` 或 `from-amber-400 to-rose-500`
  - 中性文字：主標題 `text-white` / `text-slate-100`，副標題與輔助說明 `text-slate-400`

## 2. 禁止與避免事項（Anti-Patterns）
- **禁止大面積高飽和彩虹漸層**：不要將紫、藍、青、粉同時大面積套用在同一個彈窗或列表卡片上，保持主視覺為暗黑曜石與香檳金。
- **避免刺眼霓虹陰影**：發光效果應克制，僅在彈窗頂部或選中態使用低透明度光暈（如 `bg-amber-400/10 blur-2xl`）。

## 3. 版面、圓角與數值規範
- **圓角層級**：彈窗與大型容器使用 `rounded-2xl`；內部卡片、輸入框與主按鈕使用 `rounded-xl`；標籤膠囊使用 `rounded-full`。
- **標題視覺錨點**：彈窗或區塊標題可搭配左側香檳金垂直光條（`w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700`）或暗色玻璃圖示方塊（`bg-white/[0.04] border border-white/10`）。
- **數值對齊**：所有點數、金額、倒數與倍率數字務必加上 `tabular-nums`，確保對齊整齊且不跳動。
- **選中態回饋**：優先使用「香檳金細邊框 + 微幅底色提亮（`from-amber-400/[0.12]`）+ 角落勾選標記」，取代生硬的粗邊框放大。
