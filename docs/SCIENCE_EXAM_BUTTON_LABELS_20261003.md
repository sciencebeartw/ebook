# 自然科考卷按鈕標題

2026-10-03 完成實作與全量驗證，依使用者授權發布；正式版本與讀回證據記於工作區 `docs/systems/dashboard-ebook-gas.md`。

自然科聯絡簿預設將小考、隨堂考、鑑定考、複習考、補考題目與答案按鈕改為「用途｜範圍」。補考題目顯示「補考卷」。SVG、原始 PDF／Office 連結與下載檔名保留；數學呈現與下載行為不變。

Dashboard 聯絡簿編輯器新增「小考與補考按鈕標題」：精簡範圍／完整標題。設定為 `displayOptions.links.examTitleMode`，`full` 保留完整檔名，缺值預設精簡。切換適用該篇所有小考／補考與答案按鈕。新建預設精簡，編輯與複製保留原選擇。沿用既有顯示設定保存／公開預覽契約，不需 GAS 或 Functions 修改。

舊聯絡簿由顯示函式自動處理，不改寫歷史資料，不需逐篇重新保存。未知日期／班別或擷取後空白時保留原標題。

## 正式檔名唯讀盤點

以 `sciencebear-admin` 的 `science/dailyPosts` 和 `admin_workspace/ebook_history/science/dailyPosts` 班級／紀錄 ID shallow 清單為入口，只精確 GET 每筆 `quiz`、`makeup` 及小考角色／標題模式葉節點。兩來源均為 7 班、115 篇、305 個正常連結，另各有 1 筆缺左括號的舊答案連結；相容顯示後每來源 306 個引用。共 180 個不同正常檔名，加 1 個格式例外標籤，181 個全部逐一人工核對範圍並驗證實際呈現。

涵蓋：跨日 `-08`／`-0201`／`、28`、日期班名相黏、班名考試類型相黏、未標考試類型、外層 `小考：`／`複習考：`、在家小考、理化小考、尾端複習考、ANS 有無空白、PDF／DOC／DOCX。一組日期誤植為 9 碼（`202060808`）也可擷取範圍，未修正來源。保留主題／章節／高中補充／前半或全等範圍。

僅證明本次正式快取內可取得的聯絡簿；未查已刪除或未同步到快取的原始檔。可分享的逐份清單在 [181 筆完整對照](SCIENCE_EXAM_LABEL_AUDIT_20261003.html)，不含檔案 URL 或學生資料。含檔案 URL 的原始唯讀結果只留本機暫存 `/private/tmp/science-exam-labels-20261003/review-source.private.json`，不納入儲存庫。沒有下載或逐頁審閱考卷內容。

### 第二輪逐份複核修正

- `理化小考 第五章 聲音` 保留「理化」，避免範圍資訊被一起刪除。
- 12 篇尚未設定小考角色的 ANS 舊答案，顯示時推導為解答；另外 1 篇原本明確設定為答案。使用者明確選擇的題目／答案優先，Dashboard 編輯載入也使用相同辨識，避免保存後退回題目。數學不推導。
- 測試班 1 筆 `補考 理化第13章 電ANS.doc]https://…` 缺少左括號，僅在自然考卷顯示解析前恢復有效文件連結格式，不改寫正式來源；完整模式保留來源實際標籤，不補造日期。
- ANS 使用字界保護；一般英文 `TRANS` 和主題 `圖形解析` 不會被誤刪。

## 驗證

- `tools/science_exam_labels.test.js`：180 筆人工核對 fixture、格式例外標籤、完整標題、未知格式回退、數學隔離、ANS 角色與明確覆寫、escaped 標籤與 Office 預覽／原檔名。
- Dashboard `tests/science_exam_title_mode.test.js`：設定預設／還原／保存及 publicOptions 保留，數學不新增此設定。
- DailyPost display options、作業／補考欄位、XSS、Dashboard 假期預覽及調課測試通過；兩頁 inline scripts 語法與 diff 通過。
- WebKit 隔離預覽：320／390／1280px 精簡與完整 6 情境，SVG、href、44px 按鈕、無水平溢出，pageerror 0。390px 精簡按鈕均一行。Dashboard 實際編輯器另有精簡／完整選項操作截圖。
- 全量 WebKit：230 筆貼文／612 個引用 × 預設缺值及完整模式 × 320／390／1280px，共 3,672 次實際按鈕核對通過。驗證標籤、SVG、href、44px 觸控尺寸、Office 原下載檔名、既有不計分文字保留、無水平溢出及 pageerror 0；以無學生資料、替換為 example.test URL 的隔離 payload 測試。
- 兩個擴大回歸原有基線同樣失敗：`ebook_auth_security_contract_smoke.js` 缺 ClassSessionPlan mock；`ebook_pending_tasks_integration_smoke.js` 缺 getEntryReminderItems mock。本次未改這兩份無關測試或其流程。
- 截圖／隔離檢查腳本在 `output/playwright/science-exam-labels-20261003/` 及 `output/playwright/science-exam-review-20261003/`。未驗收實體 LINE／iPhone 或正式保存。

## 資料與費用範圍

盤點僅自然考卷欄位 scoped GET，第一輪清單加欄位 267,448 bytes；第二輪加角色及模式 271,164 bytes，合計 538,612 bytes。不查學生成績／電話／LINE UID，不下載考卷本體、不寫正式資料。

產品只在已有 payload 中擷取標籤；新選項沿用使用者保存單篇聯絡簿的小型 metadata。無新增資料查詢、listener、輪詢、Storage 傳輸、Functions 或 GAS 呼叫；其他 Firebase 專案不受影響，費用未另量測。原工作區假期卷修改完整保留。
