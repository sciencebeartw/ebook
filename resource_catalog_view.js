(function(root) {
  'use strict';
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function safeUrl(value) { try { var u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; } }
  function boundary(row, kind) {
    var date = row[kind + 'Date'], time = row[kind + 'Time'];
    if (!date) return kind === 'start' ? -Infinity : Infinity;
    var stamp = Date.parse(date + 'T' + (time || '00:00') + ':00+08:00');
    return kind === 'end' && !time ? stamp + 86400000 : stamp;
  }
  function active(row, now) { now = now == null ? Date.now() : now; return !!row && row.status === 'published' && now >= boundary(row,'start') && now < boundary(row,'end'); }
  function period(row) {
    var start = row.startDate ? row.startDate.replace(/-/g,'/') + ' ' + (row.startTime || '00:00') : '';
    var end = row.endDate ? row.endDate.replace(/-/g,'/') + ' ' + (row.endTime || '23:59') : '';
    return (start ? '開始：' + start : '') + (start && end ? '；' : '') + (end ? '提供至：' + end + (row.endTime ? '（屆時關閉）' : '（含當日）') : '');
  }
  function link(file, kind) {
    var label = kind === 'question' ? '開啟題目' : '查看答案';
    var url = file && safeUrl(file.url);
    return url ? '<a class="er-file er-' + kind + '" href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' : '<span class="er-file er-unavailable">' + (kind === 'answer' ? '答案尚未提供' : '題目尚未提供') + '</span>';
  }
  var renderCount = 0;
  function renderBundle(bundle) {
    var prefix = 'er-text-' + (++renderCount) + '-';
    return '<div class="er-heading"><div class="er-eyebrow">段考複習資料</div><h2>' + escape(bundle.title) + '</h2>' +
      '<p>' + escape(bundle.description || '請先獨立作答，再核對答案。本次不需回報分數。').replace(/\n/g,'<br>') + '</p><span class="er-count">' + (bundle.papers || []).length + ' 份練習卷</span></div>' +
      '<div class="er-papers">' + (bundle.papers || []).map(function(paper, i) {
        var hasText = paper.answer && paper.answer.type === 'text' && typeof paper.answer.text === 'string' && paper.answer.text.trim();
        var answer = hasText ? '<button type="button" class="er-file er-answer" data-er-text-toggle aria-expanded="false" aria-controls="' + prefix + i + '">查看簡答</button>' : link(paper.answer,'answer');
        var content = hasText ? '<div class="er-answer-text" id="' + prefix + i + '" hidden><strong>文字簡答</strong><p>' + escape(paper.answer.text) + '</p></div>' : '';
        return '<article class="er-paper"><h3><span class="er-number">' + String(i + 1).padStart(2,'0') + '</span>' + escape(paper.title) + '</h3><div class="er-file-pair">' + link(paper.question,'question') + answer + '</div>' + content + '</article>';
      }).join('') + '</div>' +
      (period(bundle) ? '<p class="er-footer">' + escape(period(bundle)) + '（台灣時間）</p>' : '');
  }
  if (root.document) root.document.addEventListener('click', function(event) {
    var button = event.target.closest('[data-er-text-toggle]');
    if (!button) return;
    var content = button.closest('.er-paper').querySelector('.er-answer-text');
    if (!content) return;
    content.hidden = !content.hidden;
    button.setAttribute('aria-expanded', String(!content.hidden));
    button.textContent = content.hidden ? '查看簡答' : '收起簡答';
  });
  root.ResourceCatalogView = { escape: escape, safeUrl: safeUrl, active: active, boundary: boundary, period: period, renderBundle: renderBundle };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ResourceCatalogView;
})(typeof window !== 'undefined' ? window : globalThis);
