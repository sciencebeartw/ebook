# 一般作業完成後報分框等待修正

狀態：使用者已授權，667f24c已推main並完成雙網域HTML／模組SHA讀回。基底為正式 origin/main `eea6440`，主 checkout 既有變更未動。

## 問題與修改

國二自然超前班 2026/10/10 作業卷的報分框原先等待 `submitHomeworkDone` 與 `getHomeworkAnswers` 兩次遠端回應完成才出現。前者經既有 Sheet 寫入佇列，後者還要取得私有答案與既有收據；畫面長時間只剩完成按鈕的回報中文字。這是程式路徑證據，未取得該次學生操作的實測耗時。

按完成後立即呈現報分框，允許先輸入；完成紀錄與答案／收據尚未確認時禁用送出。正式資料與解答存取門檻不變，沒有樂觀假成功。等待階段、失敗重試及整份貼文重繪均保留本次頁面內的各卷分數草稿；不承諾跨重新整理保存。既有完成紀錄重新開啟時也立即呈現報分框，若已有收據則換為已回報。

新增單篇請求狀態以阻止重繪後重複送出，完成回應更新目前 DOM；帳號／reset 世代隔離，忽略舊回應。等待時 Enter 不可繞過鎖定。模組更新使用新 JS 查詢版本；既有推播 service worker 沒有 fetch handler／離線資產快取。

## 驗證

- `node tools/homework_completion_response.test.js`：初次完成、兩段慢回應、重繪防重、分數與零分保留、完成失敗與重試、答案失敗只重讀不重送完成、已回報收據、換人／reset 隔離、僅答案／預覽、後續日期、既有完成重開、版本不符、兩份作業。
- 既有 `homework_report_pending`、`ebook_homework_class_alias_smoke`、`ebook_home_practice_and_makeup_fields`、`daily_post_display_options_smoke`、`ebook_xss_contract_smoke` 全通過。
- 5 段 inline JavaScript、模組語法、diff 空白檢查通過。
- 本機 fixture 使用正式 CSS、實際完成與 renderer 函式、實際作業模組；遠端函式全部 stub，未寫正式資料。
- Chrome／WebKit 320／390／768／1280px 無水平溢出。Chrome 手機等待／桌機 ready 截圖已目視；等待到 ready 保留分數與焦點。WebKit 慢回應故意不釋放，報分框出現 38–62ms（含測試點擊開銷，非正式網路效能承諾），零分全程保留。無 JS 例外；Chrome 只有 fixture favicon 404。
- 兩具名瀏覽器已 close；初次 WebKit 長名稱受 socket 路徑限制失敗，改短名稱成功，失敗 daemon 已退出。正式 LINE／iPhone 實機與發布後讀回尚未執行。

## 邊界與發布

僅 eBook 前端兩檔及回歸測試。sciencebear-admin 沿用既有單篇單生 API 次數／資料範圍；不加讀取、listener、輪詢、Storage 或任何其他 Firebase 專案流量。Functions、GAS、Rules、Sheet 與學生分數未修改。這一版縮短報分框的顯示等待，不縮短後端排隊／GAS 服務時間。

已唯讀查近期 `submitHomeworkDone` 效能紀錄（結構與文字格式），均無符合資料，不能由此斷定不存在慢請求。正式發布需確認；發布時重新 fetch 檢查 origin/main，不得覆蓋別輪變更，再 scoped commit/push 及兩正式網址資產 hash 讀回。

## 發布後驗收

2026-10-17以與正式資產SHA相同的模組合成故障注入：Chrome四尺寸報分框52／45／33／35ms，WebKit68／49／41／40ms；後端callback暫停仍可填0、送出鎖定、完成與答案確認後保留0並可成功回報。僅合成資料，未代交正式學生作業。此數字不是後端／實體LINE效能承諾。正式學生前端沒有新增API／listener。
