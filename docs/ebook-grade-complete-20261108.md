# eBook 成績完整顯示修正計畫

- 沿用 sciencebear-admin 單生成績節點與最多四張可見卡片的小型 revision 監聽，無新增讀取、輪詢、寫入或 Functions 部署。
- 原生分數與統計完整後一次呈現；等待時保留同一登入身分／班級／學生／考卷最近完整快照，首次等待只顯示整卡準備提示。
- 老師修改成功只確認儲存，等完整投影再換顯示；保留輸入、焦點、附件、留言與原分數衝突檢查。
- 驗證延遲、順序顛倒、斷線、零分、請假、帳號切換及桌機／手機版；通過後依使用者授權發布，讀回雙網域資產並再 review。

## 已實作與發布前驗證

- 原生完整快照作為顯示依據；business revision 不再單獨覆蓋主分數。明確 pending 或較舊統計會沿用同一身分與考卷最後完整快照（最多64卷）；切換身分、來源綁定或清除時隔離。回前景／重新上線只清除即時通知狀態，保留同身分快照。
- 第一次沒有完整快照時，聯絡簿與歷史成績整卡顯示準備提示，不露出單邊數字。老師儲存只更新收據與衝突比較值，完整投影 revision 達到收據版本後一次顯示；允許後續他人的較新完整修正。
- 既有單生 native 成績 listener 改用局部成績渲染；身分集合變更才走既有完整重建。等待時不動留言／附件 DOM；編輯中的欄位保留輸入與 expectedCurrentScore，失焦可使用已在記憶體的快照重算，無新增網路請求。
- Node 25項相關回歸全過、5段 inline script 與3份修改模組解析成功。Chrome／WebKit，各390×844及1280×900，四組各10種情境全過：首次等待／完整、等待穩定、原子更新、編輯保護、回覆與統計兩種順序、多人修正、無橫向溢出及家長權限。桌機／手機截圖已視覺檢查。
- 瀏覽器使用實際 renderer／修改分數函式與合成延遲資料；未使用真學生提交。不能外推實體 iPad 或 LINE 內建瀏覽器已實測。
- 發布只含 eBook 靜態前端。本輪不改三支背景函式、GAS、Rules、IAM、學生資料、通知或 Storage。既有 sciencebear-admin 單生成績讀取與最多4張可見卡小型 revision 監聽維持原邊界，沒有新成本放大來源。

驗證方式：`node --test tools/ebook_grade_complete.test.js tools/fastwrite_online_reconnect.test.js tools/ebook_initial_grade_visibility.test.js tools/ebook_transfer_grade_display_date.test.js tools/ebook_score_correction_ui_smoke.js tools/tests/gifted-grade-refresh.test.js`。離線瀏覽器測試頁以 `node tools/ebook_grade_complete_browser.js /private/tmp/<任務暫存目錄>` 建立；僅於127.0.0.1提供並使用具名 Playwright 工作階段，執行 `window.runGradeSuite()`。
