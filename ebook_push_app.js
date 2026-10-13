(function(root) {
    'use strict';
    const PREFIX = 'sciencebear.ebook.push.v1:';
    const isId = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
    let env = null, state = null, registration = null, bridge = null, busy = false, epoch = 0, refreshAt = 0;
    let dialog, entry, binding = null;
    function escape(text) { return String(text || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function storageKey() { return PREFIX + env.subject; }
    function loadBinding() { try { return JSON.parse(localStorage.getItem(PREFIX + 'device') || 'null'); } catch (_) { return null; } }
    function saveBinding(value) { binding = value; try { if (value) localStorage.setItem(PREFIX + 'device', JSON.stringify(value)); else localStorage.removeItem(PREFIX + 'device'); } catch (_) {} }
    async function timed(work) {
        let timer;
        try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('通知連線逾時，請重新確認狀態後再試')), 20000); })]); }
        finally { clearTimeout(timer); }
    }
    function capable() { return root.isSecureContext && 'serviceWorker' in navigator && 'Notification' in root && 'PushManager' in root; }
    function installed() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
    function ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; }
    function statusText() {
        if (!state) return '尚未取得通知狀態，請按「重新確認狀態」。';
        if (state.mode !== 'test_only') return '手機推播已停用，原聯絡簿和 LINE 照常運作。';
        if (!state.ready) return '老師正在完成通知連線設定，目前尚不能開啟。';
        if (!capable() || ios() && !installed()) return '請從 iPhone／iPad 主畫面的聯絡簿圖示開啟，再允許通知。';
        if (Notification.permission === 'denied') return '手機已封鎖通知。請依下方教學在手機設定中開啟。';
        if (!state.registered) return '這台裝置尚未開啟通知。';
        if (!state.approved) return `已登記，等待老師核准這台裝置（核對碼 ${state.deviceCode}）。`;
        if (!state.enabled) return '這台裝置已暫停通知，可隨時重新開啟。';
        return '這台裝置已開啟測試通知。一般家長尚未開放。';
    }
    const statuses = { queued: '預計 20 秒後發送', processing: '處理中', accepted: '推播服務已接受，請確認各裝置', partial: '部分裝置已送出，其餘已停用或失效', canceled: '已取消', expired: '已逾時，未補送', failed: '裝置失效，請重新開啟', uncertain: '送出結果待確認，未自動重送' };
    function build() {
        if (dialog) return;
        dialog = document.createElement('dialog'); dialog.className = 'ep-dialog'; dialog.setAttribute('aria-labelledby', 'ep-title');
        dialog.innerHTML = '<header><h2 id="ep-title">通知設定與教學</h2><button type="button" data-ep="close" aria-label="關閉通知設定">關閉</button></header><div class="ep-body"><p class="ep-state" role="status"></p><p class="ep-note">目前只供系統測試生試用。通知可以關閉，不影響查看聯絡簿與使用 LINE。</p><p class="ep-error" role="alert"></p><div class="ep-actions"><button type="button" class="ep-primary" data-ep="enable">開啟這台裝置通知</button><button type="button" data-ep="pause">暫停這台裝置</button><button type="button" data-ep="refresh">重新確認狀態</button></div><button type="button" data-ep="test">20 秒後傳送測試通知</button><p class="ep-note ep-test-targets"></p><p class="ep-note">只需在其中一台按一次，再將手機與 iPad 回主畫面或鎖定，觀察是否收到。最多每分鐘測試一次；服務接受不代表手機已顯示。</p><h3>最近測試</h3><ul class="ep-log"></ul><details open><summary>iPhone／iPad 如何開啟通知</summary><ol><li>使用 iOS／iPadOS 16.4 或以上，先將聯絡簿加入主畫面。</li><li>從主畫面圖示開啟，以測試生登入，並勾選「保持登入」。老師預覽不能註冊。</li><li>按「開啟這台裝置通知」，在手機提示中選「允許」。</li><li>把本頁核對碼告訴老師，核准後重新確認狀態，再傳送測試通知。</li></ol></details><details><summary>如何關閉、重新開啟</summary><p>本頁可暫停這台裝置；老師也能關閉整個推播試用。手機「設定」的「通知」中找到山熊聯絡簿，可關閉允許通知、聲音或標記。不同 iOS 版本入口可能不同，會依這次實機補充。</p><p>重新開啟只接收新的通知，不補送停用期間的舊提醒。已交給手機系統的通知可能仍顯示。</p></details><details><summary>沒有收到怎麼辦</summary><p>確認從主畫面圖示開啟、裝置已核准、本頁及手機通知開關都開啟，再檢查網路與專注模式。系統不保證即時顯示，也不會突破靜音設定。</p><p>圖示數字代表通知未讀數；讀取通知不代表完成作業。主動登出會解除這台裝置的通知綁定。手機和 iPad 需要各自開啟通知；其中一台暫停不影響另一台。已讀會共用，其他裝置的圖示數字會在重新開啟聯絡簿或收到下一則通知時更新。</p></details><details><summary>後續通知用途</summary><p>聯絡簿、公告、老師留言／回覆、棒卡審核、補考結果、課後成績、作業催繳，會在手機試用通過後逐項接入與驗收。目前只有測試通知。</p></details></div>';
        dialog.addEventListener('click', event => { const b = event.target.closest('[data-ep]'); if (b) action(b.dataset.ep, b.dataset.id); });
        document.body.appendChild(dialog);
    }
    function render() {
        if (!dialog) return;
        dialog.querySelector('.ep-state').textContent = statusText();
        const count = Number(state && state.approvedDeviceCount) || 0;
        dialog.querySelector('.ep-test-targets').textContent = `目前核准 ${count} 台裝置。測試會送給其中已開啟通知且登入有效的裝置；同一則通知只算一則未讀。`;
        const usable = state && state.mode === 'test_only' && state.ready && capable() && (!ios() || installed());
        dialog.querySelector('[data-ep="enable"]').disabled = busy || !usable || (state.enabled && state.approved);
        dialog.querySelector('[data-ep="pause"]').disabled = busy || !(state && state.enabled);
        dialog.querySelector('[data-ep="test"]').disabled = busy || !usable || Notification.permission !== 'granted' || !(state.enabled && state.approved);
        dialog.querySelector('[data-ep="refresh"]').disabled = busy;
        dialog.querySelector('.ep-log').innerHTML = state && state.items && state.items.length ? state.items.map(i => `<li><span>${escape(i.title)}<small>${escape(new Date(i.createdAt).toLocaleString('zh-TW'))} · ${escape(statuses[i.status] || '待確認')}</small></span><button type="button" data-ep="read" data-id="${escape(i.id)}" ${i.readAt || busy ? 'disabled' : ''}>${i.readAt ? '已讀' : '標示已讀'}</button></li>`).join('') : '<li>尚無測試通知</li>';
    }
    async function api(action, extra = {}) {
        const mine = epoch;
        const result = await timed(env.call({ action, deviceId: binding && binding.deviceId || '', ...extra }));
        if (mine !== epoch) throw new Error('登入身分已變更，請重新開啟通知設定');
        return result;
    }
    async function clearBadge() {
        if (navigator.clearAppBadge) await navigator.clearAppBadge().catch(() => {});
    }
    async function syncBadge(disabled) {
        if (!state || !isId(state.recipient)) return;
        const data = { kind: 'ebook_push_badge', recipient: state.recipient, count: state.count || 0, version: state.version || 0, disabled: !!disabled };
        const reg = registration || ('serviceWorker' in navigator && await navigator.serviceWorker.getRegistration(new URL('./', location.href).href));
        if (reg && reg.active) reg.active.postMessage(data);
        if (disabled || !data.count) await clearBadge();
        else if (navigator.setAppBadge) await navigator.setAppBadge(data.count).catch(() => {});
    }
    async function listen(mine) {
        if (!binding || !state || !state.enabled || !capable()) return;
        const reg = await navigator.serviceWorker.getRegistration(new URL('./', location.href).href);
        if (!reg || mine !== epoch) return;
        const module = await timed(import('./ebook_push_messaging.mjs?v=20261013-pilot1'));
        if (mine !== epoch) return;
        registration = reg; bridge = module;
        await timed(bridge.listen({ firebaseConfig: env.firebaseConfig, onMessage: payload => {
            if (mine === epoch && reg.active) reg.active.postMessage({ kind: 'ebook_push_foreground', payload });
        } }));
        if (mine !== epoch) bridge.disconnect();
    }
    async function refresh() {
        state = await api('status'); refreshAt = Date.now();
        if (!state.eligible) { entry.hidden = true; if (dialog.open) dialog.close(); return; }
        await syncBadge(!state.enabled || state.mode === 'off');
        render();
    }
    async function enable() {
        const mine = epoch, activeEnv = env, publicKey = state.vapidPublicKey;
        const unchanged = () => { if (mine !== epoch) throw new Error('登入身分已變更，請重新開啟通知設定'); };
        if (location.origin !== 'https://www.sciencebear.com.tw') throw new Error('請使用山熊正式網站的主畫面圖示開啟通知');
        if (!env.session.rememberDevice) throw new Error('請重新登入並勾選保持登入，再開啟通知');
        if (!capable() || ios() && !installed()) throw new Error('請先從 iPhone／iPad 主畫面的聯絡簿圖示開啟');
        // 權限要求直接源自按鈕操作，前面不能先 await 網路／SDK 載入。
        const permission = await Notification.requestPermission();
        unchanged();
        if (permission !== 'granted') throw new Error('尚未允許通知，可依下方教學重新開啟');
        registration = await timed(navigator.serviceWorker.register('ebook-push-sw.js?v=20261013-pilot1', { scope: './', updateViaCache: 'none' }));
        await timed(navigator.serviceWorker.ready);
        unchanged();
        bridge = await timed(import('./ebook_push_messaging.mjs?v=20261013-pilot1'));
        unchanged();
        const token = await timed(bridge.connect({ firebaseConfig: activeEnv.firebaseConfig, vapidPublicKey: publicKey, registration,
            onMessage: payload => { if (mine === epoch && registration.active) registration.active.postMessage({ kind: 'ebook_push_foreground', payload }); } }));
        unchanged();
        const result = await api('register', { token });
        saveBinding({ deviceId: result.deviceId, uid: activeEnv.uid, subject: activeEnv.subject }); state = result; await syncBadge(false); render();
    }
    async function unsubscribe() {
        const reg = registration || await navigator.serviceWorker.getRegistration(new URL('./', location.href).href);
        const sub = reg && await reg.pushManager.getSubscription();
        if (sub && !await sub.unsubscribe()) throw new Error('手機尚未完成解除通知');
        if (bridge) bridge.disconnect();
        await syncBadge(true);
        await clearBadge();
    }
    async function action(name, id) {
        if (name === 'close') { dialog.close(); return; }
        if (busy) return;
        const mine = epoch;
        busy = true; dialog.querySelector('.ep-error').textContent = ''; render();
        try {
            if (name === 'enable') await enable();
            if (name === 'refresh') await refresh();
            if (name === 'pause') { state = await api('pause'); await unsubscribe(); render(); }
            if (name === 'read') { await api('read', { notificationId: id }); await refresh(); }
            if (name === 'test') {
                const requestKey = storageKey() + ':pendingTest';
                const requestId = sessionStorage.getItem(requestKey) || crypto.randomUUID();
                sessionStorage.setItem(requestKey, requestId);
                let result;
                try { result = await api('test', { requestId }); }
                catch (error) { if (/invalid-argument|permission-denied|failed-precondition|resource-exhausted/.test(error.code || '')) sessionStorage.removeItem(requestKey); throw error; }
                sessionStorage.removeItem(requestKey);
                dialog.querySelector('.ep-error').textContent = result.duplicate ? '這筆測試已受理，不重複發送。' : '測試已排定，會傳給已核准且有效的裝置。現在可以將手機與 iPad 回主畫面或鎖定。';
                await refresh();
            }
        } catch (error) { if (mine === epoch) dialog.querySelector('.ep-error').textContent = error.message || '操作未完成，請稍後重試'; }
        finally { if (mine === epoch) { busy = false; render(); } }
    }
    async function open(notificationId) {
        if (!env || !entry || entry.hidden) return;
        build(); if (!dialog.open) dialog.showModal();
        await action('refresh');
        if (isId(notificationId)) await action('read', notificationId);
    }
    async function ready(options) {
        const mine = ++epoch; env = options; state = null; binding = null; busy = false;
        if (bridge) bridge.disconnect();
        if (dialog && dialog.open) dialog.close();
        entry = document.getElementById('ebookPushEntry');
        if (!entry) return;
        entry.hidden = true;
        binding = loadBinding();
        if (binding && (binding.uid !== options.uid || binding.subject !== options.subject || options.preview)) {
            // 同一主畫面 App 共用一個 push subscription；切換身分前解除舊裝置。
            try { await timed(unsubscribe()); if (mine !== epoch) return; saveBinding(null); }
            catch (_) { binding = null; return; }
        }
        if (mine !== epoch) return;
        const name = options.session && options.session.studentName;
        if (options.preview || name !== '系統測試生' || !options.uid) return;
        build();
        try {
            await refresh();
            if (mine !== epoch) return;
            entry.hidden = !state.eligible;
            const id = new URL(location.href).searchParams.get('pushNotice') || sessionStorage.getItem(storageKey() + ':click');
            if (state.eligible && isId(id)) {
                sessionStorage.removeItem(storageKey() + ':click');
                const u = new URL(location.href); u.searchParams.delete('pushNotice'); history.replaceState(null, '', u);
                await open(id);
            }
            await listen(mine).catch(() => { if (mine === epoch && dialog) dialog.querySelector('.ep-error').textContent = '前景通知連線暫時失敗，請重新開啟聯絡簿再測試。'; });
        } catch (_) { if (mine === epoch) { entry.hidden = false; state = null; render(); } /* 試用服務失敗不影響原聯絡簿。 */ }
    }
    async function beforeLogout() {
        if (busy) { await root.swalAlert('通知設定處理中', '請等這次操作完成後再登出。', 'info'); return false; }
        if (!env || !binding) { epoch++; if (bridge) bridge.disconnect(); return true; }
        let server = false, local = false;
        try { await api('revoke'); server = true; } catch (_) {}
        try { await timed(unsubscribe()); local = true; } catch (_) {}
        if (!server && !local) { await root.swalAlert('尚未完成通知解除', '請恢復網路後再登出，避免這台裝置繼續接收原身分通知。', 'warning'); return false; }
        saveBinding(null); epoch++; if (dialog && dialog.open) dialog.close(); if (entry) entry.hidden = true;
        return true;
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data || {};
        if (data.kind === 'ebook_push_click' && isId(data.notificationId)) {
            const subject = new URL(location.href).searchParams.get('subject') || 'science';
            sessionStorage.setItem(PREFIX + subject + ':click', data.notificationId);
            if (env && state && state.eligible) { sessionStorage.removeItem(storageKey() + ':click'); open(data.notificationId); }
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && env && state && state.eligible && Date.now() - refreshAt > 30000) refresh().catch(() => {});
    });
    root.EbookPush = { ready, open, beforeLogout };
})(window);
