(function(root) {
    'use strict';
    const PREFIX = 'sciencebear.ebook.push.v1:';
    const requiredKinds = new Set(['bulletin', 'homework']);
    const isId = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
    let env = null, state = null, registration = null, bridge = null, busy = false, epoch = 0;
    let dialog, entry, binding = null, pendingNotice = '', opening = false, badgeSync = 0;
    let observer = null, observeTimer = null, dwellTimer = null, visibleSince = new Map(), reading = new Set(), pendingReads = new Set();
    function escape(text) { return String(text || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function storageKey() { return PREFIX + env.subject; }
    function loadBinding() { try { return JSON.parse(localStorage.getItem(PREFIX + 'device') || 'null'); } catch (_) { return null; } }
    function saveBinding(value) { binding = value; try { if (value) localStorage.setItem(PREFIX + 'device', JSON.stringify(value)); else localStorage.removeItem(PREFIX + 'device'); } catch (_) {} }
    function applyState(next) {
        // 回前景的較舊 status 不得蓋回剛完成的已讀計數。
        if (state && next.recipient === state.recipient && next.version < state.version) next = {...next, count:state.count, version:state.version, items:state.items};
        state = next;
    }
    function readKey() { return PREFIX + 'read:' + env.subject + ':' + env.uid; }
    function savePendingReads() { try { localStorage.setItem(readKey(), JSON.stringify([...pendingReads].slice(0, 40))); } catch (_) {} }
    function rememberNotice(id) {
        pendingNotice = id;
        try { if (id) sessionStorage.setItem(storageKey() + ':click', id); else sessionStorage.removeItem(storageKey() + ':click'); } catch (_) {}
    }
    async function timed(work) {
        let timer;
        try { return await Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('通知連線逾時，請重新確認狀態後再試')), 20000); })]); }
        finally { clearTimeout(timer); }
    }
    function capable() { return root.isSecureContext && 'serviceWorker' in navigator && 'Notification' in root && 'PushManager' in root; }
    function installed() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
    function ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; }
    function platform() { return ios() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'other'; }
    function inApp() { return /Line\//i.test(navigator.userAgent); }
    function permission() { return 'Notification' in root ? Notification.permission : 'unsupported'; }
    function deviceState() {
        if (!state) return { title:'暫時無法確認', detail:'請稍後按「重新確認狀態」。', tone:'waiting' };
        if (state.mode !== 'test_only') return { title:'通知服務暫停中', detail:'聯絡簿與 LINE 仍可照常使用。', tone:'waiting' };
        if (!state.ready) return { title:'通知準備中', detail:'老師完成設定後，就能開啟通知。', tone:'waiting' };
        if (inApp()) return { title:'請用瀏覽器開啟', detail:ios() ? '請改用 Safari，加入主畫面後開啟。' : '請從 LINE 選單改用 Chrome 開啟聯絡簿。', tone:'waiting' };
        if (ios() && !installed()) return { title:'先加入主畫面', detail:'從主畫面的聯絡簿圖示開啟，就能設定通知。', tone:'waiting' };
        if (!capable()) return { title:'請更換瀏覽器', detail:platform() === 'android' ? '請使用最新版 Chrome 開啟聯絡簿。' : '請查看下方教學，確認裝置與瀏覽器支援通知。', tone:'waiting' };
        if (permission() === 'denied') return { title:'通知已被手機關閉', detail:'依下方教學開啟權限，再回來確認狀態。', tone:'waiting' };
        if (!state.registered) return { title:'尚未開啟通知', detail:'開啟後，有新消息就能收到提醒。', tone:'off' };
        if (!state.approved) return { title:'請重新開啟通知', detail:'按「開啟通知」完成連線，就能直接測試。', tone:'waiting' };
        if (!state.enabled) return { title:'通知已暫停', detail:'只暫停這台裝置，其他裝置不受影響。', tone:'off' };
        if (permission() !== 'granted') return { title:'請允許通知', detail:'再按一次開啟，並在手機提示中選「允許」。', tone:'waiting' };
        return { title:'通知已開啟', detail:'有新消息時，會在這台裝置提醒你。', tone:'on' };
    }
    const statuses = { queued: '等待發送', processing: '處理中', accepted: '已送出', partial: '部分裝置已送出', canceled: '已取消', expired: '已逾時', failed: '請重新開啟通知', uncertain: '送出結果待確認' };
    let guidePlatform = platform() === 'android' ? 'android' : 'ios';
    const guides = {
        ios: '<ol><li>用 Safari 開啟聯絡簿，按分享，選「加入主畫面」。</li><li>從主畫面圖示登入，勾選「保持登入」。</li><li>按「開啟通知」，在手機提示中選「允許」。</li></ol><p class="ep-note">需要 iOS／iPadOS 16.4 或以上。</p><h4>關閉或重新開啟</h4><p>可在本頁暫停這台裝置。若手機已封鎖通知，到「設定 → 通知 → 山熊聯絡簿」調整「允許通知」，再回本頁重新確認狀態。</p>',
        android: '<ol><li>用 Chrome 開啟聯絡簿，避免使用 LINE 內建瀏覽器或無痕模式。</li><li>登入並勾選「保持登入」。</li><li>按「開啟通知」，在手機提示中選「允許」。</li></ol><p class="ep-note">也可以從 Chrome 選單將聯絡簿加入主畫面，之後更方便開啟。</p><h4>關閉或重新開啟</h4><p>可在本頁暫停這台裝置。若網站通知被封鎖，用 Chrome 開啟聯絡簿，按網址列旁的「頁面資訊 → 權限 → 通知」重新允許。</p><p>也請確認手機「設定 → 應用程式 → Chrome → 通知」已開啟；若已安裝聯絡簿，另檢查該 App 的通知設定。各品牌手機名稱可能略有不同。</p>'
    };
    function showGuide() {
        dialog.querySelector('.ep-guide-content').innerHTML = guides[guidePlatform];
        dialog.querySelectorAll('[data-ep="guide"]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === guidePlatform)));
    }
    function build() {
        if (dialog) return;
        dialog = document.createElement('dialog'); dialog.className = 'ep-dialog'; dialog.setAttribute('aria-labelledby', 'ep-title');
        dialog.innerHTML = `
            <header><div><p class="ep-eyebrow">山熊聯絡簿</p><h2 id="ep-title">通知設定</h2></div><button type="button" class="ep-close" data-ep="close" aria-label="關閉通知設定">×</button></header>
            <div class="ep-body">
                <section class="ep-device" aria-label="這台裝置的通知">
                    <div class="ep-device-row"><div class="ep-state" role="status"><span class="ep-device-label">這台裝置</span><strong class="ep-state-title"></strong></div>
                        <button type="button" class="ep-primary" data-ep="enable">開啟通知</button><button type="button" data-ep="pause">暫停通知</button><button type="button" data-ep="help">查看教學</button>
                    </div><p class="ep-state-detail"></p>
                </section>
                <p class="ep-error" role="alert"></p>
                <section class="ep-types" aria-labelledby="ep-types-title"><div class="ep-section-heading"><h3 id="ep-types-title">通知項目</h3><span class="ep-save" role="status" aria-live="polite"></span></div>
                    <p class="ep-note">公告與作業催繳為必接收，其餘可自選。設定適用同一帳號的所有裝置。</p><div class="ep-preferences"></div>
                </section>
                <p class="ep-reassurance">可暫停這台裝置的通知，聯絡簿與 LINE 照常使用。</p>
                <details class="ep-guide"><summary>開啟／關閉通知教學</summary><div class="ep-guide-tabs" aria-label="選擇裝置教學"><button type="button" data-ep="guide" data-id="ios" aria-pressed="false">iPhone／iPad</button><button type="button" data-ep="guide" data-id="android" aria-pressed="false">Android</button></div><div class="ep-guide-content"></div><button type="button" data-ep="refresh">重新確認狀態</button></details>
                <details class="ep-recent"><summary>最近通知 <span class="ep-unread"></span></summary><ul class="ep-log"></ul></details>
                <details class="ep-troubleshoot"><summary>沒有收到通知？</summary><p>確認已允許通知、登入時勾選「保持登入」，並檢查網路、勿擾／專注模式及手機的省電設定。</p><p>每台手機或平板都需要各自允許；登出會解除該裝置的通知。重新開啟只接收新消息，不補送暫停期間的通知。</p><p>已讀狀態共用；其他裝置的圖示標記會在開啟聯絡簿或收到下一則通知時更新。Android 的圖示圓點或數字依手機而異。看過提醒不代表完成作業。</p></details>
                <details class="ep-pilot" hidden><summary>測試工具 <span>僅供系統測試生</span></summary><p class="ep-test-device ep-note"></p><p class="ep-test-targets ep-note"></p><button type="button" data-ep="test">20 秒後傳送測試通知</button><p class="ep-note">任一台按一次，再將手機或平板回主畫面或鎖定。最多每分鐘一次；服務接受不代表裝置已顯示。</p></details>
            </div>`;
        dialog.addEventListener('click', event => { const b = event.target.closest('[data-ep]'); if (b) action(b.dataset.ep, b.dataset.id); });
        dialog.addEventListener('change', event => { const input = event.target.closest('[data-ep-preference]'); if(input) action('preferences', input.dataset.epPreference, input.checked); });
        document.body.appendChild(dialog);
        showGuide();
    }
    function render() {
        if (!dialog) return;
        const info = deviceState(), denied = permission() === 'denied';
        const usable = state && state.mode === 'test_only' && state.ready && capable() && !inApp() && (!ios() || installed());
        const on = info.tone === 'on';
        const needsHelp = !capable() || inApp() || ios() && !installed() || denied;
        dialog.querySelector('.ep-device').dataset.tone = info.tone;
        dialog.querySelector('.ep-state-title').textContent = info.title;
        dialog.querySelector('.ep-state-detail').textContent = info.detail;
        const enableButton = dialog.querySelector('[data-ep="enable"]'), pauseButton = dialog.querySelector('[data-ep="pause"]'), helpButton = dialog.querySelector('[data-ep="help"]');
        enableButton.hidden = on || needsHelp;
        enableButton.disabled = busy || !usable;
        pauseButton.hidden = !on;
        pauseButton.disabled = busy;
        helpButton.hidden = !needsHelp || on;
        const pilot = state && state.mode === 'test_only' && env && env.session && env.session.studentName === '系統測試生';
        dialog.querySelector('.ep-pilot').hidden = !pilot;
        const code = '測試期間僅指定的系統測試生可使用。開啟通知後即可測試，不需審核碼；一般家長尚未開放。';
        dialog.querySelector('.ep-test-device').textContent = code;
        dialog.querySelector('.ep-test-targets').textContent = `目前已連結 ${Number(state && state.approvedDeviceCount) || 0} 台裝置。測試送至其中已開啟且登入有效的裝置；同一則只算一則未讀。`;
        dialog.querySelector('[data-ep="test"]').disabled = busy || !usable || !on;
        dialog.querySelector('[data-ep="refresh"]').disabled = busy;
        const preferences = dialog.querySelector('.ep-preferences');
        const kinds = state && state.businessEnabled ? Object.entries(state.kinds || {}).sort(([a],[b]) => Number(requiredKinds.has(b)) - Number(requiredKinds.has(a))) : [];
        const signature = JSON.stringify(kinds);
        if (preferences.dataset.signature !== signature) {
            preferences.dataset.signature = signature;
            preferences.innerHTML = kinds.length ? kinds.map(([kind,label]) => `<label class="ep-preference-row${requiredKinds.has(kind) ? ' ep-required-row' : ''}"><span>${escape(label)}${kind === 'bulletin' ? '<small>包含緊急公告</small>' : ''}</span>${requiredKinds.has(kind) ? '<span class="ep-fixed">✓ 必接收</span>' : `<span class="ep-switch"><input type="checkbox" role="switch" data-ep-preference="${escape(kind)}"><span class="ep-switch-track" aria-hidden="true"></span></span>`}</label>`).join('') : '<p class="ep-note">通知類型尚未開放。</p>';
        }
        preferences.querySelectorAll('input').forEach(input => { if (!busy) input.checked = !state.preferences || state.preferences[input.dataset.epPreference] !== false; input.disabled = busy; });
        dialog.querySelector('.ep-unread').textContent = state && state.count ? `${state.count} 則未讀` : '';
        dialog.querySelector('.ep-log').innerHTML = state && state.items && state.items.length ? state.items.map(i => `<li><span>${escape(i.title)}<small>${escape(new Date(i.createdAt).toLocaleString('zh-TW'))} · ${escape(statuses[i.status] || '待確認')}</small></span><div class="ep-log-actions"><button type="button" data-ep="read" data-id="${escape(i.id)}" ${i.readAt || busy ? 'disabled' : ''}>${i.readAt ? '已讀' : '標示已讀'}</button>${i.target ? `<button type="button" data-ep="view" data-id="${escape(i.id)}" ${busy ? 'disabled' : ''}>查看</button>` : ''}</div></li>`).join('') : '<li class="ep-empty">目前沒有通知</li>';
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
        const revision = ++badgeSync, mine = epoch;
        const data = { kind: 'ebook_push_badge', recipient: state.recipient, count: state.count || 0, version: state.version || 0, disabled: !!disabled };
        const reg = registration || ('serviceWorker' in navigator && await navigator.serviceWorker.getRegistration(new URL('./', location.href).href));
        if (revision !== badgeSync || mine !== epoch) return;
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
        reg.update().catch(() => {});
        await timed(bridge.listen({ firebaseConfig: env.firebaseConfig, onMessage: payload => {
            if (mine === epoch && reg.active) reg.active.postMessage({ kind: 'ebook_push_foreground', payload });
            if (mine === epoch && !document.hidden) refresh().catch(() => {});
        } }));
        if (mine !== epoch) bridge.disconnect();
    }
    async function refresh() {
        applyState(await api('status'));
        if (!state.eligible) { entry.hidden = true; if (dialog.open) dialog.close(); return; }
        await syncBadge(!state.enabled || state.mode === 'off');
        render();
        scheduleReadCheck();
    }
    async function readNotice(id) {
        if (reading.has(id)) return false;
        const mine = epoch;
        reading.add(id); pendingReads.add(id); savePendingReads();
        try {
            const result = await api('read', { notificationId:id });
            if (state) {
                const newer = result.version >= state.version;
                applyState({...state, count:newer ? result.count : state.count, version:newer ? result.version : state.version,
                    items:(state.items || []).map(item => item.id === id ? {...item, readAt:Date.now()} : item)});
            }
            pendingReads.delete(id); savePendingReads();
            if (pendingNotice === id) {
                rememberNotice('');
                const u = new URL(location.href); u.searchParams.delete('pushNotice'); history.replaceState(null, '', u);
            }
            await syncBadge(!state.enabled || state.mode === 'off');
            render();
            return true;
        } finally { if (mine === epoch) reading.delete(id); }
    }
    function scheduleReadCheck() {
        if (observeTimer) return;
        observeTimer = setTimeout(() => { observeTimer = null; checkVisibleReads(); }, 180);
    }
    function checkVisibleReads() {
        clearTimeout(dwellTimer); dwellTimer = null;
        if (!env || !state || !state.eligible || busy || opening || document.hidden || !env.findTarget || !env.isReadable) { visibleSince.clear(); return; }
        let waiting = false;
        for (const item of state.items || []) {
            if (item.readAt || !item.target || reading.has(item.id) || pendingReads.has(item.id) || ['canceled','expired','failed'].includes(item.status)) continue;
            const node = env.findTarget(item.target);
            if (!env.isReadable(node)) { visibleSince.delete(item.id); continue; }
            const since = visibleSince.get(item.id) || Date.now(); visibleSince.set(item.id, since);
            if (Date.now() - since < 900) { waiting = true; continue; }
            readNotice(item.id).catch(() => { /* 已看見的通知保留待同步，恢復網路或回前景再送。 */ });
        }
        if (waiting) dwellTimer = setTimeout(checkVisibleReads, 920);
    }
    function watchReading() {
        if (observer) observer.disconnect();
        const host = document.getElementById('main-screen');
        if (!host || !root.MutationObserver) return;
        observer = new MutationObserver(scheduleReadCheck);
        observer.observe(host, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','style','class','aria-expanded']});
        const popup = document.getElementById('emergencyModal');
        if (popup && !host.contains(popup)) observer.observe(popup, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','style','class']});
        scheduleReadCheck();
    }
    async function resume() {
        if (!env || !state || !state.eligible || document.hidden) return;
        try {
            await refresh();
            for (const id of [...pendingReads]) {
                if (!(state.items || []).some(i => i.id === id && !i.readAt)) { pendingReads.delete(id); savePendingReads(); continue; }
                await readNotice(id);
            }
            await drainNotice();
        } catch (_) { /* 狀態失敗不清掉未同步的已讀或點擊。 */ }
    }
    async function enable() {
        const mine = epoch, activeEnv = env, publicKey = state.vapidPublicKey;
        const unchanged = () => { if (mine !== epoch) throw new Error('登入身分已變更，請重新開啟通知設定'); };
        if (location.origin !== 'https://www.sciencebear.com.tw') throw new Error('請使用山熊正式網站的主畫面圖示開啟通知');
        if (!env.session.rememberDevice) throw new Error('請重新登入並勾選保持登入，再開啟通知');
        if (!capable() || inApp() || ios() && !installed()) throw new Error(deviceState().detail);
        // 權限要求直接源自按鈕操作，前面不能先 await 網路／SDK 載入。
        const permission = await Notification.requestPermission();
        unchanged();
        if (permission !== 'granted') throw new Error('尚未允許通知，可依下方教學重新開啟');
        registration = await timed(navigator.serviceWorker.register('ebook-push-sw.js?v=20261014-navigation1', { scope: './', updateViaCache: 'none' }));
        await timed(navigator.serviceWorker.ready);
        unchanged();
        bridge = await timed(import('./ebook_push_messaging.mjs?v=20261013-pilot1'));
        unchanged();
        const token = await timed(bridge.connect({ firebaseConfig: activeEnv.firebaseConfig, vapidPublicKey: publicKey, registration,
            onMessage: payload => {
                if (mine === epoch && registration.active) registration.active.postMessage({ kind: 'ebook_push_foreground', payload });
                if (mine === epoch && !document.hidden) refresh().catch(() => {});
            } }));
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
    async function action(name, id, value) {
        if (name === 'close') { dialog.close(); scheduleReadCheck(); return; }
        if (name === 'guide' && guides[id]) { guidePlatform = id; showGuide(); return; }
        if (name === 'help') { const guide = dialog.querySelector('.ep-guide'); guide.open = true; guide.querySelector('summary').focus(); guide.scrollIntoView({block:'nearest'}); return; }
        if (busy || name === 'preferences' && requiredKinds.has(id)) return;
        const mine = epoch, focusedPreference = name === 'preferences' ? document.activeElement : null;
        busy = true; dialog.querySelector('.ep-error').textContent = ''; render();
        try {
            if (name === 'preferences') {
                dialog.querySelector('.ep-save').textContent = '儲存中…';
                state = await api('preferences', {preferences:{[id]:value}});
                dialog.querySelector('.ep-save').textContent = '已儲存';
                render();
            }
            if (name === 'view') await viewNotice(id);
            if (name === 'enable') await enable();
            if (name === 'refresh') await refresh();
            if (name === 'pause') { state = await api('pause'); await unsubscribe(); render(); }
            if (name === 'read') await readNotice(id);
            if (name === 'test') {
                const requestKey = storageKey() + ':pendingTest';
                const requestId = sessionStorage.getItem(requestKey) || crypto.randomUUID();
                sessionStorage.setItem(requestKey, requestId);
                let result;
                try { result = await api('test', { requestId }); }
                catch (error) { if (/invalid-argument|permission-denied|failed-precondition|resource-exhausted/.test(error.code || '')) sessionStorage.removeItem(requestKey); throw error; }
                sessionStorage.removeItem(requestKey);
                dialog.querySelector('.ep-error').textContent = result.duplicate ? '這筆測試已受理，不重複發送。' : '測試已排定，會傳給已開啟且登入有效的裝置。現在可以將手機或平板回主畫面或鎖定。';
                await refresh();
            }
            return true;
        } catch (error) { if (mine === epoch) { if (name === 'preferences') dialog.querySelector('.ep-save').textContent = '未儲存'; if (!dialog.open) dialog.showModal(); dialog.querySelector('.ep-error').textContent = error.message || '操作未完成，請稍後重試'; } return false; }
        finally { if (mine === epoch) { busy = false; render(); if (focusedPreference && focusedPreference.isConnected && dialog.open && document.activeElement === document.body) focusedPreference.focus({preventScroll:true}); scheduleReadCheck(); if (!opening && pendingNotice) drainNotice(); } }
    }
    async function viewNotice(id) {
        const mine = epoch;
        const result = await api('open', {notificationId:id});
        if (result.type !== 'test') {
            // 先關掉對話框再捲動，避免 iOS 對話框焦點還原把位置拉回頁首。
            if(dialog.open) dialog.close();
            if (!env.navigate || !await env.navigate(result.target, () => mine === epoch)) throw new Error('目前畫面尚未載入這筆內容，請重新整理聯絡簿後再查看。');
        }
        if (mine !== epoch) return;
        await readNotice(id);
    }
    async function drainNotice() {
        if (opening || busy || !pendingNotice || !state || !state.eligible) return;
        const id = pendingNotice, mine = epoch;
        opening = true;
        try {
            const success = await action('view', id);
            if (mine !== epoch) return;
            if (success && pendingNotice === id) {
                rememberNotice('');
                const u = new URL(location.href); u.searchParams.delete('pushNotice'); history.replaceState(null, '', u);
            }
        } finally {
            if (mine === epoch) { opening = false; scheduleReadCheck(); if (pendingNotice && pendingNotice !== id) drainNotice(); }
        }
    }
    async function open(notificationId) {
        if (isId(notificationId) && env) rememberNotice(notificationId);
        if (!env || !entry || entry.hidden) return;
        build(); if (!dialog.open) dialog.showModal();
        if (isId(notificationId)) return drainNotice();
        await action('refresh');
    }
    async function ready(options) {
        const mine = ++epoch; env = options; state = null; binding = null; busy = false;
        pendingNotice = ''; opening = false; reading = new Set(); pendingReads = new Set(); visibleSince.clear();
        clearTimeout(observeTimer); observeTimer = null; clearTimeout(dwellTimer); dwellTimer = null;
        if (observer) observer.disconnect();
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
        guidePlatform = platform() === 'android' ? 'android' : 'ios'; showGuide();
        dialog.querySelector('.ep-save').textContent = '';
        dialog.querySelectorAll('details').forEach(item => { item.open = false; });
        try { pendingReads = new Set((JSON.parse(localStorage.getItem(readKey()) || '[]') || []).filter(isId).slice(0,40)); } catch (_) {}
        try {
            await refresh();
            if (mine !== epoch) return;
            entry.hidden = !state.eligible;
            const id = new URL(location.href).searchParams.get('pushNotice') || sessionStorage.getItem(storageKey() + ':click');
            if (state.eligible && isId(id)) {
                await open(id);
            }
            watchReading();
            for (const id of [...pendingReads]) if ((state.items || []).some(i => i.id === id && !i.readAt)) await readNotice(id).catch(() => {});
            await listen(mine).catch(() => { if (mine === epoch && dialog) dialog.querySelector('.ep-error').textContent = '前景通知連線暫時失敗，請重新開啟聯絡簿再測試。'; });
        } catch (_) { if (mine === epoch) { entry.hidden = false; state = null; render(); } /* 試用服務失敗不影響原聯絡簿。 */ }
    }
    async function beforeLogout() {
        if (busy) { await root.swalAlert('通知設定處理中', '請等這次操作完成後再登出。', 'info'); return false; }
        if (!env || !binding) { epoch++; if (bridge) bridge.disconnect(); if (observer) observer.disconnect(); env = null; state = null; return true; }
        let server = false, local = false;
        try { await api('revoke'); server = true; } catch (_) {}
        try { await timed(unsubscribe()); local = true; } catch (_) {}
        if (!server && !local) { await root.swalAlert('尚未完成通知解除', '請恢復網路後再登出，避免這台裝置繼續接收原身分通知。', 'warning'); return false; }
        saveBinding(null); epoch++; if (dialog && dialog.open) dialog.close(); if (entry) entry.hidden = true;
        if (observer) observer.disconnect(); env = null; state = null;
        return true;
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', event => {
        const data = event.data || {};
        if (data.kind === 'ebook_push_click' && isId(data.notificationId)) {
            const subject = new URL(location.href).searchParams.get('subject') || 'science';
            sessionStorage.setItem(PREFIX + subject + ':click', data.notificationId);
            if (event.ports && event.ports[0]) event.ports[0].postMessage({received:true});
            if (env && state && state.eligible) open(data.notificationId);
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) visibleSince.clear();
        else if (env && state && state.eligible) resume();
        scheduleReadCheck();
    });
    root.addEventListener('online', resume);
    root.addEventListener('scroll', scheduleReadCheck, {passive:true});
    root.addEventListener('resize', scheduleReadCheck, {passive:true});
    root.EbookPush = { ready, open, beforeLogout };
})(window);
