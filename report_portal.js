/* global firebase, firebaseConfig */
(function () {
    'use strict';
    const app = firebase.initializeApp(firebaseConfig, 'report-portal-v1');
    const auth = app.auth(), functions = app.functions();
    const $ = id => document.getElementById(id);
    const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const formatDate = n => n ? new Date(n).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '';
    let items = [], identityKey = '', loading = false, submitting = false, timer = null, epoch = 0;
    function message(text) { $('rp-message').textContent = text; }
    function draftKey(item) { return `report-draft:${identityKey}:${item.teacherKey}:${item.className}:${item.examId}`; }
    function draft(item, value) {
        try { const k = draftKey(item); if (value === null) localStorage.removeItem(k); else if (value !== undefined) localStorage.setItem(k, value); else return localStorage.getItem(k) || ''; } catch (_) { /* 私密瀏覽模式仍可回報 */ }
        return '';
    }
    async function call(action, value = {}) { return (await functions.httpsCallable('runReportPortalStudentAction')({ action, ...value })).data; }
    function safeLink(url, label) {
        if (!url || !/^https:\/\/firebasestorage\.googleapis\.com\//.test(url)) return '';
        return `<a class="rp-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    function render() {
        $('rp-papers').innerHTML = items.length ? items.map((a, i) => {
            const r = a.report, pending = r && !['completed', 'needs_attention'].includes(r.status);
            const expired = a.dueAt && Date.now() > a.dueAt;
            const status = r ? `<div class="rp-result ${r.status === 'completed' ? '' : 'rp-wait'}"><div>已回報 <strong>${escape(r.score)}</strong> 分</div><div>${r.status === 'completed' ? '成績登記完成' : r.status === 'needs_attention' ? '回報已保留，登記需要老師協助。' : '已收到，正在背景登記。可以離開本頁。'}</div><small>${formatDate(r.receivedAt)}</small></div>` :
                expired ? '<p class="rp-result rp-wait">回報期限已過，請聯絡老師。</p>' : `<form class="rp-score" data-index="${i}"><label>我的分數（滿分 ${escape(a.maxScore)}）<input name="score" type="number" inputmode="decimal" min="0" max="${escape(a.maxScore)}" step="any" required value="${escape(draft(a))}"></label><button type="submit">送出分數</button></form><p class="rp-muted">送出後，看到「已收到」即可離開。${draft(a) ? '有尚未確認送達的分數，請確認後送出。' : ''}</p>`;
            return `<article class="rp-card" data-paper="${escape(a.assignmentId)}"><div class="rp-meta">${escape(a.className)} · ${escape(a.date)}</div><h2>${escape(a.title)}</h2>${a.dueAt ? `<div class="rp-meta">回報期限：${formatDate(a.dueAt)}</div>` : ''}<div class="rp-actions">${safeLink(a.questionUrl, '開啟考卷')}</div>${a.answerReady ? (a.answerText || a.answerUrl ? `<details><summary>查看答案</summary>${a.answerText ? `<div class="rp-answer">${escape(a.answerText)}</div>` : ''}${safeLink(a.answerUrl, '開啟答案 PDF')}</details>` : '') : `<p class="rp-muted">答案將於 ${formatDate(a.answerOpenAt)} 開放</p>`}<hr style="border:0;border-top:1px solid #e4ebe6;margin:18px 0">${status}${r ? '<p class="rp-muted">需要更正分數時，請聯絡老師。</p>' : ''}${pending ? '<span class="rp-meta">重新開啟本頁可查詢登記結果。</span>' : ''}</article>`;
        }).join('') : '<div class="rp-card">目前沒有開放的考卷或作業。</div>';
    }
    function schedule() {
        clearTimeout(timer);
        if (!document.hidden && items.some(a => a.report && !['completed', 'needs_attention'].includes(a.report.status))) timer = setTimeout(() => {
            if (document.activeElement?.closest('form[data-index]')) schedule(); else load();
        }, 10000);
    }
    async function load() {
        if (!auth.currentUser || loading || submitting) return;
        const generation = epoch; loading = true;
        try {
            const result = await call('list');
            if (generation !== epoch || !auth.currentUser) return;
            items = result.items; identityKey = result.identityKey;
            items.forEach(a => { if (a.report) draft(a, null); });
            $('rp-name').textContent = `${result.name}，你好`;
            render(); message('');
        } catch (e) {
            message(e.message || '暫時無法載入，請重新整理。');
            if (e.code === 'functions/unauthenticated') await auth.signOut();
        }
        finally { loading = false; schedule(); }
    }
    $('rp-login').addEventListener('submit', async e => {
        e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button'); button.disabled = true; message('正在登入…');
        try {
            const remember = form.elements.remember.checked;
            await auth.setPersistence(remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
            const result = (await functions.httpsCallable('createReportPortalSession')({ teacherKey: 'miaw', name: form.elements.name.value.trim(), phone: form.elements.phone.value, remember })).data;
            form.elements.phone.value = ''; await auth.signInWithCustomToken(result.token);
        } catch (error) { message(error.message || '登入失敗，請稍後再試。'); }
        finally { button.disabled = false; }
    });
    $('rp-papers').addEventListener('input', e => { const form = e.target.closest('form[data-index]'); if (form) draft(items[Number(form.dataset.index)], e.target.value); });
    $('rp-papers').addEventListener('submit', async e => {
        e.preventDefault(); if (submitting) return;
        const form = e.target, a = items[Number(form.dataset.index)], score = form.elements.score.value, button = form.querySelector('button');
        if (!form.reportValidity()) return;
        draft(a, score); submitting = true; button.disabled = true; button.textContent = '正在送出…'; message('正在傳送，請等候「已收到」。');
        try {
            const result = await call('submit', { teacherKey: a.teacherKey, className: a.className, assignmentId: a.assignmentId, score });
            a.report = result.report; draft(a, null); render(); message('已收到回報，可以離開本頁。');
        } catch (error) { message('尚未確認送達。請重新整理查詢，分數草稿已保留；不要另外建立新的回報。'); button.disabled = false; button.textContent = '再次確認送出'; }
        finally { submitting = false; schedule(); }
    });
    $('rp-refresh').onclick = load;
    $('rp-logout').onclick = async () => {
        if (submitting) { message('請先等候本次回報接收結果。'); return; }
        epoch++; clearTimeout(timer);
        try { await call('logout'); } catch (_) { /* 本機仍登出 */ }
        await auth.signOut(); items = []; $('rp-papers').innerHTML = ''; message('已登出。');
    };
    auth.onAuthStateChanged(user => { document.body.classList.toggle('rp-signed-in', !!user); epoch++; $('rp-login').hidden = !!user; $('rp-content').hidden = !user; if (user) load(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else load(); });
}());
