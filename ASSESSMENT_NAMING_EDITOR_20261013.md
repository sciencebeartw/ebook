# 2026-10-13 聯絡簿名稱預填與顯示

Dashboard 保存 displayOptions.links.labels；一般檔案以精確 source + href 查名稱，假期／作業答案只以 role 查名稱，未解鎖仍不公開答案網址。教師確認的 label 直接逸出呈現，不再經舊檔名精簡器剪裁；下載原檔名與網址保留。沒有 GAS、Functions 或 Rules 變更。

正式 renderer 合成資料測試涵蓋小考、解答、補考、回家練習卷、補充 DOCX、一般連結與假期題目。Chrome 390px / WebKit 320px 無橫向溢出，六種按鈕名稱一致，原 DOCX 檔名仍保留，私人答案網址為零。12 項 AssessmentLabels／假期作業回歸及 daily_post_display_options_smoke 通過。未寫正式學生紀錄或發送通知。

成績單呈現名稱由 Dashboard 的 templates/assessment_titles 單班小型設定處理；不改 eBook 原成績、ExamID 或作業識別。
