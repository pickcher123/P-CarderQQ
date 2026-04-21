# 版本更新史 (Version History)

## [公測版 ver1.0] - 2026-04-20

### 新增功能
- **直播回顧功能：** 團拆結束後，後台支援更新 YouTube 直播連結，玩家可在前台回顧當天拆卡過程。

### 優化與修正
- **Firestore 系統優化：**
  - 重構後台管理頁面，移除不必要的銷售統計邏輯 (fetchSalesStats)，有效解決 Firestore 存取權限錯誤，提升網頁加載速度。
  - 清理 `drawnCardLogs` 相關無效數據呼叫。
- **UI/UX 改進：**
  - 修復卡片背部資產在特定頁面無法正常顯示的問題，確保收藏庫與卡池一致性。
  - 修正 Dialog 組件 accessibility 警告 (新增 DialogTitle)，提升操作體驗。
- **安全性強化：**
  - 完善 Firestore 安全規則 (ABAC 模型)，增加身分驗證與資料完整性檢查。
