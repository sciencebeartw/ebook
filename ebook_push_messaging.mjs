// 與現有全域 Firebase 8 的 Auth / named app 隔離；固定相容的 token API 版本。
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getMessaging, getToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js';
let messaging, stop;
export async function listen(options) {
    if (!await isSupported()) throw new Error('此瀏覽器目前不支援手機通知，請從 iPhone 主畫面開啟聯絡簿');
    const app = getApps().find(a => a.name === 'ebook-push-transport') || initializeApp(options.firebaseConfig, 'ebook-push-transport');
    messaging = getMessaging(app);
    if (stop) stop();
    stop = onMessage(messaging, payload => options.onMessage(payload.data));
}
export async function connect(options) {
    await listen(options);
    return getToken(messaging, { vapidKey: options.vapidPublicKey, serviceWorkerRegistration: options.registration });
}
export function disconnect() { if (stop) stop(); stop = null; }
