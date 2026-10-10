# 課本作業按鈕章節與 SVG

2026-10-10。使用者指定保留「課本作業｜」前綴，加上章節／範圍，不顯示題數或「新系統」。

例：課本作業｜理化第11章 常見的力｜概念一、二。沿用小考卷 SVG.document，作業原按鈕色保留；手機以章節、概念區段換行。完整章成績範圍仍依原 target.label 顯示「理化第11章 常見的力 全」。

Dashboard用伺服器凍結標籤生成連結，複製／重存去重仍涵蓋舊新格式；原Google表單带入選項不變。後端先部署相容驗證再發布前端。兩種歷史標籤維持可驗證，現有題數／評分／身分／期限契約不變。eBook正常聯絡簿與一般文字連結路徑皆用文件SVG。

驗證：Dashboard9、核心15、eBook10項及inline script語法通過；Chromium1280/390/320px顯示標籤正確、與小考相同SVG、無橫向溢出。按鈕QA為正式renderer加合成文字，未新建post或代學生提交。

資料範圍仍為 sciencebear-admin 单篇post讀取與 quizbank原單生單段流程，無新增GET、listener、資料寫入或Storage傳輸；無LINE、Rules、IAM、GAS更動。
