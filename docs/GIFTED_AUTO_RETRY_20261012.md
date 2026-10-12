# 資優課本作業：斷線後自動補送

使用者要求恢復連線後自動重試，不須學生再次按鈕，並避免重複交卷與登分。原本只有登分摘要會在 online 時更新，答案 outbox 仍要手動 flush。

## 行為與邊界

- 首次送出仍驗留白及 Dashboard 學生視角確認；取消不排入待送佇列。只有既有 pending draft/submit 可自動重試，不建立新 requestId，不改答案、版次或學生身分。
- 離線先保存在既有 localStorage outbox，不送 HTTP；online、回前景、focus、BFCache 返回會補送。重新整理先查原 task，已有正式收據即清 pending，不再交卷；尚未收到則重送原請求。
- 每份作業只有一個重試排程及一個請求在途，與人工操作共用 busy/outbox 鎖。前八次自動重試採逐步退避，之後每兩分鐘最多補送一次，處理 Wi-Fi 仍連著但網際網路中斷、沒有 online 事件的情況。成功、換作業或離開頁面會停止；背景、離線暫停，回到頁面恢復。
- 登入過期、學生身分／權限改變、答案版本衝突、提交編號重用或不合法收據，停止自動重送並呈現既有處理方式，不覆寫其他裝置答案。教師查看模式不建立重送器。
- 伺服器原 requestId/hash/CAS 固定首次正式作答；背景 grade worker 與 GAS 原 ExamID/ledger 維持去重。已收件但 HTTP 回覆截斷時，重送回同一 receipt，正式答案、分數不重新寫入。
- 關閉瀏覽器時 JavaScript 無法繼續送出；需留在作業頁或回到原頁。已確認成功後，背景登分由伺服器繼續。

## 驗證

eBook 39 項（重送、即時結果、三入口、摘要、調課及既有功能）與後端 51 項通過。後端保留原生條件儲存及 GAS worker 實作，只注入合成學生／假資料庫／假 Sheet；沒有正式學生資料異動。

Playwright wrapper 使用 Chrome 桌面 1280px／手機 390px，覆蓋送出前離線、伺服器收件後截斷回覆、連續 online/focus、503 且無 online 事件、pending 重新整理、reload 找到正式收據。WebKit 390px 覆蓋離線恢復及回覆遺失。案例均為17/19、兩題紅底正解；單一正式 event、revision=1、一次 GAS grade write，重送 payload/requestId 完全一致，零 pageerror／水平溢出。兩分鐘低頻恢復由可控時鐘測試驗證，未以正式服務做長時間故障注入。

本輪只修改 eBook 靜態前端，使用者先前要求修完推送的授權延續。sciencebear-admin 仍讀單生 session／名冊；sciencebear-quizbank 仍讀寫單生單作業單分段小節點，重試會增加有限頻率 API 呼叫。沒有新增整班／整庫讀取、listener、Storage 上傳或 GAS 登分重寫。Functions／Rules／IAM／LINE 不變。

實測截圖、JSON 收據及發布 hash 在 `/Users/huangboyu/Desktop/code/output/playwright/gifted-auto-retry-20261012/`；手機 LINE 實機由使用者驗收。
