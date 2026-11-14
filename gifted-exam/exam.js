(() => {
  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let transport;
  try {transport = parent.GiftedFormalExam.transport(window);} catch {
    byId('examTitle').textContent = '請從正式聯絡簿開啟考卷';
    return;
  }
  const {kind, uid} = transport;
  const labels = {quiz:'小考', makeup:'補考'};
  let paper, result, index = 0, answers = {}, submitting = false, renderId = 0;
  const api = (action, data) => transport.request(action,data);
  const draftKey = () => 'gifted-l28-draft:' + uid + ':' + kind + ':' + paper.revision;
  const media = new Map();
  function blob({contentType,base64}) {
    return new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], {type:contentType});
  }
  function assetUrl(token) {
    if (!media.has(token)) media.set(token, api('media',{token}).then(blob).then(URL.createObjectURL).catch(error=>{media.delete(token);throw error;}));
    return media.get(token);
  }
  function download(button, operation, data, filename) {
    button.hidden = false;
    button.onclick = async () => {
      button.disabled = true;
      byId('examError').textContent = '';
      try {
        const url = URL.createObjectURL(blob(await api(operation,data)));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename + '.pdf';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
      } catch (error) {byId('examError').textContent = error.message;}
      finally {button.disabled = false;}
    };
  }
  function rich(value, names = []) {
    let text = escape(value);
    for (const name of [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length)) {
      const safe = escape(name);
      text = text.split(safe).join('<u>' + safe + '</u>');
    }
    return text;
  }
  function blocks(items, names = [], option = false) {
    return (items || []).map(block => {
      if (block.kind === 'text') return '<p>' + rich(block.text, names) + '</p>';
      if (block.kind === 'image' && paper.assets[block.id]) return '<div data-image-id="' + escape(block.id) + '" data-option="' + (option ? '1' : '0') + '">載入圖表…</div>';
      if (block.kind === 'table') return '<div class="exam-table"><table><tbody>' + block.rows.map(row =>
        '<tr>' + row.map(cell => '<td colspan="' + (Number(cell.colSpan) || 1) + '" rowspan="' +
          (Number(cell.rowSpan) || 1) + '">' + escape(cell.text) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      return '';
    }).join('');
  }
  function updateNavigation() {
    byId('count').textContent = (result ? '已交卷' : '已填 ' + paper.units.filter(unit => answers[unit.id]?.trim()).length) + ' ／ ' + paper.units.length + ' 題';
    byId('question').value = index;
    byId('previous').disabled = index === 0;
    byId('next').disabled = index === paper.units.length - 1;
    byId('answerGrid').innerHTML = paper.units.map((unit, i) => {
      const row = result?.rows.find(item => item.id === unit.id);
      const state = row ? row.earned === null ? '待批' : row.earned === row.points ? '✓' : '✕' : answers[unit.id]?.trim() ? '✓' : '';
      return '<button type="button" class="' + (state === '✓' ? 'answered' : '') + '" data-index="' + i + '" aria-current="' +
        (index === i) + '">' + escape(unit.label) + ' ' + state + '</button>';
    }).join('');
  }
  function save(id, value) {
    answers[id] = value;
    try {localStorage.setItem(draftKey(), JSON.stringify(answers));} catch {byId('examError').textContent = '此裝置無法儲存草稿，請保持頁面開啟。';}
    updateNavigation();
  }
  function paint() {
    const requestedRender = ++renderId;
    const unit = paper.units[index], parent = paper.parents[unit.parentId], row = result?.rows.find(item => item.id === unit.id);
    BearStudentMedia.reset();
    const option = unit.options.find(item => item.id === answers[unit.id]);
    const references = unit.options.filter(item => row?.correctOptionIds?.includes(item.id)).map(item => item.originalLabel + '　' + item.text);
    const choice = unit.type === 'single';
    const content = byId('questionCard');
    const options = choice ? '<fieldset id="examOptions"><legend>' + (result ? '作答選項' : '選一個答案') + '</legend>' + unit.options.map(item =>
      '<label class="option"><input type="radio" name="answer" value="' + escape(item.id) + '"' + (answers[unit.id] === item.id ? ' checked' : '') +
      (result ? ' disabled' : '') + '><strong>' + escape(item.originalLabel) + '</strong><span class="exam-option-copy">' +
      (blocks(item.blocks, parent?.names, true) || rich(item.text, parent?.names)) + '</span></label>').join('') + '</fieldset>' :
      '<label>你的答案<input type="text" maxlength="1000" name="answer" value="' + escape(answers[unit.id]) + '"' + (result ? ' disabled' : '') + '></label>';
    const correction = row ? '<div class="exam-result-note"><strong>' + (row.earned === null ? '待批改' :
      row.earned === row.points ? '答對' : '需訂正') + '</strong><p>你的答案　' + escape(choice && option ? option.originalLabel + '　' + option.text : row.answer || '留白') +
      '</p><p>參考答案　' + escape(choice ? references.join('、') : row.referenceAnswer) + '</p>' +
      (row.explanation ? '<p><strong>解析</strong>　' + escape(row.explanation) + '</p>' : '') + '</div>' : '';
    content.innerHTML = (blocks(parent?.context, parent?.names)) + '<h3>' + escape(unit.label) + '</h3>' +
      (blocks(unit.blocks, parent?.names) || '<p>' + rich(unit.prompt, parent?.names) + '</p>') + correction + options;
    for (const placeholder of content.querySelectorAll('[data-image-id]')) {
      const asset = paper.assets[placeholder.dataset.imageId];
      const optionImage = placeholder.dataset.option === '1';
      assetUrl(asset.url).then(url=>{
        if (requestedRender !== renderId) return;
        placeholder.innerHTML = BearStudentMedia.html({...asset,url},'',optionImage ? '選項圖' : '題目圖表',optionImage ? 'option' : 'question');
        BearStudentMedia.bind(placeholder);
      }).catch(()=>{
        if (requestedRender !== renderId) return;
        placeholder.textContent = '圖表載入失敗。';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = '重新載入圖表';
        retry.onclick = paint;
        placeholder.append(retry);
      });
    }

    if (!result) content.querySelectorAll('[name="answer"]').forEach(input => {
      input.addEventListener(choice ? 'change' : 'input', () => save(unit.id, input.value));
    });
    updateNavigation();
  }
  function showResult(value) {
    result = value;
    answers = Object.fromEntries(result.rows.map(row => [row.id, row.answer]));
    try {localStorage.removeItem(draftKey());} catch {}
    byId('examResult').hidden = false;
    byId('examScore').textContent = result.earned === null ? '已交卷 · 填充題待批改' :
      '已交卷 · ' + (kind === 'quiz' ? result.earned + ' 分' : '錯 ' + result.wrongCount + ' 題');
    byId('examStatus').textContent = {
      'pending-review':'已回報老師，等待審查。',
      'grading-pending':'填充題批改完成後，系統會自動回報。',
      'report-pending':'答案已保存。回報收據仍待確認，可用下方按鈕查核。',
    }[result.reportStatus];
    if (result.answerPdf) download(byId('answerPdf'),'answer',{revision:result.revision},'第28堂'+labels[kind]+'解答卷');
    const refresh = byId('checkReceipt');
    refresh.hidden = result.reportStatus === 'pending-review';
    refresh.onclick = async () => {
      refresh.disabled = true;
      try {showResult(await api(result.reportStatus === 'report-pending' ? 'retry' : 'result'));}
      catch (error) {byId('examError').textContent = error.message;}
      finally {refresh.disabled = false;}
    };
    byId('answerHeading').textContent = '逐題訂正';
    byId('submitSection').hidden = true;
    paint();
  }
  function confirmSubmission() {
    const dialog = byId('confirmSubmission');
    dialog.returnValue = 'cancel';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'submit'), {once:true});
      dialog.showModal();
    });
  }
  function go(i) { index = Math.max(0, Math.min(i, paper.units.length - 1)); paint(); }
  async function init() {
    paper = await api('open');
    byId('examTitle').textContent = labels[kind] + '｜' + paper.title;
    byId('examLead').textContent = '可先印題目卷，在這裡依序填答。交卷後系統會自動回報' + transport.reportType + '，你可以逐題訂正。';
    if (paper.questionPdf) download(byId('questionPdf'),'media',{token:paper.questionPdf},'第28堂'+labels[kind]+'題目卷');
    if (paper.paperReported && !paper.submitted) {byId('examLead').textContent = '這份考卷已有紙本回報，請在聯絡簿查看。';return;}
    byId('answerSection').hidden = false;
    byId('question').innerHTML = paper.units.map((unit, i) => '<option value="' + i + '">' + escape(unit.label) + '</option>').join('');
    byId('question').onchange = event => go(Number(event.target.value));
    byId('previous').onclick = () => go(index - 1);
    byId('next').onclick = () => go(index + 1);
    byId('answerGrid').onclick = event => {
      const button = event.target.closest('[data-index]');
      if (button) { go(Number(button.dataset.index)); byId('questionCard').scrollIntoView({block:'center'}); }
    };
    if (paper.submitted) { showResult(await api('result')); return; }
    try {answers = JSON.parse(localStorage.getItem(draftKey()) || '{}') || {};} catch {answers = {};}
    byId('submitSection').hidden = false;
    byId('submit').onclick = async () => {
      const submit = byId('submit');
      if (submitting) return;
      submitting = submit.disabled = true;
      byId('examError').textContent = '';
      try {
        if (!await confirmSubmission()) return;
        showResult(await api('submit', {answers, revision: paper.revision, confirmBlanks: byId('blanks').checked}));
        window.scrollTo(0, 0);
      } catch (error) {
        const reason = error.details?.reason;
        if (reason === 'already-submitted') {try {showResult(await api('result'));return;} catch {}}
        byId('examError').textContent = error.message || '無法確認交卷，重開後可查原收據。';
      } finally {submitting = submit.disabled = false;}
    };
    paint();
  }
  init().catch(error => {byId('examTitle').textContent = '無法開啟這份考卷';byId('examError').textContent = error.message;});
})();
