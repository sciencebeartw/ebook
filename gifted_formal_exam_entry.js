(function(root) {
  'use strict';
  let session, dialog, frame, opener, unsubscribe;
  const pilotClass = '115小六資優自然週六上午班';
  const releaseClasses = new Set([]); // Derived from the private class release at packaging time.
  const studentActionUrl = 'https://us-central1-sciencebear-admin.cloudfunctions.net/runEbookStudentAction';
  const retryTransportCodes = new Set(['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/unauthenticated']);
  const accessMessages = {
    'functions/unauthenticated':'登入狀態已失效。請在聯絡簿登出，再登入聯絡簿。',
    'functions/unavailable':'此裝置目前連不到考卷服務。',
    'functions/deadline-exceeded':'考卷服務連線逾時。',
    'functions/internal':'考卷服務沒有傳回可讀取的結果。',
    'functions/permission-denied':'考卷服務未能確認這次登入可使用這份考卷。',
    'functions/failed-precondition':'目前無法確認考卷的開放狀態。',
    'exam/access-response':'考卷資料不完整，請重試。'
  };
  const paperAnchors = {quiz:'[data-pending-exam-paper-anchor]',makeup:'[data-pending-paper-anchor]'};
  const entry = () => document.getElementById('giftedFormalExamEntry');
  const current = own => !!own && session === own && own.auth.currentUser?.uid === own.uid;
  const findPost = (className,date) => Array.from(document.querySelectorAll('#tab-content-0 [data-pending-post-anchor]')).find(card =>
    card.dataset.postDate === date && card.dataset.sourceClassKey === className);

  function mount() {
    const own = session;
    if (!current(own) || !own.controls.size) return;
    const host = entry();
    let hasFallback = false;
    for (const [kind, controls] of own.controls) {
      const examId = own.exam[kind].examId;
      const post = findPost(own.className,own.exam[kind].postDate || '2026/11/14');
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
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
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
      if (host) {host.hidden = true;host.textContent = '';host.removeAttribute('aria-busy');}
    }
  }
  async function ready(context) {
    const user = context.auth?.currentUser;
    const identity = context.studentSession?.firebaseAuthUid === user?.uid ? context.studentSession : context.result;
    const pilot = identity?.className === pilotClass && identity?.studentName === '測試學生';
    if (!user || context.preview || context.teacherView || context.result?.isAdmin ||
        (!pilot && !releaseClasses.has(identity?.className))) {
      close(true);
      return;
    }
    if (current(session) && session.className===identity.className && session.studentName===identity.studentName && session.studentKey===identity.studentKey) {mount();return;}
    close(true);
    const own = {className:identity.className,studentName:identity.studentName,studentKey:identity.studentKey,pilot,auth:context.auth, uid:user.uid, functions:context.functions,
      callable:context.functions.httpsCallable('runEbookStudentAction',{timeout:180000}), controls:new Map()};
    own.standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    session = own;
    unsubscribe = own.auth.onAuthStateChanged(user => {if (session === own && user?.uid !== own.uid) close(true);});
    await load(own);
  }
  async function load(own) {
    if (!current(own)) return;
    const host = entry();
    if (!host) return;
    host.setAttribute('aria-busy', 'true');
    try {
      const details = await request(own, 'access');
      if (!current(own)) return;
      if (!details || typeof details !== 'object' || Array.isArray(details) ||
          Object.entries(details).some(([kind, exam]) =>
            !Object.prototype.hasOwnProperty.call(paperAnchors,kind) || !exam?.examId || typeof exam.accepting !== 'boolean')) {
        throw formalError('exam/access-response');
      }
      own.exam = details;
      for (const [kind, exam] of Object.entries(details)) {
        const controls = document.createElement('div');
        controls.className = 'gfe-exam-controls';
        controls.dataset.formalExamKind = kind;
        const button = document.createElement('button');
        button.type = 'button';
        const title = kind === 'quiz' ? '小考' : '補考';
        button.textContent = (exam.accepting ? '線上作答' : '查看線上結果') + '｜' + title;
        button.onclick = () => open(kind,button);
        controls.append(button);
        if (kind === 'quiz' && exam.independentTrial === true) {
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.dataset.independentTrial = 'true';
          copy.textContent = 'AI 複判獨立測試卷';
          copy.onclick = () => open(kind,copy,true);
          controls.append(copy);
        }
        if (exam.accepting) controls.append(paperForm(kind, own));
        own.controls.set(kind, controls);
      }
      host.textContent = '';
      host.hidden = true;
      mount();
    } catch (error) {
      if (!current(own)) return;
      own.controls.forEach(controls => controls.remove());
      own.controls.clear();
      host.textContent = '';
      host.hidden = true;
      const status = document.createElement('span');
      status.setAttribute('role', 'status');
      const message = Object.prototype.hasOwnProperty.call(accessMessages, error.code) ?
        accessMessages[error.code] : '考卷入口顯示失敗。';
      status.textContent = '暫時無法載入第 28 堂線上考卷。' + message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重試載入考卷';
      retry.onclick = async () => {
        retry.disabled = true;
        retry.textContent = '正在載入…';
        await load(own);
      };
      host.append(status, retry);
      host.hidden = false;
    } finally {
      if (current(own)) host.removeAttribute('aria-busy');
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
        const payload = {className:own.className,targetDate:exam.date,targetExamColIndex:exam.colIndex,
          targetExamTitle:exam.title,targetExamId:exam.examId,type:quiz?'缺考回報':'補考結果回報',content,
          clientRequestId:root.createClientRequestId('formal_paper')};
        const call = {action:'submitFeedback',data:payload};
        const reply = own.direct ? await callStudentActionDirect(own, call) : (await own.callable(call)).data;
        if (!current(own)) return;
        if (!reply?.result?.success) throw Error('紙本回報尚待確認。');
        status.textContent = '已回報老師，等待審查。';
        input.disabled = true;
      } catch (error) {status.textContent = error.message;}
      finally {send.disabled = input.disabled;}
    };
    return details;
  }

  function formalError(code) {
    const error = Error('暫時無法完成考卷操作，請確認連線或重新開啟考卷。');
    error.code = code;
    return error;
  }
  async function callStudentActionDirect(own, payload, refreshToken = false) {
    const user = own.auth.currentUser;
    let token;
    try {token = await user.getIdToken(refreshToken);}
    catch (error) {
      throw formalError(error.code === 'auth/network-request-failed' ? 'functions/unavailable' : 'functions/unauthenticated');
    }
    if (!current(own)) throw formalError('functions/unauthenticated');
    // The same authenticated callable endpoint, using XHR if standalone WebKit's SDK transport fails.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', studentActionUrl);
      xhr.timeout = payload.data.operation === 'access' ? 15000 : 180000;
      xhr.setRequestHeader('Content-Type','application/json');
      xhr.setRequestHeader('Authorization','Bearer ' + token);
      xhr.onerror = xhr.onabort = () => reject(formalError('functions/unavailable'));
      xhr.ontimeout = () => reject(formalError('functions/deadline-exceeded'));
      xhr.onload = () => {
        let reply;
        try {reply = JSON.parse(xhr.responseText);}
        catch {reject(formalError('functions/internal'));return;}
        if (reply?.error) {
          const status = reply.error.status;
          const code = typeof status === 'string' && /^[A-Z_]+$/.test(status) ?
            'functions/' + status.toLowerCase().replace(/_/g,'-') : 'functions/internal';
          const error = formalError(code);
          const reason = reply.error.details?.reason;
          if (typeof reason === 'string' && /^[a-z-]+$/.test(reason)) {
            error.details = {reason};
            if (typeof reply.error.message === 'string') error.message = reply.error.message;
          }
          reject(error);
          return;
        }
        if (xhr.status === 200 && reply?.result) {resolve(reply.result);return;}
        reject(formalError('functions/internal'));
      };
      xhr.send(JSON.stringify({data:payload}));
    });
  }
  async function request(own, operation, data = {}) {
    if (!current(own)) throw formalError('functions/unauthenticated');
    const payload = {action:'giftedFormalExamL28',data:{...data,operation}};
    let reply;
    if (own.direct) {
      reply = await callStudentActionDirect(own, payload);
    } else {
      const call = operation === 'access' ? own.functions.httpsCallable('runEbookStudentAction',{timeout:15000}) : own.callable;
      try {reply = (await call(payload))?.data;}
      catch (error) {
        // Only access is replayed. A paper submission always uses a single request path.
        if (operation !== 'access' || !own.standalone || !retryTransportCodes.has(error.code) || !current(own)) throw error;
        reply = await callStudentActionDirect(own, payload, error.code === 'functions/unauthenticated');
        own.direct = true;
      }
    }
    if (!current(own)) throw formalError('functions/unauthenticated');
    return reply?.result;
  }
  function open(kind, button, independentTrial = false) {
    close(false);
    opener = button;
    dialog = document.createElement('dialog');
    dialog.className = 'gfe-dialog';
    const title = independentTrial ? 'AI 複判獨立測試卷' : session.exam[kind].label;
    dialog.setAttribute('aria-label',title);
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '返回聯絡簿';
    back.onclick = () => close(false);
    frame = document.createElement('iframe');
    frame.title = title;
    frame.dataset.independentTrial = String(independentTrial);
    frame.dataset.kind = kind;
    frame.src = 'gifted-exam/index.html?v=20261118-cohort-v1';
    dialog.append(back,frame);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});
    document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
      dialog.classList.add('gfe-dialog-legacy');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('open', '');
    }
    back.focus();
  }
  function transport(caller) {
    const own = session, active = frame;
    if (!active || caller !== active.contentWindow || !current(own)) throw Error('請從正式聯絡簿開啟考卷。');
    const independentTrial = active.dataset.independentTrial === 'true';
    const trialButton = active.dataset.kind === 'quiz' && !independentTrial &&
      own.controls.get('quiz')?.querySelector('[data-independent-trial]');
    const exam = own.exam[active.dataset.kind];
    const draftOwner = own.pilot ? own.uid : JSON.stringify([own.className,own.studentKey || own.studentName,exam.examId,own.uid]);
    return {pilot:own.pilot, aiFill:exam.aiFill === true, draftOwner, kind:active.dataset.kind, independentTrial, uid:own.uid, reportType:active.dataset.kind === 'quiz' ? '分數' : '錯題數',
      openIndependentTrial: trialButton ? () => {
        if (frame === active && current(own)) open('quiz', trialButton, true);
      } : null,
      request(operation,data){
        if (frame !== active) throw Error('請重新開啟考卷。');
        return request(own,operation,{...data,kind:active.dataset.kind,...(independentTrial ? {independentTrial:true} : {})});
      },
    };
  }
  root.GiftedFormalExam={ready,mount,close,transport};
})(window);
