(function(root) {
  'use strict';
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function safeUrl(value) { try { var u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (_) { return ''; } }
  function active(row, now) { var day = new Date((now || Date.now()) + 28800000).toISOString().slice(0,10); return row.status === 'published' && (!row.startDate || row.startDate <= day) && (!row.endDate || row.endDate >= day); }
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
      (bundle.endDate ? '<p class="er-footer">提供至 ' + escape(bundle.endDate.replace(/-/g,'/')) + '（台灣時間）</p>' : '');
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
  root.ResourceCatalogView = { escape: escape, safeUrl: safeUrl, active: active, renderBundle: renderBundle };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ResourceCatalogView;
})(typeof window !== 'undefined' ? window : globalThis);
