(function(root) {
    'use strict';
    const text = v => String(v == null ? '' : v);
    const key = v => text(v).replace(/[.#$[\]]/g, '-');
    const date = v => text(v).replace(/-/g, '/').replace(/\/0(?=\d)/g, '/');
    const all = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
    function inClass(node, target, context) {
        const classes = [node.dataset.sourceClassKey, node.dataset.storedClassKey].filter(Boolean).map(key);
        return classes.length ? classes.includes(key(target.classKey)) || target.kind === 'bulletin' && classes.includes('全校') && key(context.className) === key(target.classKey) : key(context.className) === key(target.classKey);
    }
    function messageNode(node) {
        // 既有回覆通知指向被回覆的訊息；將同串最新老師回覆帶到眼前。
        // 此節點也供可見已讀判斷，摺疊中的回覆不能被原留言代替。
        const thread = node.closest('[data-feedback-thread-id]');
        return thread && all('[data-feedback-role="teacher"]', thread).at(-1) || node;
    }
    function find(target, context) {
        if (!target || !context || context.preview || !target.classKey) return null;
        if (target.kind === 'homework') return key(target.classKey) === key(context.className) && context.pendingReady
            ? document.querySelector('#tab-content-3 .pending-page-summary') : null;
        if (!target.id) return null;
        if (target.kind === 'bulletin') {
            if (context.activePopup && context.activePopup.id === target.id && key(context.className) === key(target.classKey)) return document.querySelector('#emergencyContent');
            return all('#tab-content-2 [data-push-bulletin-id]').find(n => n.dataset.pushBulletinId === target.id && inClass(n, target, context)) || null;
        }
        if (target.kind === 'grade' || target.kind === 'makeup') return all('#tab-content-1 [data-pending-exam-anchor]').find(n =>
            (n.dataset.examId === target.id || n.dataset.storedExamId === target.id) && inClass(n, target, context)) || null;
        if (!['post', 'message', 'sticker'].includes(target.kind)) return null;
        const posts = all('#tab-content-0 [data-post-id]').filter(n => inClass(n, target, context));
        if (target.kind === 'post') return posts.find(n => n.dataset.postId === target.id) || null;
        // 僅限指定測試生的手動定位驗收，沒有審核紀錄時不建立假棒卡。
        if (target.kind === 'sticker' && target.testSection === true && ['系統測試生','測試學生'].includes(context.studentName) && context.className === '115小六資優自然週六上午班') {
            const post = posts.find(n => n.dataset.postId === target.id);
            return post && post.querySelector('.sticker-apply-box');
        }
        // 留言／棒卡不能退回整篇聯絡簿，否則尚未看見內容就會誤算已讀。
        for (const post of posts.filter(n => date(n.dataset.postDate) === date(target.date))) {
            const item = all('[data-feedback-key]', post).find(n => n.dataset.feedbackKey === target.id);
            if (item) return target.kind === 'message' ? messageNode(item) : item;
            if (target.kind === 'message') {
                const thread = all('[data-feedback-thread-id]', post).find(n => n.dataset.feedbackThreadId === target.id);
                if (thread) return messageNode(thread);
            }
        }
        return null;
    }
    function readable(node) {
        if (!node || !node.isConnected || document.hidden || node.closest('[hidden]') || !node.getClientRects().length) return false;
        if (node.matches('[data-pending-exam-anchor]') && !node.classList.contains('active')) return false;
        if (document.querySelector('dialog[open]') || document.querySelector('.swal2-container')) return false;
        const emergency = document.getElementById('emergencyModal');
        if (emergency && getComputedStyle(emergency).display !== 'none' && !emergency.contains(node)) return false;
        const r = node.getBoundingClientRect(), sticky = document.querySelector('.sticky-wrapper');
        const top = !node.closest('#emergencyModal') && sticky && getComputedStyle(sticky).position === 'sticky' ? sticky.getBoundingClientRect().bottom : 0;
        // 大卡片以頂部內容區判斷，避免卡片尚在畫面下方或只露出尾端就已讀。
        const y = Math.max(top + 1, r.top), h = Math.min(r.height, 120);
        if (r.width <= 0 || h <= 0 || y > r.top + h / 2 || Math.min(innerHeight, r.top + h) - y < Math.min(h, 48)) return false;
        const x = Math.max(1, Math.min(innerWidth - 1, r.left + r.width / 2));
        const hit = document.elementFromPoint(x, y + Math.min(h / 2, 24));
        return !!hit && (node === hit || node.contains(hit));
    }
    function covered() {
        const emergency = document.getElementById('emergencyModal');
        return !!document.querySelector('.swal2-container, dialog[open]') || !!(emergency && getComputedStyle(emergency).display !== 'none');
    }
    async function navigate(target, getContext, onWaiting) {
        let context = getContext();
        if (!target || !context || context.preview || !['post','bulletin','message','sticker','makeup','grade','homework'].includes(target.kind)) return false;
        const tab = target.kind === 'bulletin' ? 2 : ['grade','makeup'].includes(target.kind) ? 1 : target.kind === 'homework' ? 3 : 0;
        context.switchTab(tab);
        let until = Date.now() + 8000, positioned = null, wasCovered = false;
        do {
            context = getContext();
            if (!context || context.preview) return false;
            let node = find(target, context);
            if (!node && target.kind === 'bulletin' && !covered() && context.openPopup(target)) node = find(target, getContext());
            const blocked = covered() && !(node && node.closest('#emergencyModal') && !document.querySelector('.swal2-container, dialog[open]'));
            if (onWaiting) onWaiting(blocked);
            // 公告／待完成優先，閱讀提醒的時間不算內容載入逾時。
            if (blocked) until = Date.now() + 8000;
            if (node) {
                if (target.kind === 'sticker' && target.testSection === true) {
                    const details = node.closest('details');
                    if (details) details.open = true;
                }
                if (target.kind === 'message') {
                    const thread = node.closest('[data-feedback-thread-id]') || node;
                    const toggle = thread.querySelector('.feedback-thread-toggle[aria-expanded="false"]');
                    if (toggle) toggle.click();
                }
                if (target.kind === 'grade' || target.kind === 'makeup') {
                    if (!node.classList.contains('active')) context.expandGrade(node);
                }
                if (positioned !== node || !blocked && wasCovered) {
                    // 背景先定位；關閉待完成會切分頁／恢復捲動，再對齊一次目的地。
                    context.switchTab(tab);
                    const sticky = document.querySelector('.sticky-wrapper');
                    const offset = sticky ? sticky.getBoundingClientRect().height + 12 : 12;
                    if (!node.closest('#emergencyModal')) window.scrollTo({top: Math.max(0, window.scrollY + node.getBoundingClientRect().top - offset), behavior:'instant'});
                    positioned = node;
                }
                if (!blocked) {
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    if (readable(node)) return true;
                    positioned = null;
                }
            }
            wasCovered = blocked;
            await new Promise(resolve => setTimeout(resolve, 160));
        } while (Date.now() < until);
        return false;
    }
    root.EbookPushNavigation = { find, readable, navigate };
})(window);
