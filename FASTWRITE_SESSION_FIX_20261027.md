# 2026-10-27 學生預覽與啟動修復

- getEbookGodSession v20 在可信 God session 驗證後正確保留／修復 identityPhone；原學生操作 API 的登入、撤銷及生命週期檢查保留。這修復 Dashboard 學生預覽留言 INTERNAL，沒有放寬家長權限。
- 驗證 session 成功後，待完成政策與單生資料並行讀取，兩者到齊才進入畫面；三項測試通過，無效 session 不啟動資料查詢。
- 一般學生文字留言成功提示改用既有 swalAlert，Firebase 確認後恢復送出按鈕；不再以原生 alert 阻擋後續 UI。

成績、留言、棒卡仍使用既有單生／可見卡片即時投影，保留未送出草稿及原生作業權威。未變更 Rules、學生原始作答或新增大範圍 listener。正式讀回／量測在 code 工作區私有驗收紀錄，手機實機保留。

學生／老師視角再沿用 Dashboard 已驗收的留言預讀：只重用相同 UID、角色、God session、scope、epoch、對話，最多四個且兩分鐘到期。可見即時投影或聚焦的精確輸入框預讀後，按送出不用再讀一次；提交仍在伺服器逐次重驗權限／release，只有 committed 收據才顯示已儲存。失敗保留原 request，legacy proof 不快取。新增12個安全／完成情境通過；不加入 listener、不等待 Sheet。
