# eBook 完整成績保留與故障等待上限

- 以三支最新正式來源為基底，只改單生單卷的grade_live_projection.js；原業務分數、版本檢查、統計計算、分批投影、Sheet回填與重試維持。
- 原同筆交易遇統計pending時，在該節點保留最多4KB的前次完整顯示；完整投影時清除，無新節點讀取、寫入次數或listener。
- eBook重新進入可使用身分／考卷／綁定／日期／標題核對通過的完整舊結果；新結果完整再整組替換。
- 完全沒有舊完整結果時，畫面最多等八秒，之後呈現已確認分數與「班平均：暫無資料」，不畫不完整統計圖；後端恢復後仍由既有listener自動更新。只有一次本機計時，不發新讀取或輪詢。
- 驗證背景錯誤、連續失敗、重新進入、前後版本、多人修正、零分／請假、身分錯配、正常登分與現有UI；通過才精準發布並回下載驗證。

## 驗證與發布範圍

- 前端七份 Node 回歸共32項通過；Chrome及WebKit各390／1280px，每組原10項情境與新增3項故障復原情境通過。包含真的等待超過八秒、自動顯示已確認分數、統計恢復、重新登入身分隔離、老師改分先後順序、多人修正、編輯保護與無橫向溢出；截圖已視覺檢查。這不是實體LINE或iPad驗收。
- 各支最新正式ZIP候選各15項RTDB Emulator測試通過；包括連續統計失敗、正常恢復、真實單筆交易快照交由全新reader顯示、零分／請假、版本及容量保護。本輪未代改正式學生成績、留言或已讀狀態。
- 三支候選分別以processEbookFastWriteRevision v35、processEbookDemand v11、processEbookFastWriteGradeSource v8為基底，243／252／242個來源檔中各只改grade_live_projection.js一檔，部署前另以version／updateTime防止覆蓋後續來源。發布只用sourceUploadUrl更新；其他設定維持，發布後回下載逐檔核對。
- 僅影響sciencebear-admin。失敗時的既有單生單卷交易最多增加4KB完整舊結果，整筆上限16KB；沒有增加讀取、交易次數、listener、輪詢、GAS、Storage或全班fan-out。Dashboard維持上一輪正式版本。
- 詳細發布版本、Pages及雙網域SHA複驗收據記錄於/code/docs/systems/unread-grade-stability-20261108.md與output/ebook-grade-resilience-20261108.private/。
