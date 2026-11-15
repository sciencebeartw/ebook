(function(root) {
  'use strict';
  let session, dialog, frame, opener, unsubscribe;
  const pilotClass = '115小六資優自然週六上午班';
  const postId = 'post_171442cbd9b18f73df6871dcdf4ba96ee4f96bc0_0';
  const postDate = '2026/11/14';
  const paperAnchors = {quiz:'[data-pending-exam-paper-anchor]',makeup:'[data-pending-paper-anchor]'};
  const entry = () => document.getElementById('giftedFormalExamEntry');
  const current = own => !!own && session === own && own.auth.currentUser?.uid === own.uid;

  function mount() {
    const own = session;
    if (!current(own) || !own.controls.size) return;
    const host = entry();
    const post = Array.from(document.querySelectorAll('#tab-content-0 [data-pending-post-anchor]')).find(card =>
      card.dataset.postId === postId && card.dataset.postDate === postDate && card.dataset.sourceClassKey === pilotClass);
    let hasFallback = false;
    for (const [kind, controls] of own.controls) {
      const examId = own.exam[kind].examId;
      const anchor = post && Array.from(post.querySelectorAll(paperAnchors[kind])).find(node =>
        !!examId && (node.dataset.examId === examId || node.dataset.storedExamId === examId));
      const paper = anchor?.querySelector('a.btn-link[href]');
      if (paper) {
        if (paper.nextElementSibling !== controls) paper.after(controls);
      } else {
        hasFallback = true;
        if (controls.parentElement !== host) host.append(controls);
      }
    }
    host.hidden = !hasFallback;
  }
  function close(clear) {
    dialog?.close();
    dialog?.remove();
    dialog = frame = null;
    if (opener?.isConnected) opener.focus();
    opener = null;
    if (clear) {
      unsubscribe?.();
      unsubscribe = null;
      session?.controls.forEach(controls => controls.remove());
      session = null;
      const host = entry();
      if (host) {host.hidden = true;host.replaceChildren();}
    }
  }
  async function ready(context) {
    const user = context.auth?.currentUser;
    if (!user || context.preview || context.teacherView || context.result?.isAdmin ||
        context.result?.className !== pilotClass || context.result?.studentName !== '測試學生') {
      close(true);
      return;
    }
    if (current(session)) {mount();return;}
    close(true);
    const own = {auth:context.auth, uid:user.uid, callable:context.functions.httpsCallable('runEbookStudentAction',{timeout:180000}), controls:new Map()};
    session = own;
    unsubscribe = own.auth.onAuthStateChanged(user => {if (session === own && user?.uid !== own.uid) close(true);});
    try {
      const details = await request(own, 'access');
      if (!current(own)) return;
      own.exam = details;
      for (const [kind, exam] of Object.entries(details)) {
        if (!Object.hasOwn(paperAnchors, kind)) continue;
        const controls = document.createElement('div');
        controls.className = 'gfe-exam-controls';
        controls.dataset.formalExamKind = kind;
        const button = document.createElement('button');
        button.type = 'button';
        const title = kind === 'quiz' ? '小考' : '補考';
        button.textContent = (exam.accepting ? '線上作答' : '查看線上結果') + '｜' + title;
        button.onclick = () => open(kind,button);
        controls.append(button);
        if (exam.accepting) controls.append(paperForm(kind, own));
        own.controls.set(kind, controls);
      }
      mount();
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
        const payload = {className:pilotClass,targetDate:exam.date,targetExamColIndex:exam.colIndex,
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
  root.GiftedFormalExam={ready,mount,close,transport};
})(window);
