# 2026-09-16 聯絡簿按鈕用途與配色

- 保留既有聯絡簿與附件按鈕尺寸、字級、圓角，僅改用途文字與配色。
- 小考／一般考卷／鑑定／補考維持藍色；上傳作業與回家作業卷紫色；補充教材深灰藍；一般連結灰色；假期卷與開答案按鈕橘紅；一般完成回報綠色。
- 假期卷放入今日作業二，移除獨立 section-title 與綠色外框。只有假期卷而作業一／二皆空白時仍顯示今日作業二，不建立一般作業完成項目。
- 一般週完成按鈕改為「我已完成本次所有作業」；有已發布假期卷時為「我已完成本次一般作業」。只是假期卷草稿時維持一般週文案。
- 作業用途的下載卷加「📄 回家作業卷｜」；原上傳表單保留上傳圖示與名稱，不能把填格格等表單誤稱考卷。
- 顏色採 allowlist：blue / purple / slate / orange / gray。未知值回到原預設，不能注入 CSS/HTML。Dashboard 欄位為 `displayOptions.homework.hw1Color/hw2Color`、`links.noteColor/holidayColor`；空值就是預設。holidayColor 放在顯示選項而非評量身分，避免影響 canonical assignment、ExamID 或學生回報。

## 驗證

- eBook/Dashboard inline scripts 及兩支外部 JS 語法、git diff --check 通過。
- eBook daily_post_display_options_smoke、ebook_home_practice_and_makeup_fields、ebook_pending_tasks_app、holiday_input_retention 及 Dashboard daily_post_display_options_smoke 通過。
- 用完整原版頁面與本機合成班級／GAS、Functions 測試替身走過：老師選色→本機存檔→重開，四項顏色保留；答案不進公開資料；下次課程期限仍為 10/3 09:00。學生開答案→回報 86.5 分成功，pageerror 0。
- 320/390/820/1280px 無橫向溢位；一般週、假期限定、草稿、未知顏色、一般表單與空標題情境通過。
- 舊 `ebook_pending_tasks_integration_smoke.js` 在本輪修改前的 main 亦因測試 mock 未提供 getEntryReminderItems 而失敗；不屬於本輪回歸。實際 pending 模組測試通過，本輪未修改其判斷。
- 截圖是完整原版程式搭配合成資料，非正式學生資料；Chrome 檢查不等同實機 iOS/LINE 瀏覽器驗收。

## 資料及發布邊界

僅前端與既有單篇 displayOptions 增加少量字串。沒有新 listener、額外查詢、後端／Rules 部署、正式成績寫入或通知發送。上傳、期限、補考、棒卡與催繳邏輯沿用既有流程。

## 同日圖示修正

依使用者回饋，文件與一般連結按鈕改用現有 SVG 圖示集合的單色線條 document/link 圖示，顏色繼承文字 currentColor；考卷、補考、回家作業卷、假期題目與解答共用文件圖示，替換系統 emoji。保留原配色、字級、圓角、尺寸與行為。
