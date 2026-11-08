(function (root) {
  'use strict';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const positive = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
  function presentation(asset = {}) {
    const percent = positive(asset.displayWidthPercent);
    if (percent) return { width: `clamp(240px, ${clamp(percent, 1, 100)}%, 720px)`, manual: true };
    if (asset.renderAs === 'table') return { width: 'min(100%, 720px)', manual: false };
    const w = positive(asset.width), h = positive(asset.height);
    const pt = positive(asset.wordDisplayWidthPt) || positive(asset.wordDisplayWidthTwip) / 20;
    const hp = positive(asset.wordDisplayHeightPt) || positive(asset.wordDisplayHeightTwip) / 20;
    const ratio = w && h ? w / h : pt && hp ? pt / hp : 1.5;
    const compact = pt && pt < 70 && hp && hp < 30;
    const target = pt ? pt * 96 / 72 * 2 : w || 480;
    const width = compact ? clamp(target, 100, 220) : Math.min(clamp(target, 420, 720), Math.max(160, ratio * 480));
    return { width: `${Math.round(width)}px`, manual: false };
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  let entries = [], dialog, previousFocus, zoom = 1, baseWidth = 0;
  function reset() { if (dialog?.open) dialog.close(); entries = []; }
  function html(asset, tableHtml, label) {
    const key = entries.push({asset, label}) - 1;
    const display = presentation(asset);
    const body = asset.renderAs === 'table' ? tableHtml : `<img src="${escape(asset.url)}" alt="${escape(label)}" loading="lazy">`;
    return `<figure class="student-media" data-student-media="${key}" style="width:${display.width}"><div class="student-media-preview">${body}</div><button type="button" class="student-media-open" aria-label="放大${escape(label)}">放大圖表 <span aria-hidden="true">↗</span></button></figure>`;
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'student-media-dialog';
    dialog.setAttribute('aria-labelledby', 'studentMediaTitle');
    dialog.innerHTML = `<header><h2 id="studentMediaTitle">圖表放大</h2><button type="button" data-media-action="close" autofocus>關閉</button></header><div class="student-media-controls"><button type="button" data-media-action="minus" aria-label="縮小圖表">−</button><output aria-live="polite">100%</output><button type="button" data-media-action="plus" aria-label="放大圖表">＋</button><button type="button" data-media-action="fit">符合視窗</button></div><div class="student-media-viewport" tabindex="0" aria-label="放大圖表，可捲動查看"><div class="student-media-content"></div></div><p>放大後可上下、左右捲動；按 Esc 或「關閉」回到作答。</p>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { document.body.classList.remove('student-media-opened'); previousFocus?.focus({preventScroll:true}); });
    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-media-action]')?.dataset.mediaAction;
      if (action === 'close' || event.target === dialog) dialog.close();
      if (action === 'plus') { zoom = clamp(zoom + .25, .5, 3); paintZoom(); }
      if (action === 'minus') { zoom = clamp(zoom - .25, .5, 3); paintZoom(); }
      if (action === 'fit') { zoom = 1; paintZoom(); }
    });
  }
  function paintZoom() {
    const view = dialog.querySelector('.student-media-viewport');
    const content = dialog.querySelector('.student-media-content');
    const fitted = Math.min(baseWidth, Math.max(200, view.clientWidth - 24));
    content.style.width = `${Math.round(fitted * zoom)}px`;
    content.style.fontSize = `${18 * zoom}px`;
    dialog.querySelector('output').textContent = `${Math.round(zoom * 100)}%`;
    dialog.querySelector('[data-media-action="minus"]').disabled = zoom <= .5;
    dialog.querySelector('[data-media-action="plus"]').disabled = zoom >= 3;
  }
  function open(figure) {
    const entry = entries[Number(figure.dataset.studentMedia)];
    if (!entry) return;
    ensureDialog(); previousFocus = figure.querySelector('button'); zoom = 1;
    const source = figure.querySelector('.student-media-preview');
    const content = dialog.querySelector('.student-media-content');
    content.replaceChildren(...[...source.childNodes].map(node => node.cloneNode(true)));
    const image = content.querySelector('img');
    if (image) image.loading = 'eager';
    const cols = entry.asset.table?.rows?.[0]?.length || 4;
    baseWidth = entry.asset.renderAs === 'table' ? clamp(cols * 140, 560, 1000) : clamp(positive(entry.asset.width) || 900, 560, 1200);
    dialog.querySelector('h2').textContent = entry.label;
    document.body.classList.add('student-media-opened'); dialog.showModal(); paintZoom();
    dialog.querySelector('.student-media-viewport').scrollTo(0, 0);
  }
  function bind(container) {
    if (!container || container.dataset.mediaBound) return;
    container.dataset.mediaBound = '1';
    container.addEventListener('click', event => {
      const figure = event.target.closest('[data-student-media]');
      if (!figure || !container.contains(figure)) return;
      // Image option zoom must not toggle its surrounding answer label.
      event.preventDefault(); event.stopPropagation(); open(figure);
    });
    window.addEventListener('resize', () => { if (dialog?.open) paintZoom(); });
  }
  const api = {presentation, html, reset, bind};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BearStudentMedia = api;
})(typeof window !== 'undefined' ? window : globalThis);
