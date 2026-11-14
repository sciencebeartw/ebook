(function(root) {
  'use strict';
  let session, dialog, frame, opener, unsubscribe;
  const entry = () => document.getElementById('giftedFormalExamEntry');
  const current = own => session === own && own.auth.currentUser?.uid === own.uid;
  function close(clear) {
    dialog?.close();
    dialog?.remove();
    dialog = frame = null;
    if (opener?.isConnected) opener.focus();
    opener = null;
    if (clear) {
      unsubscribe?.();
      unsubscribe = null;
      session = null;
      const host = entry();
      if (host) {host.hidden = true;host.replaceChildren();}
    }
  }
  async function ready(context) {
    close(true);
    const user = context.auth?.currentUser;
    if (!user || context.preview || context.teacherView || context.result?.isAdmin ||
        context.result?.className !== '115小六資優自然週六上午班' || context.result?.studentName !== '測試學生') return;
    const own = {auth:context.auth, uid:user.uid, callable:context.functions.httpsCallable('runEbookStudentAction',{timeout:180000})};
    session = own;
    unsubscribe = own.auth.onAuthStateChanged(user => {if (session === own && user?.uid !== own.uid) close(true);});
    try {
      const details = await request(own, 'access');
      if (!current(own)) return;
      own.exam = details;
      if (!Object.keys(details).length) return;
      const title = document.createElement('strong');
      title.textContent = '第 28 堂線上考卷｜測試學生專用';
      entry().append(title);
      for (const kind of ['quiz','makeup']) {
        if (!details[kind]) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = details[kind].label;
        button.onclick = () => open(kind,button);
        entry().append(button);
        if (details[kind].accepting) entry().append(paperForm(kind, own));
      }
      entry().hidden = false;
    } catch (error) {
      if (current(own) && !['functions/failed-precondition','functions/permission-denied'].includes(error.code)) {
        entry().textContent = '暫時無法載入第 28 堂線上考卷，請重新整理聯絡簿。';
        entry().hidden = false;
      }
    }
  }
  function paperForm(kind, own) {
    const details = document.createElement('details');
    const title = document.createElement('summary');
    const quiz = kind === 'quiz';
    title.textContent = quiz ? '紙本小考回報' : '紙本補考回報';
    const form = document.createElement('form');
    const label = document.createElement('label');
    label.textContent = quiz ? '小考分數 ' : '補考錯題數 ';
    const input = document.createElement('input');
    input.type = 'number'; input.required = true; input.min = '0'; input.max = quiz ? '100' : '20';
    input.step = quiz ? 'any' : '1';
    const send = document.createElement('button'); send.type = 'submit'; send.textContent = '送出紙本回報';
    const status = document.createElement('span'); status.setAttribute('role','status');
    label.append(input); form.append(label,send,status); details.append(title,form);
    form.onsubmit = async event => {
      event.preventDefault();
      if (send.disabled || !current(own)) return;
      send.disabled = true;
      status.textContent = '';
      try {
        if (!await root.swalConfirm('送出紙本回報？','送出後這份考卷就會以紙本回報送老師審查。')) return;
        const exam = own.exam[kind];
        const content = quiz ? String(input.valueAsNumber) : '錯 '+input.valueAsNumber+' 題';
        const payload = {className:'115小六資優自然週六上午班',targetDate:exam.date,targetExamColIndex:exam.colIndex,
          targetExamTitle:exam.title,targetExamId:exam.examId,type:quiz?'缺考回報':'補考結果回報',content,
          clientRequestId:'formal_paper_'+crypto.randomUUID().replace(/-/g,'')};
        const reply = await own.callable({action:'submitFeedback',data:payload});
        if (!current(own)) return;
        if (!reply.data?.result?.success) throw Error('紙本回報尚待確認。');
        status.textContent = '已回報老師，等待審查。';
        input.disabled = true;
      } catch (error) {status.textContent = error.message;}
      finally {send.disabled = input.disabled;}
    };
    return details;
  }

  async function request(own, operation, data = {}) {
    if (!current(own)) throw Error('請重新登入聯絡簿。');
    const reply = await own.callable({action:'giftedFormalExamL28',data:{...data,operation}});
    if (!current(own)) throw Error('請重新登入聯絡簿。');
    return reply.data.result;
  }
  function open(kind, button) {
    close(false);
    opener = button;
    dialog = document.createElement('dialog');
    dialog.className = 'gfe-dialog';
    dialog.setAttribute('aria-label',session.exam[kind].label);
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '返回聯絡簿';
    back.onclick = () => close(false);
    frame = document.createElement('iframe');
    frame.title = session.exam[kind].label;
    frame.dataset.kind = kind;
    frame.src = 'gifted-exam/index.html';
    dialog.append(back,frame);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});
    document.body.append(dialog);
    dialog.showModal();
    back.focus();
  }
  function transport(caller) {
    const own = session, active = frame;
    if (!active || caller !== active.contentWindow || !current(own)) throw Error('請從正式聯絡簿開啟考卷。');
    return {kind:active.dataset.kind, uid:own.uid, reportType:active.dataset.kind === 'quiz' ? '分數' : '錯題數',
      request(operation,data){
        if (frame !== active) throw Error('請重新開啟考卷。');
        return request(own,operation,{...data,kind:active.dataset.kind});
      },
    };
  }
  root.GiftedFormalExam={ready,close,transport};
})(window);
