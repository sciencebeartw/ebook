/* 山熊通知試用 SW：僅推播／點擊／標記，沒有 fetch handler 或離線資料快取。 */
'use strict';
const PUSH_VERSION = '20261014-navigation1';
const validId = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function pushData(data) {
    if (!data || !['ebook_push_test','ebook_push_event'].includes(data.kind) || !validId(data.notificationId) || !validId(data.recipient) || !['science', 'math'].includes(data.subject)) return null;
    if (data.kind === 'ebook_push_event' && (!['post','bulletin','message','sticker','makeup','grade','homework'].includes(data.type) || typeof data.title !== 'string' || data.title.length > 80)) return null;
    const count = Number(data.count), version = Number(data.version);
    if (!Number.isSafeInteger(count) || count < 0 || count > 40 || !Number.isSafeInteger(version) || version < 0) return null;
    return { ...data, count, version };
}
function stateTransaction(recipient, update) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open('sciencebear-ebook-push-v1', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('state');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result; const tx = db.transaction('state', 'readwrite'); const store = tx.objectStore('state');
            let result; const req = store.get(recipient);
            req.onsuccess = () => { result = update(req.result || { version: 0, count: 0 }); store.put(result, recipient); };
            tx.oncomplete = () => { db.close(); resolve(result); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        };
    });
}
async function badge(data, disabled = false, authoritative = false) {
    const result = await stateTransaction(data.recipient, old => disabled ? { version: Math.max(old.version, data.version), disabled: true, count: 0 } :
        data.version >= old.version ? { version: data.version, count: data.count, disabled: authoritative ? false : old.disabled === true } : old);
    if (result.disabled || result.count === 0) { if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); }
    else if (self.navigator.setAppBadge) await self.navigator.setAppBadge(result.count);
}
async function present(raw) {
    const data = pushData(raw);
    if (!data) return;
    const url = new URL('index.html', self.registration.scope);
    url.searchParams.set('subject', data.subject); url.searchParams.set('pushNotice', data.notificationId);
    // FCM 僅 data payload，此處是唯一背景顯示點；同事件用固定 tag 取代、不再次提醒。
    await self.registration.showNotification(data.kind === 'ebook_push_event' ? data.title : '手機推播測試', {
        body: data.kind === 'ebook_push_event' ? '請開啟山熊聯絡簿查看最新內容。' : '這是一則測試通知，點開可確認接收與未讀標記。',
        icon: new URL('ebook-icon-192.png', self.registration.scope).href,
        tag: `ebook-${data.notificationId}`, renotify: false,
        data: { url: url.href, notificationId: data.notificationId, subject: data.subject },
    });
    try { await badge(data); } catch (_) { /* 不支援標記時，通知仍正常顯示。 */ }
}
// 自訂 click 必須在載入 FCM 前註冊，防止預設 handler 接手。
self.addEventListener('notificationclick', event => {
    const data = event.notification.data || {}; event.notification.close();
    if (!validId(data.notificationId) || !['science', 'math'].includes(data.subject)) return;
    event.waitUntil((async () => {
        const url = new URL('index.html', self.registration.scope);
        url.searchParams.set('subject', data.subject); url.searchParams.set('pushNotice', data.notificationId);
        const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = all.find(c => {
            const u = new URL(c.url);
            return u.origin === url.origin && [new URL(self.registration.scope).pathname, url.pathname].includes(u.pathname) && (u.searchParams.get('subject') || 'science') === data.subject;
        });
        if (existing) {
            // 頁面剛啟動時可能還沒掛好 message listener；收到確認才只 focus。
            const received = await new Promise(resolve => {
                const channel = new MessageChannel();
                const finish = value => { clearTimeout(timer); channel.port1.close(); resolve(value); };
                const timer = setTimeout(() => finish(false), 1200);
                channel.port1.onmessage = e => finish(e.data && e.data.received === true);
                try { existing.postMessage({ kind: 'ebook_push_click', notificationId: data.notificationId }, [channel.port2]); }
                catch (_) { finish(false); }
            });
            if (received) return existing.focus();
            // 未被接住的點擊放進 URL，讓登入／冷啟動完成後還能接續。
            if (existing.navigate) {
                const navigated = await existing.navigate(url.href).catch(() => null);
                if (navigated) return navigated.focus();
            }
        }
        return clients.openWindow(url.href);
    })());
});
self.addEventListener('message', event => {
    // 只接受本 scope 同源頁面的請求；不接受跨網域視窗或外部任意 URL。
    if (!event.source || !event.source.url || !event.source.url.startsWith(self.registration.scope)) return;
    const data = event.data || {};
    if (data.kind === 'ebook_push_foreground') event.waitUntil(present(data.payload));
    if (data.kind === 'ebook_push_badge' && validId(data.recipient) && Number.isSafeInteger(data.count) && data.count >= 0 && data.count <= 40 && Number.isSafeInteger(data.version)) {
        event.waitUntil(badge(data, data.disabled === true, true).catch(() => {}));
    }
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');
importScripts('./firebase-config.js');
firebase.initializeApp(firebaseConfig);
firebase.messaging().onBackgroundMessage(payload => present(payload.data));
