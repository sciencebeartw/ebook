(function(root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GiftedAnswerOutbox = factory();
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const MAX_BYTES = 64 * 1024;
  const fail = code => { throw Error(code); };
  const copy = value => JSON.parse(JSON.stringify(value));
  const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object' ?
    '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
  // 開發用可復原待送佇列。transport每次自行取當前token，本機紀錄不含token／密碼／姓名。
  // 每個瀏覽分頁使用不同tabId；同生不同裝置的修訂衝突仍由後端決定。
  function create({ storage, scope, transport, randomId = () => globalThis.crypto.randomUUID() }) {
    const fields = ['sessionUid', 'planId', 'segmentId', 'scopeRevision', 'tabId'];
    if (!storage || typeof transport !== 'function' || !scope || fields.some(k => typeof scope[k] !== 'string' || !scope[k] || scope[k].length > 300)) fail('OUTBOX_SCOPE_REQUIRED');
    const identity = Object.fromEntries(fields.map(k => [k, scope[k]]));
    const key = 'gifted-answer-outbox-v1:' + fields.map(k => encodeURIComponent(identity[k])).join('|');
    let closed = false, running = false;
    function ensureActive() { if (closed) fail('OUTBOX_CLOSED'); }
    function read() {
      ensureActive();
      let raw; try { raw = storage.getItem(key); } catch { fail('LOCAL_SAVE_FAILED'); }
      if (!raw) return { schema: 'gifted-answer-outbox-v1', scope: identity, draft: null, pending: null, lastReceipt: null };
      if (new TextEncoder().encode(raw).length > MAX_BYTES) fail('LOCAL_RECORD_INVALID');
      let value; try { value = JSON.parse(raw); } catch { fail('LOCAL_RECORD_INVALID'); }
      if (value?.schema !== 'gifted-answer-outbox-v1' || stable(value.scope) !== stable(identity) || !Object.hasOwn(value, 'pending')) fail('LOCAL_RECORD_INVALID');
      if (value.pending) {
        const p = value.pending;
        if (!['draft', 'submit'].includes(p.action) || p.planId !== identity.planId || p.segmentId !== identity.segmentId || p.scopeRevision !== identity.scopeRevision ||
          typeof p.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(p.requestId) ||
          !Number.isSafeInteger(p.expectedRevision) || p.expectedRevision < 0 || !p.answers || typeof p.answers !== 'object' || Array.isArray(p.answers) ||
          Object.keys(p).some(k => !['action', 'planId', 'segmentId', 'scopeRevision', 'requestId', 'expectedRevision', 'answers', 'confirmBlanks'].includes(k))) fail('LOCAL_RECORD_INVALID');
      }
      return value;
    }
    function write(state) {
      const raw = JSON.stringify(state);
      if (new TextEncoder().encode(raw).length > MAX_BYTES) fail('LOCAL_RECORD_TOO_LARGE');
      try { storage.setItem(key, raw); } catch { fail('LOCAL_SAVE_FAILED'); }
    }
    function input(answers, expectedRevision) {
      if (!answers || typeof answers !== 'object' || Array.isArray(answers) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('INVALID_DRAFT');
      return { answers: copy(answers), expectedRevision };
    }
    function saveLocalDraft(answers, expectedRevision) {
      const state = read(); state.draft = input(answers, expectedRevision); write(state);
    }
    function enqueue(action, answers, expectedRevision, confirmBlanks = false) {
      const state = read();
      if (!['draft', 'submit'].includes(action)) fail('INVALID_ACTION');
      if (state.pending || running) fail('PENDING_REQUEST_EXISTS');
      if (state.lastReceipt) fail('FORMAL_ALREADY_SUBMITTED');
      const draft = input(answers, expectedRevision), requestId = randomId();
      if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) fail('INVALID_REQUEST_ID');
      state.draft = draft;
      state.pending = { action, planId: identity.planId, segmentId: identity.segmentId, scopeRevision: identity.scopeRevision,
        requestId, expectedRevision, answers: draft.answers, confirmBlanks: confirmBlanks === true };
      write(state); return copy(state.pending);
    }
    async function flush() {
      ensureActive(); if (running) fail('REQUEST_IN_FLIGHT');
      const state = read(); if (!state.pending) return { status: 'idle' };
      running = true;
      try {
        // 未收到確認以前（含離線／逾時／登入過期／衝突），原requestId與答案都保留。
        const pending = copy(state.pending), result = await transport(copy(pending));
        if (closed) return { status: 'session-closed' };
        const current = read();
        if (stable(current.pending) !== stable(pending)) fail('LOCAL_RECORD_CHANGED');
        if (!Number.isSafeInteger(result?.revision) || result.revision <= pending.expectedRevision ||
          (pending.action === 'submit' && (result.status !== 'submitted' || typeof result.receiptId !== 'string' || !result.receiptId))) fail('SERVER_RECEIPT_INVALID');
        current.pending = null;
        // 網路等待時新填的答案保留，不被較舊的儲存回覆覆蓋。
        if (current.draft && current.draft.expectedRevision === pending.expectedRevision) current.draft.expectedRevision = result.revision;
        if (pending.action === 'submit') current.lastReceipt = { status: result.status, receiptId: result.receiptId, revision: result.revision, submittedAt: result.submittedAt };
        write(current); return { status: pending.action === 'submit' ? 'submitted' : 'saved', result };
      } finally { running = false; }
    }
    // 衝突不自動覆蓋。呼叫端先呈現伺服器版本與本機備份，再讓使用者重新決定。
    async function inspectServer() {
      ensureActive();
      const receipt = await transport({ action: 'receipt', planId: identity.planId, segmentId: identity.segmentId });
      if (closed) return { status: 'session-closed' };
      return { receipt, local: copy(read()) };
    }
    // Only call after showing both versions and an explicit user choice; never auto-merge.
    function resolveConflict(task, choice) {
      ensureActive(); if (running) fail('REQUEST_IN_FLIGHT');
      if (!['server', 'local'].includes(choice) || task?.planId !== identity.planId || task.segmentId !== identity.segmentId ||
        task.scopeRevision !== identity.scopeRevision || !Number.isSafeInteger(task.revision) || task.revision < 0 ||
        !task.answers || typeof task.answers !== 'object' || Array.isArray(task.answers)) fail('SERVER_TASK_INVALID');
      const current = read();
      if (current.draft && task.revision < current.draft.expectedRevision) fail('SERVER_TASK_STALE');
      if (choice === 'local' && task.submission) fail('FORMAL_ALREADY_SUBMITTED');
      if (task.submission && (task.submission.status !== 'submitted' || task.submission.revision !== task.revision || !task.submission.receiptId)) fail('SERVER_RECEIPT_INVALID');
      if (choice === 'local' && !current.draft) fail('LOCAL_DRAFT_REQUIRED');
      current.draft = input(choice === 'server' ? task.answers : current.draft.answers, task.revision);
      current.pending = null;
      current.lastReceipt = task.submission ? copy(task.submission) : null;
      write(current); return copy(current);
    }
    function close({ erase = true } = {}) {
      closed = true;
      if (erase) { try { storage.removeItem(key); } catch { fail('LOCAL_CLEAR_FAILED'); } }
    }
    return { key, snapshot: () => copy(read()), saveLocalDraft, enqueue, flush, inspectServer, resolveConflict, close };
  }
  function clearSession(storage, sessionUid) {
    if (typeof sessionUid !== 'string' || !sessionUid) fail('OUTBOX_SCOPE_REQUIRED');
    const prefix = 'gifted-answer-outbox-v1:' + encodeURIComponent(sessionUid) + '|';
    try {
      const keys = [];
      for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(prefix)) keys.push(key); }
      for (const key of keys) storage.removeItem(key);
      return keys.length;
    } catch { fail('LOCAL_CLEAR_FAILED'); }
  }
  return { create, clearSession };
});
