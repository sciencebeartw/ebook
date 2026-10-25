# iPad 作業讀取相容修正（2026-10-25）

使用者已明確核准部署這項前端修正。部分 iPad Safari 缺少 `AbortSignal.timeout`；聯絡簿入口在呼叫 fetch 前即拋出 `AbortSignal.timeout is not a function`，畫面因此停在讀取作業。這不是調課或學生作答資料造成。

聯絡簿 bridge 與獨立作業 API 改用 AbortController 加計時器，保留原本 30 秒與 15 秒逾時，完成或失敗時均清除計時器。登入身分與回應後有效性檢查、老師唯讀、學生預覽確認及原請求內容不變。初次載入失敗時也更新讀取狀態文字。三個入口引用一併更新快取版本。

驗證：入口、作答重試及即時結果相關測試 30/30 通過；包含缺少 AbortSignal.timeout、逾時中止與失敗清理。WebKit 320/390/768/1280 px 合成入口 transport 在移除該 API 後仍可讀取，老師唯讀 submit 保持攔截，無頁面例外、正式寫入。這是合成相容測試，不等同原 iPad 及真人帳號已在正式站完成驗收。

額外 draft-preview 測試有既存 `buildAssessmentLinkHtml is not defined`，未修改基準版本也重現，未擴大修正。

僅修改靜態前端；API 路徑、讀寫範圍、逾時秒數與重試頻率保留。無新增 Firebase 監聽、整包讀寫、Functions/GAS/Rules/Storage 或 LINE 異動，未修改學生答案、成績或轉班對照。GitHub Pages 是否完成發布，以部署後的兩個正式入口防快取資產雜湊核對為準。
