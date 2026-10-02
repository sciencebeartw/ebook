(function(root) {
    'use strict';
    var view = root.ResourceCatalogView;
    var generation = 0, request = null, bundles = [], selected = null, offset = 0;
    var loadedAt = 0, timer = null, busy = false, lastDay = '', nextOpenAt = 0, boundaryTimer = null;
    function el(id) { return document.getElementById(id); }
    function now() { return Date.now() + offset; }
    function taipeiDay() { return new Date(now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10); }
    function visible() { return bundles.filter(function(row) { return view.active(row, now()); }); }
    function message(value) { el('ebookResourceContent').innerHTML = '<div class="er-message" role="status">' + view.escape(value) + '</div>'; }
    function renderEntry() {
        var rows = visible();
        el('ebookResourceEntry').hidden = !rows.length;
        if (rows.length) el('ebookResourceEntry').innerHTML = '<button type="button" class="er-entry er-entry--review" data-er-action="open"><span class="er-entry-copy"><strong>' +
            view.escape(rows.length === 1 ? rows[0].title + '複習資料' : '段考複習資料') + '</strong><small><span class="er-entry-meta">' +
            rows.reduce(function(total,row) { return total + (Number(row.paperCount) || 0); }, 0) + ' 份各校考古題</span><span class="er-entry-meta">・題目與答案' + '</span></small></span><span class="er-entry-action"><span>開啟考古題</span><span aria-hidden="true">→</span></span></button>';
    }
    function showPage() {
        el('main-screen').classList.add('resources-open');
        el('ebookResourcePage').hidden = false;
        window.scrollTo(0, 0);
    }
    function close() {
        generation++; busy = false; selected = null;
        el('main-screen').classList.remove('resources-open');
        el('ebookResourcePage').hidden = true;
        if (/^#resources(?:\/|$)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    }
    function renderList() {
        generation++; busy = false; selected = null;
        var rows = visible();
        if (!rows.length) { message('目前沒有開放的段考複習資料。'); return; }
        el('ebookResourceContent').innerHTML = '<div class="er-heading"><h2>段考複習資料</h2><p>選擇要練習的段考。</p></div>' + rows.map(function(row) {
            return '<button type="button" class="er-pack-choice" data-er-id="' + view.escape(row.id) + '"><strong>' + view.escape(row.title) + '</strong><small>' + row.paperCount + ' 份練習卷</small></button>';
        }).join('');
    }
    async function openBundle(id) {
        if (!request) return;
        var token = ++generation;
        showPage(); busy = true; message('正在載入複習資料…');
        try {
            var result = await request({ id: id });
            if (token !== generation) return;
            offset = Number(result.serverNow || Date.now()) - Date.now();
            selected = result.bundle; scheduleBoundary();
            if (!view.active(selected, now())) { message('這份複習資料尚未開放或已結束提供。'); selected = null; return; }
            el('ebookResourceContent').innerHTML = view.renderBundle(selected);
            var heading = el('ebookResourceContent').querySelector('h2');
            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
        } catch (error) {
            if (token === generation) { selected = null; message((error && error.message) || '資料讀取失敗，請按重新整理重試。'); }
        } finally { if (token === generation) busy = false; }
    }
    function route() {
        if (!request) return;
        var match = /^#resources(?:\/([a-zA-Z0-9_-]{8,100}))?$/.exec(location.hash);
        if (!match) { close(); return; }
        showPage();
        if (match[1]) openBundle(match[1]);
        else if (visible().length === 1) navigate(visible()[0].id, true);
        else renderList();
    }
    function navigate(id, replace) {
        var hash = '#resources' + (id ? '/' + id : '');
        if (replace || location.hash === hash) { history.replaceState(null, '', location.pathname + location.search + hash); route(); }
        else location.hash = hash;
    }
    async function load() {
        if (!request || busy) return;
        var token = ++generation; busy = true;
        try {
            var result = await request({});
            if (token !== generation) return;
            offset = Number(result.serverNow || Date.now()) - Date.now();
            bundles = result.bundles || []; nextOpenAt = Number(result.nextOpenAt) || 0; loadedAt = Date.now(); lastDay = taipeiDay();
            renderEntry(); route(); scheduleBoundary();
        } catch (error) {
            if (token !== generation) return;
            bundles = []; renderEntry();
            // Surface a retry entry instead of silently treating a failed read as no resources.
            el('ebookResourceEntry').hidden = false;
            el('ebookResourceEntry').innerHTML = '<button type="button" class="er-entry" data-er-action="retry"><span><strong>複習資料暫時無法載入</strong><small>點此重新載入</small></span></button>';
            if (/^#resources/.test(location.hash)) { showPage(); message('資料讀取失敗，請按重新整理重試。'); }
        } finally { if (token === generation) busy = false; }
    }
    function checkBoundaries() {
        if (!request || document.hidden) return;
        renderEntry();
        if (selected && !view.active(selected, now())) { selected = null; message('這份複習資料已結束提供。'); }
        else if (!selected && !busy && location.hash === '#resources') renderList();
        if (nextOpenAt && now() >= nextOpenAt && !busy) { nextOpenAt = 0; load(); }
        else scheduleBoundary();
    }
    function scheduleBoundary() {
        clearTimeout(boundaryTimer);
        if (!request) return;
        var stamp = now(), events = bundles.map(function(row) { return view.boundary(row, 'end'); });
        if (selected) events.push(view.boundary(selected, 'end'));
        if (nextOpenAt) events.push(nextOpenAt > stamp ? nextOpenAt : stamp + 1000);
        var next = Math.min.apply(null, events.filter(function(value) { return Number.isFinite(value) && value > stamp; }));
        if (Number.isFinite(next)) boundaryTimer = setTimeout(checkBoundaries, Math.min(2147483647, Math.max(1, next - stamp)));
    }
    function reset() {
        generation++; request = null; bundles = []; selected = null; busy = false; loadedAt = 0; lastDay = ''; nextOpenAt = 0; clearTimeout(boundaryTimer); boundaryTimer = null;
        clearInterval(timer); timer = null;
        el('ebookResourceEntry').hidden = true; el('ebookResourceEntry').innerHTML = '';
        el('ebookResourceContent').innerHTML = '';
        el('main-screen').classList.remove('resources-open'); el('ebookResourcePage').hidden = true;
    }
    function mount(config) {
        reset(); request = config.request;
        load();
        timer = setInterval(function() {
            if (document.hidden) return;
            checkBoundaries();
            // One scoped refresh at the Taipei date boundary also reveals newly opened packs.
            if (lastDay && lastDay !== taipeiDay() && !busy) { lastDay = taipeiDay(); load(); }
        }, 60000);
    }
    document.addEventListener('click', function(event) {
        var target = event.target.closest('[data-er-action], [data-er-id]');
        if (!target) return;
        if (target.dataset.erId) navigate(target.dataset.erId);
        else if (target.dataset.erAction === 'open') navigate();
        else if (target.dataset.erAction === 'back') close();
        else if (target.dataset.erAction === 'list') { showPage(); history.replaceState(null, '', location.pathname + location.search + '#resources'); renderList(); }
        else if (target.dataset.erAction === 'retry') { if (!busy) load(); }
    });
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', function() { if (document.hidden || !request) return; if (!busy && Date.now() - loadedAt > 120000) load(); else checkBoundaries(); });
    root.EbookResources = { mount: mount, reset: reset, close: close };
})(window);
