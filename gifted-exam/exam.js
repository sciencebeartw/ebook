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
  const draftKey = () => 'gifted-l28-draft:' + uid + (transport.independentTrial ? ':ai-copy:' : ':') + kind + ':' + paper.revision;
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
      const statusClass = state === '✓' ? 'answered' : state === '✕' ? 'needs-correction' : state === '待批' ? 'awaiting-grading' : '';
      return '<button type="button" class="' + statusClass + '" data-index="' + i + '" aria-current="' +
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
    const canRequestCorrection = kind === 'quiz' && !choice && row?.status === 'wrong';
    const review = row?.aiReview;
    const notifyPending = review === 'credited' && row.aiReceipt === 'pending';
    const askAI = review === 'available' || review === 'working' || notifyPending;
    const hint = review === 'credited' ? '這格已補分。' + (notifyPending ? '可重送補分通知給老師。' : '補分通知已送達聯絡簿。') :
      review === 'appeal' ? '這格未能確認同義。若你認為原答正確，可以申請判分更正。' :
      review === 'working' ? '這一格正在複判。' : '';
    const content = byId('questionCard');
    const options = choice ? '<fieldset id="examOptions"><legend>' + (result ? '作答選項' : '選一個答案') + '</legend>' + unit.options.map(item =>
      '<label class="option"><input type="radio" name="answer" value="' + escape(item.id) + '"' + (answers[unit.id] === item.id ? ' checked' : '') +
      (result ? ' disabled' : '') + '><strong>' + escape(item.originalLabel) + '</strong><span class="exam-option-copy">' +
      (blocks(item.blocks, parent?.names, true) || rich(item.text, parent?.names)) + '</span></label>').join('') + '</fieldset>' :
      '<label>你的答案<input type="text" maxlength="1000" name="answer" value="' + escape(answers[unit.id]) + '"' + (result ? ' disabled' : '') + '></label>';
    const correction = row ? '<div class="exam-result-note"><strong>' + (row.earned === null ? '待批改' :
      row.earned === row.points ? '答對' : '需訂正') + '</strong><p>你的答案　' + escape(choice && option ? option.originalLabel + '　' + option.text : row.answer || '留白') +
      '</p><p>參考答案　' + escape(choice ? references.join('、') : row.referenceAnswer) + '</p>' +
      (row.explanation ? '<p><strong>解析</strong>　' + escape(row.explanation) + '</p>' : '') +
      (hint ? '<p role="status">' + escape(hint) + '</p>' : '') +
      (askAI ? '<button type="button" id="requestAi">' + (notifyPending ? '重送補分通知' : review === 'working' ? '查看複判進度' : '申請 AI 複判') + '</button> ' : '') +
      (canRequestCorrection ? '<button type="button" id="requestCorrection">申請判分更正</button><p role="status" id="correctionHint"></p>' : '') + '</div>' : '';
    content.innerHTML = (blocks(parent?.context, parent?.names)) + '<h3>' + escape(unit.label) + '</h3>' +
      (blocks(unit.blocks, parent?.names) || '<p>' + rich(unit.prompt, parent?.names) + '</p>') + correction + options;
    if (askAI) byId('requestAi').onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = notifyPending ? '正在確認補分通知…' : '正在確認交卷時的答案…';
      byId('examError').textContent = '';
      try { showResult(await api('rejudgeFill',{unitId:unit.id})); }
      catch { byId('examError').textContent = '暫時無法確認複判結果，可再查詢或申請判分更正。'; paint(); }
    };
    if (canRequestCorrection) byId('requestCorrection').onclick = () => {
      if (!transport.composeCorrection(unit.label)) {
        byId('correctionHint').textContent = '請回到 11 月 14 日的聯絡簿，在留言區填寫題號及申請原因。';
      }
    };
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
    if (result.originalEarned != null && result.originalEarned !== result.earned) {
      byId('examStatus').textContent = '原交卷回報 ' + result.originalEarned + ' 分，複判後 ' + result.earned +
        ' 分。正式成績依老師審查結果登記。';
    }
    if (transport.independentTrial) byId('examStatus').textContent = result.reportStatus === 'report-pending' ?
      '測試卷已儲存，請按下方按鈕確認老師的收件狀態。' :
      '獨立測試卷原分 ' + result.originalEarned + ' 分，目前 ' + result.earned + ' 分。';
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
    if (typeof dialog.showModal !== 'function') {
      const form = dialog.querySelector('form');
      return new Promise(resolve => {
        form.querySelectorAll('button').forEach(button => {
          button.onclick = event => {
            event.preventDefault();
            dialog.removeAttribute('open');
            resolve(button.value === 'submit');
          };
        });
        dialog.classList.add('exam-confirm-legacy');
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('open', '');
        form.querySelector('[autofocus]').focus();
      });
    }
    dialog.returnValue = 'cancel';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'submit'), {once:true});
      dialog.showModal();
    });
  }
  function go(i) { index = Math.max(0, Math.min(i, paper.units.length - 1)); paint(); }
  async function init() {
    paper = await api('open');
    byId('examTitle').textContent = (transport.independentTrial ? 'AI 複判獨立測試卷' : labels[kind]) + '｜' + paper.title;
    byId('examLead').textContent = '可先印題目卷，在這裡依序填答。交卷後系統會自動回報' + transport.reportType + '，你可以逐題訂正。';
    if (transport.independentTrial) byId('examLead').textContent = '本卷單獨記錄。交卷後可點選填充題申請複判，老師會在這堂聯絡簿收到測試分數。';
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
