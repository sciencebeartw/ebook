# 2026-10-13 聯絡簿名稱預填與顯示

Dashboard 保存 displayOptions.links.labels；一般檔案以精確 source + href 查名稱，假期／作業答案只以 role 查名稱，未解鎖仍不公開答案網址。教師確認的 label 直接逸出呈現，不再經舊檔名精簡器剪裁；下載原檔名與網址保留。沒有 GAS、Functions 或 Rules 變更。

正式 renderer 合成資料測試涵蓋小考、解答、補考、回家練習卷、補充 DOCX、一般連結與假期題目。Chrome 390px / WebKit 320px 無橫向溢出，六種按鈕名稱一致，原 DOCX 檔名仍保留，私人答案網址為零。12 項 AssessmentLabels／假期作業回歸及 daily_post_display_options_smoke 通過。未寫正式學生紀錄或發送通知。

成績單呈現名稱由 Dashboard 的 templates/assessment_titles 單班小型設定處理；不改 eBook 原成績、ExamID 或作業識別。

## 名稱功能再次檢查（2026-10-13）

- 改名連結保留原用途的 class／icon：課本作業上傳、課本作業、回家卷、一般／自訂／補充連結與附件，8 種情境以真實 renderer 比較改名前後一致。
- 英文 Romans 等單字不因結尾 ans 被當成答案卷；獨立 ANS 或中文章節後的 ANS 仍識別。共用 helper 與 Dashboard 一致，cache 20261013-editable-2。
- Chrome／WebKit 320px 名稱與長文字檢查通過，無橫向溢出，Office 原檔名保留、未解鎖私人答案 URL=0。12 項既有回歸、兩個 smoke 及 inline scripts 語法通過。
- 正式學生資料／成績無異動；沒有新 Firebase 查詢／listener、GAS、Functions 或 Rules 部署。
