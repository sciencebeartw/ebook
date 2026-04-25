import re

with open("index.html", "r", encoding="utf-8") as f:
    index_html = f.read()

# Extract styles from index.html
style_match = re.search(r'<style>(.*?)</style>', index_html, re.DOTALL)
index_styles = style_match.group(1) if style_match else ""

# The new introduce.html template
template = r"""<!DOCTYPE html>
<html lang="zh-TW">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>山熊科學：電子聯絡簿系統 100% 全能操作對照手冊</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;900&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
        ###STYLES###

        /* ===== Poster Layout Styles ===== */
        body {
            background-color: #2c3e50;
            margin: 0;
            padding: 50px 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .controls {
            width: 1000px;
            background: white;
            padding: 25px;
            border-radius: 20px;
            margin-bottom: 40px;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        }
        .download-btn {
            background: linear-gradient(135deg, #0071e3, #3498db);
            color: white;
            border: none;
            padding: 18px 50px;
            font-size: 1.5rem;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 900;
        }
        
        #poster-canvas {
            width: 1000px;
            background: #f8fafc;
            padding: 60px;
            border-radius: 40px;
            display: flex;
            flex-direction: column;
            gap: 70px;
            box-sizing: border-box;
        }
        .feature-block { display: flex; gap: 50px; align-items: center; min-height: 480px; }
        .feature-block.reverse { flex-direction: row-reverse; }
        
        .phone-frame {
            width: 380px;
            background: var(--bg, #f0fdf4);
            border: 12px solid #2c3e50;
            border-radius: 40px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            flex-shrink: 0;
            position: relative;
            /* force standard app font */
            font-family: 'Noto Sans TC', sans-serif;
        }
        .phone-frame * {
            box-sizing: border-box;
        }
        
        .info-panel { flex: 1; }
        .info-panel h2 { font-size: 2.2rem; font-weight: 900; color: #1e293b; margin: 0 0 20px 0; }
        .info-panel p { font-size: 1.35rem; color: #4b5563; line-height: 1.7; margin: 0; }

        /* 1x4 功能概覽卡片 (壓縮版) */
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 35px; }
        .summary-card { background: white; padding: 25px 20px; border-radius: 25px; border: 1px solid #f1f5f9; box-shadow: 0 10px 40px rgba(0,0,0,0.05); text-align: left; }
        .summary-card h3 { font-size: 1.4rem; color: #1e293b; margin: 15px 0 10px 0; font-weight: 900; }
        .summary-card p { font-size: 1.05rem; color: #64748b; line-height: 1.6; margin: 0; }
        .icon-badge { width: 60px; height: 60px; background: #f8fafc; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 30px; }
        .h-box { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 8px; font-weight: 900; }
        .h-box.red { background: #fee2e2; color: #b91c1c; }
        .h-box.green { background: #dcfce7; color: #15803d; }
        .h-box.orange { background: #ffedd5; color: #ea580c; }

        /* mock header overrides */
        .mock-header-bar {
            background: #ffffff;
            padding: 8px 10px;
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: 8px;
            border-bottom: 3px solid #10b981;
            box-shadow: 0 2px 10px rgba(0,0,0,0.02);
            min-height: 80px;
            overflow: hidden;
        }

        /* timeline card overrides for display */
        .mock-post-card-wrapper {
            margin: 15px 15px;
            /* hide the pseudo elements line */
        }
        
    </style>
</head>

<body>

    <div class="controls">
        <h2 style="margin:0 0 20px 0;">山熊科學：100% 數位系統功能全圖解 (改版全新手冊)</h2>
        <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
            <button id="btn-long" class="download-btn" onclick="takeScreenshot()">📸 下載 究極高清長圖</button>
            <button id="btn-sections" class="download-btn" style="background: linear-gradient(135deg, #16a085, #1abc9c);" onclick="downloadInSections()">📂 分段下載 (推薦傳 LINE)</button>
            <button id="btn-pdf" class="download-btn" style="background: linear-gradient(135deg, #c0392b, #e74c3c);" onclick="downloadPDF()">📄 下載 高清 PDF 版</button>
        </div>
        <p style="margin: 15px 0 0 0; font-size: 0.9rem; color: #666; font-weight: bold;">💡 小技巧：分段下載後依序傳到 LINE 群組，家長閱讀最輕鬆、文字最清楚！</p>
    </div>

    <div id="poster-canvas">
        <div class="poster-header" style="text-align:center; padding-bottom:30px; background: white; border-radius: 40px; padding: 40px 60px; box-sizing: border-box; margin-bottom: 20px;">
            <h1 style="font-size:3.8rem; margin:0; color:#1e293b; font-weight: 900; letter-spacing: -2px;">山熊科學數位聯絡簿</h1>
            <p style="font-size:1.5rem; color:#64748b; margin:10px 0 0 0;">全方位掌握學習狀況，溝通無障礙 🚀</p>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="icon-badge">🔒</div>
                    <h3>專屬防護</h3>
                    <p>全新設計與 <span class="h-box">修改密碼</span>，數位隱私更升級！</p>
                </div>
                <div class="summary-card">
                    <div class="icon-badge">📊</div>
                    <h3>即時成績</h3>
                    <p>展示 <span class="h-box red">4 種等級</span> 補考動態圖，回報更直覺。</p>
                </div>
                <div class="summary-card">
                    <div class="icon-badge">🎁</div>
                    <h3>回報棒卡</h3>
                    <p>新增自動 <span class="h-box orange">棒卡申請</span>功能，成就解鎖不漏接！</p>
                </div>
                <div class="summary-card">
                    <div class="icon-badge">📤</div>
                    <h3>作業上傳</h3>
                    <p>拍照上傳 <span class="h-box green">作業/筆記</span>，並由老師雙向留言。</p>
                </div>
            </div>

            <!-- LINE 求助導引欄 -->
            <div style="margin-top: 30px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 15px 25px; display: flex; align-items: center; justify-content: center; gap: 20px;">
                <span style="font-size: 1.1rem; font-weight: 900; color: #334155;">急迫疑問？點擊右下角</span>
                <div style="background: #06C755; color: white; padding: 6px 20px; border-radius: 40px; font-weight: 900; display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" style="width: 18px; filter: brightness(0) invert(1);"> LINE 官方
                </div>
                <span style="font-size: 1rem; color: #64748b; font-weight: bold;">多位專業老師在線即時解答！</span>
            </div>
        </div>

        <!-- 1. 安裝指南 -->
        <div class="feature-block">
            <div class="phone-frame" style="height: 550px; background: #f5f5f7;">
                <!-- Replicated from line-tutorial-overlay -->
                <div style="align-items: center; justify-content: center; flex-direction: column; padding: 24px; box-sizing: border-box; display: flex; height: 100%;">
                    <div style="width:100%;">
                        <div style="text-align:center; margin-bottom:18px;">
                            <img src="https://www.sciencebear.com.tw/icon.png" style="width:70px; height:70px; border-radius:16px; box-shadow:0 4px 16px rgba(0,0,0,0.15);" alt="山熊科學">
                            <div style="margin-top:8px; font-size:13px; color:#666;">山熊科學數位聯絡簿</div>
                        </div>
                        <div style="background:rgba(231,76,60,0.1); border:2px solid #e74c3c; border-radius:14px; padding:14px 16px; margin-bottom:16px; text-align:center;">
                            <div style="color:#c0392b; font-weight:bold; font-size:16px; margin-bottom:5px;">🛑 請勿在 LINE 內開啟</div>
                            <div style="color:#555; font-size:13px; line-height:1.6;">Google 安全驗證<b>不支援 LINE 內建瀏覽器</b><br>登入將會失敗</div>
                        </div>
                        <div style="background:white; border-radius:16px; padding:18px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                            <div style="font-weight:bold; color:#2980b9; font-size:14px; margin-bottom:14px; text-align:center;">👉 請依下方動畫指示操作</div>
                            <div class="line-tutorial-container">
                                <div class="lt-dropdown" style="opacity: 1; transform: scale(1); animation: none;"><div class="lt-dropdown-item">在瀏覽器中開啟</div></div>
                                <div class="lt-footer">
                                    <div class="lt-menu-btn"><div class="lt-menu-dot"></div><div class="lt-menu-dot"></div><div class="lt-menu-dot"></div></div>
                                </div>
                                <div class="lt-cursor" style="left: 170px; top: 120px; animation: none;"><div class="lt-click-ripple" style="opacity: 1;"></div></div>
                            </div>
                            <div style="text-align:center; font-size:14px; color:#444; margin-top:14px; line-height:1.7;">
                                點擊畫面<b>右下角的 [ ⋮ ]</b><br>選擇<b>「以 Safari 或 Chrome 開啟」</b>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#0071e3;">📲 第一步：跳出 LINE，安裝桌面捷徑</h2>
                <p>為避免 Google 登入卡住，系統會自動偵測 LINE 並跳出紅色指示<b>「跳轉至外部瀏覽器」</b>。<br>切換成功後，系統會引導您將網頁<b>「加入主畫面」</b>，以後就能像專屬 App 一樣在桌面隨開即用，不怕每次都要重新登入了！</p>
            </div>
        </div>

        <!-- 2. 登入改密碼 -->
        <div class="feature-block reverse">
            <div class="phone-frame" id="login-screen" style="height: 520px; background: white; padding: 20px; justify-content: flex-start; position: relative; min-height: auto;">
                <img src="https://www.sciencebear.com.tw/icon.png" class="logo-img" alt="山熊科學" style="margin-top: 30px;">
                <h2>數位聯絡簿</h2>
                <div class="sub-title" style="margin-bottom: 20px;">小六資優自然<br>國中自然超前班</div>
                <div class="input-group"><input type="text" placeholder="請輸入學生姓名" style="pointer-events: none;"></div>
                <div class="input-group"><input type="password" placeholder="請輸入密碼 (預設家長手機)" style="pointer-events: none;"></div>
                <button class="login-btn">登入查看</button>
                <div class="forgot-pwd">忘記密碼請洽山熊科學</div>

                <!-- 模擬登入後的修改密碼提示疊加 -->
                <div style="position: absolute; bottom: 30px; left: 0; width: 100%; display: flex; justify-content: center;">
                    <div style="background: rgba(255,255,255,0.95); border: 2px solid #10b981; padding: 15px; border-radius: 15px; width: 85%; box-shadow: 0 10px 20px rgba(0,0,0,0.1); text-align: center;">
                        <div style="font-size: 0.95rem; color: #064e3b; margin-bottom: 10px; font-weight: bold;">登入後，請點擊上方工具列：</div>
                        <div class="header-icon-btn pwd-btn" style="display:inline-flex; width:36px; height:36px; font-size:18px;">🔑</div>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#10b981;">🔑 預設登入與帳戶安全</h2>
                <p>初次使用的預設帳密：<br>👤 **帳號**：學生姓名 (請輸入全名)<br>🔒 **密碼**：家長留下的手機號碼<br><br>為了保障孩子的資料安全，首次登入成功看到成績後，強烈建議您點擊右上角的<b>「🔑 (改密碼)」</b>按鈕，變更為您專屬的密碼。</p>
            </div>
        </div>

        <!-- 3. 緊急公告彈窗 -->
        <div class="feature-block">
            <div class="phone-frame" style="height: 480px; position: relative; background: #f0fdf4;">
                <div class="mock-header-bar">
                    <div class="header-col-logo"><img src="https://www.sciencebear.com.tw/icon.png" class="header-logo-full"></div>
                    <div class="header-col-info">
                        <div class="class-info-top">國二自然超前班</div>
                        <div class="name-pill-row"><span class="student-info">林阿熊</span></div>
                    </div>
                </div>
                
                <div class="emergency-modal" style="display:flex; position:absolute; backdrop-filter: blur(2px); z-index: 10;">
                    <div class="emergency-box" style="animation: none;">
                        <div class="emergency-header">⚠️ 緊急公告</div>
                        <div class="emergency-body">因颱風來襲，今日全日自然課程皆改為線上直播，請注意群組連結！</div>
                        <div class="emergency-footer">
                            <button class="emergency-btn" style="font-family: inherit;">我已閱讀</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#ef4444;">🚨 重要公告：即時彈出提醒</h2>
                <p>當有停課、補課或任何影響上課時間地點的極重要訊息，系統會自動跳出<span style="font-weight:900; color:#ef4444;">強制紅色視窗</span>。家長點擊「我已閱讀」後才能進行其他動作，確保訊息絕對不漏接！</p>
            </div>
        </div>

        <!-- 4. 公告分頁列表 -->
        <div class="feature-block reverse">
            <div class="phone-frame" style="height: 520px; background:#f2f3f7; padding-top: 10px; overflow-y: hidden;">
                <div class="tabs">
                    <div class="tab-item">聯絡簿</div>
                    <div class="tab-item active" style="font-size: 1.1rem; padding: 10px 0;">公佈欄 &amp; 公告</div>
                </div>
                <div style="padding: 5px;">
                    <div class="bulletin-card type-normal">
                        <div class="bulletin-header"><span class="bulletin-title"><span class="bulletin-tag type-normal">一般</span>理化重點整理</span><span class="bulletin-date">09/21</span></div>
                        <div class="bulletin-content">本週重點為「電流與磁場」，請複習講義第一到十頁...</div>
                    </div>
                    <div class="bulletin-card type-schedule">
                        <div class="bulletin-header"><span class="bulletin-title"><span class="bulletin-tag type-schedule">課表</span>上學期課表下載</span><span class="bulletin-date">09/10</span></div>
                        <div class="bulletin-content" style="padding-top: 10px;">
                            <a class="btn-capsule">👉 下載 PDF 課表</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#f59e0b;">📢 分類公佈欄與永久檔案</h2>
                <p>切換至「公佈欄」分頁，可一次查看老師發布的所有歷史消息。系統將資訊分類為<span style="color:#d35400; font-weight:900;">一般公告</span>、<span style="color:#2980b9; font-weight:900;">課表資料</span>與<span style="color:#c0392b; font-weight:900;">緊急提醒</span>，確保所有紀錄點擊即可查閱、下載。</p>
            </div>
        </div>

        <!-- 5. 補考回報與審核 -->
        <div class="feature-block">
            <div class="phone-frame" style="height: 540px; background: white; padding: 0 0 15px; overflow: hidden; border-radius: 40px; background: #f0fdf4;">
                <div class="post-card mock-post-card-wrapper" style="border: 1px solid #e5e7eb;">
                    <div class="post-header"><span>📅 09/21 (四) 聯絡簿</span></div>
                    <div class="grade-section" style="border: none; padding-bottom: 0;">
                        <span class="main-exam-title">今日小考成績</span>
                        <span class="main-exam-range">範圍: 電流的磁效應</span>
                        <div class="main-score" style="font-size: 5rem;">100<span class="score-unit-big">分</span></div>
                        <span class="reviewing-tag">(待審核)</span>
                        <span class="exam-standard-box" style="margin-top: 15px;">🎯 未達 85 分需補考</span>
                    </div>
                    <div class="score-report-section" style="margin: 15px 15px 25px;">
                        <div style="font-weight: 900; color: #c0392b; margin-bottom: 10px; font-size: 1.15rem; text-align: center;">🖍️ 新增/修改 本次補考分數</div>
                        <div class="input-box" style="margin-top: 0;">
                            <input type="number" class="score-input" value="100" style="pointer-events:none;">
                            <button class="score-btn">送出</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#e74c3c;">🎯 在家補考：分數一鍵回報</h2>
                <p>若孩子領回補考卷，寫完並批改後，請在成績單下方的<span style="font-weight:900; color:#e74c3c;">紅色虛線回報欄</span>輸入分數。回報後成績會顯示為<span style="color:#3498db; font-weight:900;">(待審核)</span>，讓老師在後台同步核對。</p>
            </div>
        </div>

        <!-- 6. 補考分級狀態 -->
        <div class="feature-block reverse">
            <div class="phone-frame" style="height: 620px; background: white; text-align:center; padding-top:20px; border-radius: 40px;">
                <span class="main-exam-range">範圍: 電流的磁效應</span>
                <div class="main-score text-red" style="font-size:4.5rem; color: #e74c3c;">50<span class="score-unit-big">分</span></div>
                <span class="makeup-status-tag status-warning" style="margin-bottom: 15px;">⚠️ 未達標需補考</span>
                
                <div class="v2-bar-chart-container" style="height: 80px; margin: 15px 20px;">
                    <div class="v2-bar-col"><div class="v2-bar-fill" style="height: 30%; background: #4ade80;" data-val="1"></div><div class="v2-bar-label">0~60</div></div>
                    <div class="v2-bar-col"><div class="v2-bar-fill" style="height: 100%; background: #fbbf24;" data-val="4"></div><div class="v2-bar-label" style="opacity: 0;">60~70</div></div>
                    <div class="v2-bar-col"><div class="v2-bar-fill" style="height: 40%; background: #f87171;" data-val="2"></div><div class="v2-bar-label" style="opacity: 0;">70~80</div></div>
                    <div class="v2-bar-col"><div class="v2-bar-fill" style="height: 20%; background: #38bdf8;" data-val="1"></div><div class="v2-bar-label" style="opacity: 0;">80~90</div></div>
                    <div class="v2-bar-col"><div class="v2-bar-fill" style="height: 60%; background: #a78bfa;" data-val="3"></div><div class="v2-bar-label">90+</div></div>
                </div>

                <span class="exam-standard-box" style="margin: 20px auto 10px;">🎯 未滿 85 分需補考</span>
                <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
                
                <div style="font-weight:900; color:#64748b; margin-bottom:10px;">【補考五大狀態圖例】</div>
                <div style="font-size: 0.95rem;">
                <span class="makeup-status-tag status-green">👍 補考結果：觀念理解良好</span>
                <span class="makeup-status-tag status-yellow">😐 補考結果：觀念大致理解</span>
                <span class="makeup-status-tag status-orange">😐 補考結果：觀念不太理解</span>
                <span class="makeup-status-tag status-red">💪 補考結果：觀念必須加強</span>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#ea580c;">📉 班級統計圖與雙重顏色警示</h2>
                <p>成績未達標會顯示<span style="color:#cc0000; font-weight:900;">⚠️ 補考警示</span>。成績會自動帶出全班的分散動態長條直方圖，若發生補考，系統還會根據補考錯題數呈現<span style="color:#27ae60; font-weight:900;">綠色</span>到<span style="color:#cc0000; font-weight:900;">紅色</span>的狀態，幫助家長秒懂孩子是真聽懂了，還是還需要再加強。</p>
            </div>
        </div>

        <!-- 7. 棒卡申請區 -->
        <div class="feature-block">
            <div class="phone-frame" style="height: 520px; background: white; padding: 20px; box-sizing: border-box; text-align: left; background: #f0fdf4;">
                <div class="mock-header-bar" style="margin: -20px -20px 20px -20px; padding: 10px 20px;">
                    <div class="header-col-info" style="padding: 0;">
                        <span class="student-info" style="font-size: 1.4rem;">林阿熊</span>
                    </div>
                    <div>
                        <span class="sticker-badge-header" style="font-size: 1rem; padding: 4px 10px;">🌟 棒卡數：x 3</span>
                    </div>
                </div>
                
                <div class="post-card" style="box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);">
                    <div class="feedback-section">
                        <div class="sticker-apply-box">
                            <span class="sticker-apply-title">🎁 棒卡申請區</span>
                            <div class="sticker-apply-row">
                                <select class="sticker-reason-select">
                                    <option>完成學校作業</option>
                                </select>
                                <select class="sticker-count-select">
                                    <option>+1 張</option>
                                </select>
                            </div>
                            <button class="sticker-submit-btn" style="width: 100%; margin-top: 10px; font-family: inherit;">送出申請表 🚀</button>
                            <div class="sticker-hint">每日可申請一次，老師會盡快審核喔！</div>
                        </div>

                        <div class="history-msg">
                            <div class="history-msg-avatar avatar-student">熊</div>
                            <div class="history-msg-body sticker-body">
                                <div><b>申請發放棒卡</b> <span class="sticker-badge">+1 張</span></div>
                                <div style="font-size: 0.95rem; color: #ea580c; margin-top: 4px;">理由：完成學校作業</div>
                                <div class="sticker-status approved">✅ 已核准發放</div>
                                <div class="history-msg-time">09/21 18:30</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#fb923c;">🎁 全新上線：回報棒卡系統</h2>
                <p>全新加入自動化的<span style="font-weight:900; color:#ea580c;">「棒卡申請」</span>功能！孩子在家完成特定目標（如：寫完學校作業、幫忙做家事）後，可直接透過橘色的申請區送出請求，老師審核通過後點數直接加進上方帳戶，成就感滿滿！</p>
            </div>
        </div>

        <!-- 8. 留言與檔案區 -->
        <div class="feature-block reverse">
            <div class="phone-frame" style="height: 580px; background: white; display: flex; flex-direction: column;">
                <div class="student-upload-box" style="margin: 15px; text-align: center;">
                    <span class="upload-title">🟢 學生作業上傳區</span>
                    <div class="upload-btn-real" style="pointer-events: none;">📎 選擇檔案 / 拍照</div>
                    <div class="upload-status">可上傳多張照片</div>
                </div>
                
                <div class="feedback-section" style="flex: 1; overflow-y: hidden; display: flex; flex-direction: column; padding: 20px 15px;">
                    <div style="flex: 1;">
                        <div class="history-msg">
                            <div class="history-msg-avatar avatar-teacher">喵</div>
                            <div class="history-msg-body teacher-body">
                                <div><a class="btn-small-tag">📎 P102-105.jpg</a></div>
                                <div>表現得很棒！</div>
                                <div class="history-msg-time">09/20 20:42</div>
                            </div>
                        </div>
                        <div class="history-msg">
                            <div class="history-msg-avatar avatar-student">熊</div>
                            <div class="history-msg-body">
                                <div class="quote-box">
                                    <div class="quote-type">老師：喵</div>
                                    表現得很棒！
                                </div>
                                <div>謝謝阿喵老師！</div>
                                <div class="history-msg-time">09/20 20:56</div>
                            </div>
                        </div>
                    </div>
                    <div class="input-box" style="margin-top: auto;">
                        <input type="text" class="fb-input" placeholder="回覆或留言...">
                        <button class="fb-btn">送出</button>
                    </div>
                </div>
            </div>
            <div class="info-panel">
                <h2 style="color:#10b981;">💬 雙向對話留言板與檔案上傳</h2>
                <p>除了強大的「引用功能」可自動綁定老師的對話內容外，也完美支援<b>「作業拍照上傳」</b>。<br>點擊綠色虛線區即可附上圖片，有不懂的立即發問，讓老師線上看圖解惑，再也不怕問題卡住！</p>
            </div>
        </div>

        <div style="text-align:center; color:#999; border-top:1px solid #ddd; padding-top:40px; padding-bottom:50px; font-weight: bold;">
            © 2026 山熊科學教育 Bear's Lab. All Rights Reserved.
        </div>
    </div>

    <script>
        function updateBtn(id, text, disabled) {
            const btn = document.getElementById(id);
            if (text) btn.innerText = text;
            btn.disabled = !!disabled;
        }

        async function takeScreenshot() {
            updateBtn("btn-long", "⏳ 正在生成究極高清長圖...", true);
            try {
                const canvas = await html2canvas(document.querySelector("#poster-canvas"), {
                    scale: 3, 
                    backgroundColor: "#f8fafc",
                    useCORS: true
                });
                const link = document.createElement('a');
                link.download = '山熊科學-電子聯絡簿操作手冊(全新長圖版).png';
                link.href = canvas.toDataURL('image/png', 1.0);
                link.click();
                updateBtn("btn-long", "✅ 下載成功！ (可再次下載)", false);
            } catch (e) {
                console.error(e);
                updateBtn("btn-long", "❌ 下載失敗，請重試", false);
            }
        }

        async function downloadInSections() {
            updateBtn("btn-sections", "⏳ 正在處理各區塊...", true);
            const blocks = [
                document.querySelector(".poster-header"),
                ...document.querySelectorAll(".feature-block")
            ];
            
            try {
                for (let i = 0; i < blocks.length; i++) {
                    const wrapper = document.createElement('div');
                    wrapper.style.padding = '50px'; 
                    wrapper.style.background = '#f8fafc'; 
                    wrapper.style.width = '1000px'; 
                    wrapper.style.boxSizing = 'border-box';
                    wrapper.style.position = 'absolute';
                    wrapper.style.top = '-9999px';
                    wrapper.style.left = '0';
                    
                    const clone = blocks[i].cloneNode(true);
                    wrapper.appendChild(clone);
                    document.body.appendChild(wrapper);

                    const canvas = await html2canvas(wrapper, {
                        scale: 3,
                        backgroundColor: "#f8fafc",
                        useCORS: true
                    });
                    
                    document.body.removeChild(wrapper);

                    const link = document.createElement('a');
                    link.download = `山熊科學手冊_第${i + 1}部分.png`;
                    link.href = canvas.toDataURL('image/png', 1.0);
                    link.click();
                    
                    await new Promise(r => setTimeout(r, 600)); 
                    updateBtn("btn-sections", `⏳ 已下載 ${i+1}/${blocks.length}`, true);
                }
                updateBtn("btn-sections", "✅ 分段下載完成！", false);
            } catch (e) {
                console.error(e);
                updateBtn("btn-sections", "❌ 下載失敗", false);
            }
        }

        async function downloadPDF() {
            updateBtn("btn-pdf", "⏳ 正在生成多頁 PDF...", true);
            const { jsPDF } = window.jspdf;
            
            try {
                const blocks = [
                    document.querySelector(".poster-header"),
                    ...document.querySelectorAll(".feature-block")
                ];
                
                const pdf = new jsPDF('l', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                for (let i = 0; i < blocks.length; i++) {
                    const wrapper = document.createElement('div');
                    wrapper.style.padding = '30px'; 
                    wrapper.style.background = '#f8fafc'; 
                    wrapper.style.width = '1000px'; 
                    wrapper.style.boxSizing = 'border-box';
                    wrapper.style.position = 'absolute';
                    wrapper.style.top = '-9999px';
                    wrapper.style.left = '0';
                    wrapper.style.display = 'flex';
                    wrapper.style.justifyContent = 'center';
                    wrapper.style.alignItems = 'center';
                    wrapper.style.minHeight = '700px'; 
                    
                    const clone = blocks[i].cloneNode(true);
                    wrapper.appendChild(clone);
                    document.body.appendChild(wrapper);

                    const canvas = await html2canvas(wrapper, {
                        scale: 2,
                        backgroundColor: "#f8fafc",
                        useCORS: true
                    });
                    
                    document.body.removeChild(wrapper);

                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const imgProps = pdf.getImageProperties(imgData);
                    
                    const ratio = pdfWidth / imgProps.width;
                    const finalHeight = imgProps.height * ratio;
                    
                    const yOffset = (pdfHeight - finalHeight) > 0 ? (pdfHeight - finalHeight) / 2 : 0;

                    if (i > 0) {
                        pdf.addPage();
                    }
                    pdf.addImage(imgData, 'JPEG', 0, yOffset, pdfWidth, finalHeight);
                    
                    updateBtn("btn-pdf", `⏳ 正在生成第 ${i+1}/${blocks.length} 頁...`, true);
                }
                
                pdf.save("山熊科學-電子聯絡簿操作手冊.pdf");
                updateBtn("btn-pdf", "✅ PDF 下載成功！", false);
            } catch (e) {
                console.error(e);
                updateBtn("btn-pdf", "❌ PDF 下載失敗", false);
            }
        }
    </script>
</body>

</html>
"""

template = template.replace('###STYLES###', index_styles)

with open("introduce.html", "w", encoding="utf-8") as f:
    f.write(template)

print("introduce.html generated successfully!")
