## 2026-09-15 換班假期卷登分與空白補充資訊修正

- 原班 Sheet 學生列已移除時，由 callable 在逐份作業／換班歷程核對後，使用目前登入班級、姓名與學生 key 產生目的地。忽略前端自選目的地；GAS 再讀目的班單一學生姓名節點，核對 Sheet 唯一姓名列。未驗證或同名歧義時保留回報、停止催繳，不猜學生。
- 原始 AssignmentID、聯絡簿日期、期限、receipt 與進度仍留原班。正式登分前保存目的地，重試／後台修復沿用；只在尚未寫入分數前接受新的已驗證目的地。既有老師更正不覆蓋，老師已清空的成績不自動補回。
- 目的班的來源卷欄位以 metadata 記錄適用換班生；只將此成績同步給適用學生。完整班級同步與單欄同步都排除不相關同學，公開成績不帶其他學生名單。保留平均與柱狀圖，且假期卷不使用舊小考的模糊日期比對。
- 補充資訊為 null、空字串、空白、換行、不換行空格、零寬字元或空 HTML 段落時不顯示標題；文字／連結／圖片照常。既有 CSS、一般作業按鈕與補考操作不變。
- 驗證：136 項跨系統回歸全數通過；8 段程式語法檢查通過。完整聯絡簿隔離頁於 1280px／390px、縮放 100% 各測10種內容，無橫向溢出、console 0 error，附件仍為 btn-link。截圖位於備課專區 output/holiday-fix-20260915。正式真學生／分數未用作寫入測試。
- 資料與費用界線：sciencebear-admin，沿用單份作業、單一學生進度及單班成績同步；換班補登新增一次目的班該學生 name 葉節點讀取。沒有新增全站 listener、整份名冊掃描、LINE 發送或 Rules 異動。
- 部署範圍：自然 GAS 原 deployment、runEbookStudentAction、eBook；Dashboard 本次不需改版。部署完成證據另於下方追加。
- 舊版已收回報若從未保存已驗證目的地，後台不會靠姓名跨班猜測；需由已驗證學生操作或查明來源後補上目的地。新版本回報會自動保存，修復無需教師審核。

### 部署完成讀回

- eBook `e3162ad` 已 push origin/main。GitHub Pages 與正式自訂網域避開快取讀回 HTML 與 holiday_practice_app.js 都與本機完全相同；既有 style 區塊和修改前完全相同。HTML SHA256：`d9442cadd97835aafac38fb995b8886c97ffd8117ec5bd35ad6b3c48c13c7dd2`。
- GAS `6d597cc` 已更新既有 deployment 至 `@452`；將第452版讀到獨立暫存目錄後，HolidayPractice／FirebaseSync 內容與本機完全相同。
- Functions `cc3fb6e` 的 `runEbookStudentAction` 已部署，正式讀回 Node.js 22、ACTIVE、versionId 20；hash `8aaa46a45c6daefe71fc28136a1cb36719c5fb1c`。其他 Functions／Dashboard／Rules 未部署。
- 截圖、136項回歸結果、公開檔案雜湊及部署讀回證據：備課專區 `output/holiday-fix-20260915/`。本次未修改正式學生分數、聯絡簿資料或發送 LINE。
