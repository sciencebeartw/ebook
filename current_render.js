function renderDailyPosts(posts, history) {
            var container = document.getElementById('tab-content-0'); 
            if (!posts || posts.length === 0) { container.innerHTML = "<div style='text-align:center; padding:30px; color:#999;'>目前沒有聯絡簿資料</div>"; return; } 
            var html = ""; 

            var getLinkMode = function (post, fieldKey) {
                var options = post && post.displayOptions;
                if (typeof options === "string") {
                    try { options = JSON.parse(options); } catch (e) { options = {}; }
                }
                options = options && typeof options === "object" ? options : {};
                var mode = fieldKey === "note"
                    ? ((options.links || {}).noteLinkMode || "auto")
                    : ((options.homework || {})[fieldKey + "LinkMode"] || "auto");
                return ["auto", "general", "homework", "supplement", "custom"].indexOf(mode) > -1 ? mode : "auto";
            };

            var getCustomLabel = function (post, fieldKey) {
                var options = post && post.displayOptions;
                if (typeof options === "string") {
                    try { options = JSON.parse(options); } catch (e) { options = {}; }
                }
                options = options && typeof options === "object" ? options : {};
                var label = fieldKey === "note"
                    ? ((options.links || {}).noteCustomLabel || "")
                    : ((options.homework || {})[fieldKey + "CustomLabel"] || "");
                return label.toString().trim().slice(0, 24);
            };

            var prependPurpose = function (name, purpose) {
                var label = (name || "連結").toString();
                var prefix = (purpose || "").toString().trim();
                if (!prefix || label.indexOf(prefix + "｜") === 0) return label;
                return prefix + "｜" + label;
            };

            var getExamPrefix = function (text) {
                var raw = (text || "").toString();
                if (raw.indexOf("複習") > -1) return "複習考卷";
                if (raw.indexOf("鑑定") > -1) return "鑑定考卷";
                if (raw.indexOf("隨堂") > -1) return "隨堂考卷";
                if (raw.indexOf("小考") > -1) return "小考卷";
                return "考卷";
            };

            var parseBtn = function (text, linkMode, customLabel, linkPrefix) {
                if (!text) return "";
                text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                var withBr = text.replace(/\n/g, '<br>');
                withBr = withBr.replace(/\[quote:([^\]]+)\](.*?)\[\/quote\]/g, function(match, type, qContent) {
                    return `<div class="quote-box"><div class="quote-type">${type}</div><div class="quote-content">${qContent}</div></div>`;
                });
                return withBr.replace(/\[(.*?)\](http[s]?:\/\/[^\s<]+)/g, function (match, name, url) {
                    if (linkPrefix) {
                        var examName = name.replace(/^(?:小考|隨堂考|鑑定考|複習考|補考)[：:]\s*/, "");
                        return `<a href="${url}" target="_blank" class="btn-link">📄 ${prependPurpose(examName, linkPrefix)}</a>`;
                    } else if (linkMode === "supplement") {
                        var displayName = /補充(?:教材|資料|資訊)?/.test(name) ? name : ("補充教材｜" + name);
                        return `<a href="${url}" target="_blank" class="btn-supplement-tag">📎 ${displayName}</a>`;
                    } else if (linkMode === "general" || linkMode === "custom") {
                        var rawPrefix = linkMode === "general" ? "一般連結" : (customLabel || "自訂連結");
                        var safePrefix = rawPrefix.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        return `<a href="${url}" target="_blank" class="btn-general-tag">🔗 ${prependPurpose(name, safePrefix)}</a>`;
                    } else if (linkMode === "homework") {
                        return `<a href="${url}" target="_blank" class="btn-important-tag">${name}</a>`;
                    } else if (linkMode !== "general" && (name.indexOf("附件") > -1 || name.indexOf("作業") > -1)) {
                        return `<a href="${url}" target="_blank" class="btn-small-tag">📎 ${name}</a>`;
                    } else {
                        return `<a href="${url}" target="_blank" class="btn-link">${name}</a>`;
                    }
                });
            };

            posts.forEach(function (post) {
                var safeDateId = post.date.replace(/\//g, '-');
                var exam = post.examData.main; 
                var others = post.examData.others; 
                var scoreReportHtml = ""; 
                var gradeHtml = "";
                
                var postStyle = "feed-post";
                var dateStyle = "feed-date";
                var titlePrefix = `<span class="category-tag">課程</span>`;
                var scoreHtml = "";

                if (exam) {
                    var logic = getDisplayLogic(exam, history); 
                    if (logic.needsReport) { 
                        scoreReportHtml = `<div class='score-report-section' style='margin-bottom:15px; border:2px dashed #f59e0b; padding:10px; border-radius:15px;'>
                            <div style='font-weight:bold; color:#b45309; margin-bottom:10px; font-size:1rem;'>📝 回報補考分數</div>
                            <div class='input-box' style='display:flex; gap:10px;'>
                                <input type='number' class='score-input' id='score-in-${safeDateId}' placeholder='輸入分數' style='flex:1; padding:8px; border-radius:8px; border:1px solid #d1d5db;'>
                                <button class='btn-primary' style='width:auto; margin:0; padding:8px 15px; height:auto; box-shadow:none;' onclick="submitScoreReport('${safeDateId}', '${post.date}')">送出</button>
                            </div>
                        </div>`; 
                    } 

                    var sc = parseFloat(logic.mainScore);
                    if (logic.needsReport || isNaN(sc) || logic.mainScore === "尚未繳交") {
                        postStyle = "feed-post feed-post-danger";
                        dateStyle = "feed-date feed-date-danger";
                        titlePrefix = `<span class="category-tag danger">需補考</span>`;
                        scoreHtml = `<div class="feed-score-pill fail">⚠️ 缺考或未交</div>`;
                    } else if (sc < 60) {
                        postStyle = "feed-post feed-post-danger";
                        dateStyle = "feed-date feed-date-danger";
                        titlePrefix = `<span class="category-tag danger">未達標</span>`;
                        scoreHtml = `<div class="feed-score-pill fail">小考: ${sc}分 (需補考)</div>`;
                    } else if (sc === 100) {
                        scoreHtml = `<div class="feed-score-pill">💯 小考: 100分 🏆</div>`;
                    } else {
                        scoreHtml = `<div class="feed-score-pill">📝 小考: ${sc}分</div>`;
                    }
                }

                var contentHtml = "";
                var labelHw1 = "今日作業"; if (post.hw2 && post.hw2.toString().trim() !== "") labelHw1 = "今日作業一"; 
                var fields = [
                    { label: "課程進度", val: post.progress }, 
                    { label: "小考考卷", val: post.quiz, linkPrefix: getExamPrefix(post.quiz) },
                    { label: labelHw1, val: post.hw1, linkMode: getLinkMode(post, "hw1"), customLabel: getCustomLabel(post, "hw1") },
                    { label: "今日作業二", val: post.hw2, linkMode: getLinkMode(post, "hw2"), customLabel: getCustomLabel(post, "hw2") },
                    { label: "補考考卷", val: post.makeup, linkPrefix: "補考題目" },
                    { label: "下週範圍", val: post.range }, 
                    { label: "補充資訊", val: post.note, linkMode: getLinkMode(post, "note"), customLabel: getCustomLabel(post, "note") }
                ]; 

                function getPostInfoKind(label) {
                    var text = (label || '').toString();
                    if (/補考/.test(text)) return 'makeup';
                    if (/考卷|小考|隨堂|鑑定|複習考/.test(text)) return 'quiz';
                    if (/作業/.test(text)) return 'homework';
                    if (/範圍/.test(text)) return 'range';
                    if (/補充|備註/.test(text)) return 'note';
                    return 'progress';
                }
                
                var feedDescInner = "";
                fields.forEach(function (f) { 
                    if (f.val) feedDescInner += `<section class="info-block info-kind-${getPostInfoKind(f.label)}"><div class="info-label">${f.label}</div><div class="info-content">${parseBtn(f.val, f.linkMode || "auto", f.customLabel || "", f.linkPrefix || "")}</div></section>`;
                }); 

                var pDateShort = post.date.substring(5).replace("-", "/"); var pDateFull = post.date.replace(/-/g, "/"); 
                var myHistory = history.filter(function (h) { return h.targetDate == pDateShort || h.targetDate == post.date || h.targetDate == pDateFull; }); 
                var historyHtml = ""; 
                myHistory.forEach(function (h) { 
                    if (h.type !== "補考回報") { 
                        var displayType = (h.type === "家長留言" || h.type === "家長/學生" || h.type === "學生留言") ? "留言" : h.type; 
                        historyHtml += "<div style='background:#f1f5f9; padding:8px 12px; border-radius:10px; margin-bottom:8px; font-size:0.9rem;'><b>" + displayType + ":</b> " + parseBtn(h.content) + " <span style='font-size:0.75rem;color:#94a3b8; float:right;'>" + h.time.substring(5, 16) + "</span></div>"; 
                    }
                }); 

                var uploadHtml = `
                    <div style="background:#e0f2fe; padding:12px; border-radius:12px; margin-bottom:15px; border:1px solid #bae6fd;">
                        <span style="font-weight:bold; color:#0284c7; display:block; margin-bottom:8px; font-size:0.9rem;">📤 作業/筆記上傳區</span>
                        <div style="position:relative; overflow:hidden; display:inline-block; width:100%;">
                            <button class="btn-primary" style="background:#0ea5e9; margin:0; padding:10px; font-size:0.95rem; box-shadow:none; pointer-events:none;">➕ 選擇檔案 (可多選)</button>
                            <input type="file" multiple onchange="handleStudentUpload(this, '${post.date}')" style="position:absolute; top:0; right:0; min-width:100%; min-height:100%; font-size:100px; text-align:right; filter:alpha(opacity=0); opacity:0; outline:none; cursor:inherit; display:block;">
                        </div>
                        <div id="upload-status-${safeDateId}" style="margin-top:5px; font-size:0.85rem; color:#0369a1; font-weight:bold;"></div>
                    </div>
                `;

                var fbInputSection = `<div style='display:flex; gap:10px; margin-top:10px;'>
                    <input type='text' id='input-${safeDateId}' placeholder='回覆或留言給老師...' style='flex:1; padding:10px; border-radius:12px; border:1px solid #e2e8f0; font-size:0.95rem; outline:none;'>
                    <button style='background:var(--primary-gradient); color:white; border:none; border-radius:12px; padding:0 20px; font-weight:bold;' onclick="sendFeedback('${safeDateId}', '${post.date}', '學生留言')">送出</button>
                </div>`;

                html += `
                <div class="glass-card" style="padding:15px 20px;">
                    <div class="${postStyle}">
                        <div class="feed-header">
                            <div class="${dateStyle}">${post.date}</div>
                            ${scoreHtml}
                        </div>
                        <h3 class="feed-title">${titlePrefix} ${post.title || "本日課程"}</h3>
                        <div class="feed-desc">${feedDescInner}</div>
                        ${scoreReportHtml}
                        <div style="border-top:1px dashed #cbd5e1; margin-top:15px; padding-top:15px;">
                            ${uploadHtml}
                            <div style="font-weight:bold; color:#64748b; font-size:0.9rem; margin-bottom:10px;">💬 聯絡簿交流區</div>
                            <div id='history-${safeDateId}'>${historyHtml}</div>
                            ${fbInputSection}
                        </div>
                    </div>
                </div>`;
            }); 
            container.innerHTML = html;
        }
