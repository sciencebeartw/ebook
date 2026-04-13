import sys

with open('GAS/喵/FeedbackSidebar.html', 'r', encoding='utf-8') as f:
    text = f.read()

old_render = """            list.forEach((item, i) => {
                var isScore = (item.type.indexOf("補考") > -1);
                var cls = isScore ? "msg-card score" : "msg-card";

                // 移除內容前面可能存在的單引號 (為了 0 開頭問題加的)
                var displayContent = item.content;
                if (displayContent.startsWith("'")) {
                    displayContent = displayContent.substring(1);
                }

                html += `
            <div class="${cls}">
               <div class="msg-header">
                  <span>📅 ${item.date}</span>
                  <span>${item.time.substring(5, 16)}</span>
               </div>
               <div class="msg-class">[${item.cls}]</div>
               <div class="msg-name">${item.name}</div>
               <div class="msg-type-row">
                  <span class="msg-tag" id="type-${i}">${item.type}</span>
               </div>
               <div class="msg-content" id="content-${i}">${displayContent}</div>
               <div style="margin-top: 10px; display: flex; gap: 5px;">
                  <input type="text" id="reply-${i}" placeholder="輸入阿喵回覆..." style="flex:1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem;">
                  <button onclick="sendReply(${i}, '${item.cls}', '${item.name}', '${item.date}')" style="background:#3498db; color:white; border:none; border-radius:4px; padding: 6px 12px; cursor:pointer; font-weight:bold;">回覆</button>
               </div>
            </div>`;
            });"""

new_render = """            list.forEach((item, i) => {
                var isScore = (item.type.indexOf("補考") > -1);
                var cls = isScore ? "msg-card score" : "msg-card";

                // 移除內容前面可能存在的單引號 (為了 0 開頭問題加的)
                var displayContent = item.content;
                if (displayContent.startsWith("'")) {
                    displayContent = displayContent.substring(1);
                }

                if (item.type === '棒卡申請') {
                    try {
                        var d = JSON.parse(displayContent);
                        var statusBg = d.status === '通過' ? '#dcfce7' : (d.status === '退回' ? '#fee2e2' : '#fff7ed');
                        var statusColor = d.status === '通過' ? '#15803d' : (d.status === '退回' ? '#dc2626' : '#ea580c');
                        html += `
                        <div class="${cls}" style="background: ${statusBg}; border-color: #fb923c;">
                           <div class="msg-header"><span>📅 ${item.date}</span><span>${item.time.substring(5, 16)}</span></div>
                           <div class="msg-class">[${item.cls}]</div>
                           <div class="msg-name">${item.name}</div>
                           <div class="msg-type-row"><span class="msg-tag" id="type-${i}" style="background:#fef3c7; color:#d97706;">⭐ 棒卡申請</span></div>
                           <div class="msg-content" id="content-${i}" style="display:none;">${displayContent}</div>
                           <div style="font-weight:bold; font-size:1.1rem; color:#431407; margin-top:8px;">名目：${d.reason} <span style="background:linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color:white; padding:2px 8px; border-radius:12px; font-size:0.9rem;">+${d.count}棒</span></div>
                           <div style="font-weight:bold; color:${statusColor}; margin-top:4px;">狀態：${d.status}</div>
                           ` + (d.status === '待審核' ? `
                           <div style="margin-top: 10px; display: flex; gap: 5px;" id="sticker-actions-${i}">
                              <button onclick="reviewSticker(${i}, '${item.time}', '${item.cls}', '${item.name}', ${d.count}, '通過')" style="flex:1; background:#22c55e; color:white; border:none; border-radius:4px; padding: 8px; cursor:pointer; font-weight:bold;">✓ 通過</button>
                              <button onclick="reviewSticker(${i}, '${item.time}', '${item.cls}', '${item.name}', ${d.count}, '退回')" style="flex:1; background:#ef4444; color:white; border:none; border-radius:4px; padding: 8px; cursor:pointer; font-weight:bold;">✗ 退回</button>
                           </div>
                           ` : ``) + `
                        </div>`;
                        return; // 結束這一回合
                    } catch(e) {} // 解析失敗退回普通顯示
                }

                html += `
            <div class="${cls}">
               <div class="msg-header">
                  <span>📅 ${item.date}</span>
                  <span>${item.time.substring(5, 16)}</span>
               </div>
               <div class="msg-class">[${item.cls}]</div>
               <div class="msg-name">${item.name}</div>
               <div class="msg-type-row">
                  <span class="msg-tag" id="type-${i}">${item.type}</span>
               </div>
               <div class="msg-content" id="content-${i}">${displayContent}</div>
               <div style="margin-top: 10px; display: flex; gap: 5px;">
                  <input type="text" id="reply-${i}" placeholder="輸入阿喵回覆..." style="flex:1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem;">
                  <button onclick="sendReply(${i}, '${item.cls}', '${item.name}', '${item.date}')" style="background:#3498db; color:white; border:none; border-radius:4px; padding: 6px 12px; cursor:pointer; font-weight:bold;">回覆</button>
               </div>
            </div>`;
            });"""

text = text.replace(old_render, new_render)

# Update sendReply to call loadData() on success
old_reply_success = """                if(res.success) {
                    alert('回覆成功！學生重整聯絡簿即可看到。');
                    input.value = "";
                    btn.innerText = "回覆";
                    btn.disabled = false;
                } else {"""
new_reply_success = """                if(res.success) {
                    alert('回覆成功！');
                    loadData(); // ★ 自動刷新列表
                } else {"""
text = text.replace(old_reply_success, new_reply_success)

# Add reviewSticker JS function
review_fn = """
        function reviewSticker(index, timeStr, className, studentName, count, action) {
            var btnDiv = document.getElementById('sticker-actions-' + index);
            if (btnDiv) btnDiv.innerHTML = '<div style="color:#666; font-size:0.9rem; margin-top:5px;">處理中...</div>';
            
            google.script.run.withSuccessHandler(function(res) {
                if (res.success) {
                    alert(action + '處理完成！');
                    loadData();
                } else {
                    alert('錯誤：' + res.msg);
                    loadData();
                }
            }).approveStickerGas(ADMIN_PWD, timeStr, className, studentName, count, action);
        }
"""
text = text.replace("    </script>", review_fn + "    </script>")

with open('GAS/喵/FeedbackSidebar.html', 'w', encoding='utf-8') as f:
    f.write(text)
print("FeedbackSidebar changed")
