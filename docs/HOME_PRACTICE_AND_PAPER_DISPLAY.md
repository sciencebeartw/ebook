# 回家練習卷缺繳與考卷區塊顯示

日期：2026-09-14。部署標記：`ebook-home-practice-missing-and-makeup-fields-20260914`。

## 行為

- 回家練習卷是先前發下、於本週核對並登記的成績。未登記分數（例如請假或空白）顯示「缺繳」，學生分數回報表單與送出提示也使用缺繳用字；待完成清單的既有請假項目顯示「缺繳練習卷待回報」。普通小考／考試仍顯示缺考。
- 分數 0、已有分數、學生回報待核對及老師更正保留原本權威來源。`假`、既有 feedback type、ExamID、審核／回填與催繳條件皆不改寫。回家練習卷即使有未繳文字，也保留分數回報與同 ExamID 回報顯示；不轉成一般作業完成按鈕。
- 沒有補考欄位內容時，不建立「今日補考考卷」及下載提示。若仍有合法待回報補考結果，另以「補考結果回報」標題保留原表單；有附件時題目、答案連結及回報照常顯示。
- 小考欄位為空、null 或只含空白／換行時，不建立考卷標題及對答案說明。沒有考試資料時不產生成績卡；已有成績的顯示不依附件有無刪除。

## 驗證

- `node tools/ebook_home_practice_and_makeup_fields.test.js`：涵蓋缺繳／缺考／一般作業、0 分、同卷回報待核對、不同 ExamID 不套用、老師更正、缺少附件與保留待回報表單。
- 既有 `tools/*.js` Node 檢查（排除以下 Playwright CLI 檔）；隔離 worktree 執行時，依原專案結構提供旁邊 Dashboard／Functions／firebase-rules 的唯讀來源。
- Playwright CLI `run-code --filename tools/ebook_home_practice_ui_checks.js` 在 `?preview=dashboard-draft` 頁執行；Chrome／WebKit、1280／390px、有無附件 × 有無待回報共各 8 情境，加上全無考試情境。無水平溢出、回報按鈕至少 53px、無 pageerror。僅用記憶體假資料，不提交正式回報。
- 瀏覽器剛載入時需等待原頁初始化完成再注入假資料，避免登入初始化暫時隱藏預覽，造成按鈕高度 0 的測試假象。未宣稱 iPhone／LINE OS 實機驗收。

## 範圍

本次只修改 eBook 靜態前端，沒有新增 Firebase read/write/listener、Functions、Rules、GAS、Sheet、Storage 或 LINE 通知。下週停課設定、答案解鎖、截止時間與催繳順延仍在討論，未實作。
