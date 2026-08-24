#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const braceStart = html.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = braceStart; i < html.length; i += 1) {
    const char = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return '';
}

check(html.includes('ebook_pending_tasks_app.js?v=20260822_gifted_batch_makeup_auto_link_v1'), 'pending UMD module must load with the gifted batch makeup cache bust before the app');
check((html.match(/class="tab-item/g) || []).length === 4, 'student view must have exactly four tabs');
check(html.includes('id="tab-pending" onclick="switchTab(3)"'), 'pending tab must retain numeric switchTab compatibility at index 3');
check(html.includes('id="tab-content-3"'), 'pending tab content is missing');

const switchTab = extractFunction('switchTab');
check(switchTab.includes('[0, 1, 2, 3]'), 'switchTab must accept the original 0/1/2 indexes plus pending index 3');
check(switchTab.includes("getElementById('tab-content-3')"), 'switchTab must show/hide pending content');

const normalizePreview = extractFunction('normalizeDashboardDraftPreviewPayload');
check(normalizePreview.includes("rawKind === 'pending' || rawKind === 'pendingTasks'"), 'draft preview must accept kind=pending and kind=pendingTasks');
check(normalizePreview.includes('normalizePreviewTasks'), 'draft pending tasks must use the pure preview normalizer');
check(normalizePreview.includes('reserveTime: sanitizeDashboardDraftPreviewText(post.reserveTime)'), 'draft DailyPosts must preserve sanitized reserveTime for timing parity');
const enterPreview = extractFunction('enterDashboardDraftPreview');
check(enterPreview.includes("switchTab(3)"), 'pending draft preview must open the pending tab');
check(enterPreview.includes("status: 'ready'"), 'draft preview must use an explicit local ready policy');
check(enterPreview.includes('showPending: true') && enterPreview.includes('loginReminder: true'), 'local draft preview must default both pending switches to true');
check(enterPreview.includes('previewReminderDueAll:'), 'draft preview must mark its no-date due fixture with an explicit local-only flag');

const postAction = extractFunction('doPostAction');
check(postAction.includes('isDashboardDraftPreviewMode'), 'all draft-preview writes must remain blocked');
check(postAction.includes('Dashboard 草稿預覽不允許寫入正式資料'), 'draft write block must remain explicit');
check(!/pendingDemo|pending-demo-query|demoPending/.test(html), 'production demo query switches must not be added');

const normalizePolicy = extractFunction('normalizeEbookPendingPolicyPayload');
check(normalizePolicy.includes("payload.success === true && payload.status === 'ready' && Array.isArray(payload.items)"), 'callable policy must accept only the fixed ready schema');
check(normalizePolicy.includes('showPending: payload.showPending === true'), 'showPending must stay hidden until the server explicitly publishes it');
check(normalizePolicy.includes("typeof payload.loadedAt === 'number'"), 'ready policy loadedAt must be an explicit server number');
check(!normalizePolicy.includes('Date.now'), 'reminder policy must not substitute the device clock');
check(normalizePolicy.includes('payload.reminderDueAt <= loadedAt'), 'reminder due time must not be later than the server load time');
check(normalizePolicy.includes('explicitDueDateKey === dueAtDateKey'), 'server due date key must match the Asia/Taipei date derived from due time');
check(normalizePolicy.includes('loginReminder: loginReminder'), 'login reminder must require both explicit publication flags');
check(normalizePolicy.includes('reminderDue: loginReminder && payload.reminderDue === true && reminderDueAt > 0 && hasTrustedDueDate'), 'red state must accept only a complete trusted due policy');
const loadPolicy = extractFunction('loadEbookPendingTaskPolicy');
check(loadPolicy.includes("httpsCallable('getEbookPendingTaskPolicy')"), 'student policy must come from the authenticated callable');
check(loadPolicy.includes("status: 'unavailable'"), 'policy errors must fail closed');
const apiFactory = extractFunction('createApiMethods');
check((apiFactory.match(/loadEbookPendingTaskPolicy\(\)/g) || []).length >= 2, 'login and manual refresh must each request a fresh policy');
check(apiFactory.includes('res.pendingPolicy = loaded[1]'), 'fresh policy must overwrite the view policy');
check(!apiFactory.includes('!ebookGodSessionId || isStudentPreviewMode'), 'manual refresh must not exclude teacher god sessions from the scoped pending policy');
check(apiFactory.includes('const shouldReloadPendingPolicy = !!ebookAuthSessionInfo'), 'student, student preview, and teacher god sessions must refresh the same scoped pending policy');
check(!apiFactory.includes('getTeacherGodHiddenPendingPolicy()'), 'teacher god mode must not replace the student pending tab with a hidden policy');
const enterGodSession = extractFunction('enterEbookGodSession');
check(enterGodSession.includes('session.pendingPolicy = await loadEbookPendingTaskPolicy()'), 'student preview and teacher god mode must load the same scoped policy after custom-token sign-in');
check(extractFunction('renewEbookGodSession').includes('ebookGodSessionInfo.pendingPolicy = previousPendingPolicy'), 'heartbeat renewals must preserve the already loaded preview policy');

const scheduler = extractFunction('schedulePendingTasksRecompute');
check(scheduler.includes('Promise.resolve().then'), 'realtime pending recompute must be microtask-coalesced');
check(!scheduler.includes(".on('value'"), 'pending recompute must not add a listener');
check(html.includes('schedulePendingTasksRecompute();'), 'existing realtime callbacks must schedule pending recompute');

const emergency = extractFunction('checkEmergency');
const closeEmergency = extractFunction('closeEmergencyModal');
const showNextEmergency = extractFunction('showNextPopupAnnouncement');
check(emergency.includes('return showNextPopupAnnouncement()') && showNextEmergency.includes('return true'), 'emergency check must report that the popup queue has priority');
check(closeEmergency.includes('showNextPopupAnnouncement'), 'pending reminder must wait until every queued popup is closed');
const pendingReminder = extractFunction('maybeShowPendingEntryReminder');
const pendingIdentity = extractFunction('getPendingReminderSessionIdentity');
const pendingRender = extractFunction('renderPendingTasks');
check(html.includes('outline: 4px solid rgba(225, 29, 72, 0);'), 'pending target highlight must return to transparent red instead of flashing the old blue outline');
check(!html.includes('outline: 4px solid rgba(37, 99, 235, 0.35);'), 'pending target highlight must not retain a blue fallback outline after the red pulse');
check(pendingReminder.includes('pendingReminderShownSessionIdentity'), 'pending reminder must be limited to one per login session');
check(pendingReminder.includes('wasPendingReminderShownInBrowserSession'), 'a same-tab page reload must not repeat the same due-slot reminder');
check(pendingReminder.includes('markPendingReminderShownInBrowserSession'), 'shown reminders must persist for the current browser-tab session');
check(pendingReminder.includes('gData.pendingPolicy.loginReminder === false'), 'loginReminder=false must suppress reminder styling and popup');
check(pendingReminder.includes('getReminderDueItems(pendingTasksState)'), 'popup count must use only server-due items');
check(pendingReminder.includes("'溫馨小提醒'"), 'pending popup title must use the approved neutral wording');
check(pendingReminder.includes("'還有 ' + reminderDueItems.length + ' 項課務尚待完成，記得儘快處理喔！'"), 'pending popup must use the approved fixed reminder copy');
check(pendingReminder.includes('swalAlert(') && !pendingReminder.includes('Swal.fire'), 'pending popup must use the shared swalAlert wrapper');
check(pendingReminder.includes("'查看待完成'"), 'pending popup button must clearly navigate to pending');
check(pendingReminder.includes("iconColor: '#e11d48'") && pendingReminder.includes("confirmButtonColor: '#e11d48'"), 'pending popup icon and action must use the warning red');
check(html.includes('.pending-reminder-swal') && html.includes('.pending-reminder-swal-title'), 'pending popup must have a scoped red warning frame and title');
check(pendingReminder.includes('switchTab(3)'), 'confirmed pending popup must open the pending tab');
check(!pendingReminder.includes('.slice(') && !pendingReminder.includes('neutralLabel'), 'pending popup must not enumerate or shame individual tasks');
check(!pendingReminder.includes('LINE') && !pendingReminder.includes('Date.now'), 'popup eligibility must not depend on LINE or device time');
check(!pendingIdentity.includes('expiresAt'), 'token renewal must not create a second reminder in the same login session');
const directLoginBlock = apiFactory.slice(apiFactory.indexOf('getStudentData:'), apiFactory.indexOf('getStudentDataByAdmin:'));
check(!directLoginBlock.includes('clearPendingReminderBrowserSessionMarks()'), 'same-tab reload and re-authentication must retain the current due-slot reminder marker');
check(pendingRender.includes('gData.pendingPolicy.showPending !== false'), 'showPending=false must hide the pending tab and count');
check(pendingRender.includes('getReminderDueItems(pendingTasksState)'), 'red rendering must use the same due-item classifier as the popup');
check(pendingRender.includes("classList.toggle('is-reminder-due', reminderDue)"), 'render must add and remove red state as due items change');
check(pendingRender.includes('reminderDue ? reminderDueItems.length : items.length'), 'red badge must count due items without hiding future pending items');
check(html.includes('#tab-pending.is-reminder-due') && html.includes('.pending-card.is-reminder-due'), 'due-only red tab and card styles are missing');
check(html.includes('--pending-accent: #f59e0b;') && html.includes('--pending-surface: #fffbeb;'), 'pre-due pending state must use the shared amber palette');
check(html.includes('--pending-ink: #6f2f08;'), 'pending amber state must use the accessible warm-brown ink token');
check(html.includes('#tab-pending.active:not(.is-reminder-due)') && html.includes('var(--pending-accent-light)'), 'pre-due pending tab must use amber independently of the subject theme');
check(html.includes('background: linear-gradient(135deg, var(--pending-accent-light) 0%, var(--pending-accent) 100%);'), 'pre-due pending actions must use the accessible shared amber palette');
check(html.includes('color: var(--pending-ink);'), 'amber actions and headings must use readable warm-brown text');
check(html.includes('.pending-action-btn.secondary') && html.includes('background: #fff7e0;'), 'secondary paper actions must use a quieter pale-amber hierarchy');
check(html.includes("<div class='pending-card-status'>記得儘快處理</div>"), 'due cards must use the approved natural reminder copy');
check(!html.includes("<div class='pending-card-status'>提醒時間已到</div>"), 'due cards must not expose the mechanical reminder-time status');
check(html.includes('.pending-card.is-reminder-due .pending-action-btn'), 'due-card actions must use the same reminder color family as the card state');
check(html.includes('background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);'), 'due actions must keep white text on the accessible deep-red gradient');
check(html.includes('background: linear-gradient(180deg, #fff 0%, #fff1f2 100%);'), 'due cards must replace the subject tint with the reminder tint');

const writableExamSource = extractFunction('isPendingExamSourceClassWritable');
check(writableExamSource.includes('getHomeworkDoneCourseAliasKey'), 'exam writeability must allow only current class or an explicit natural-advanced cohort alias');
const pendingHelpers = extractFunction('getPendingTaskHelpers');
check(pendingHelpers.includes('isExamSourceClassWritable: isPendingExamSourceClassWritable'), 'pending derivation must enforce the exam-source writeability helper');
check(pendingHelpers.includes('getLegacyPendingSkipSourceClassKeys'), 'pending derivation must expose the signed same-grid skip compatibility helper');
check(pendingHelpers.includes('EbookPromotionApp.getLineageKey'), 'cross-class skip compatibility must be bounded by the verified promotion lineage');
check(extractFunction('buildPendingTasksForCurrentView').includes('cohortHomeworkDoneRoot: gData.cohortHomeworkDoneRoot || null'), 'pending done state must receive the class-scoped cohort root');
check(extractFunction('buildPendingTasksForCurrentView').includes('studentKeysByClassKey: gData.studentKeysByClassKey || null'), 'pending done state must receive verified class-scoped student keys');
check(extractFunction('buildPendingTasksForCurrentView').includes('sessionPosts: gData.pendingSessionPosts || gData.dailyPost || []'), 'pending timing must receive every row already returned by the public scoped snapshot before the local display filter');
check(extractFunction('rebuildDailyPostsFromScopedData').includes('gData.pendingSessionPosts = filterItemsByStudentEnrollmentDate'), 'realtime DailyPost rebuild must keep a separate enrollment-scoped timing list');
check(extractFunction('rebuildDailyPostsFromScopedData').includes('gData.dailyPostSourceRoot = postsObj || {}'), 'realtime DailyPost rebuild must refresh the full source root used by date anchors');
check(extractFunction('remapDailyPostGrades').includes('gData.pendingSessionPosts || []'), 'grade remapping must cover future timing posts as well as visible DailyPosts');
check(!extractFunction('getHomeworkDateCandidates').includes('new Date().getFullYear'), 'manual homework date filtering must use selected full-date anchors instead of the device wall-clock year');

check(html.includes("data-pending-post-anchor='1'"), 'daily posts need exact pending anchors');
check(html.includes("data-pending-exam-anchor='1'"), 'exam cards need exact ExamID anchors');
check(html.includes("data-pending-makeup-result-anchor='1'"), 'makeup result widget needs an exact anchor');
check(html.includes("buildPendingExamAnchorAttrs('data-pending-paper-anchor'"), 'explicitly mapped makeup paper section needs an exact ExamID anchor');
check(html.includes('resolveGiftedScienceMakeupExamForPost('), 'legacy gifted-science batch posts must render an exact inferred makeup-paper anchor when the prior exam is unique');
check(html.includes("buildPendingExamAnchorAttrs('data-pending-exam-paper-anchor'"), 'original quiz section needs an exact ExamID anchor');
const makeupExtra = extractFunction('buildPostMakeupExtra');
const postInfoBlock = extractFunction('renderPostInfoBlock');
check(makeupExtra.includes("\"<div class='info-subsection'\" + pendingPaperAttr"), 'mapped makeup paper anchor must be attached only to the question subsection');
check(!postInfoBlock.includes("buildPendingExamAnchorAttrs('data-pending-paper-anchor'"), 'mapped makeup paper anchor must not highlight the whole makeup block');
check((makeupExtra.match(/pendingPaperAttr/g) || []).length === 2, 'only the makeup question subsection may carry the exact paper anchor');
const originalPaperIdentity = extractFunction('getPostPendingExamPaperIdentity');
const mappedQuizIdentity = extractFunction('getPostMappedQuizIdentity');
const quizFields = extractFunction('buildPostQuizFields');
check(mappedQuizIdentity.includes('quiz.slot2Exam') && mappedQuizIdentity.includes('quiz.slot1Exam'), 'each quiz slot must resolve its own persisted ExamID mapping');
check(mappedQuizIdentity.includes('mappedSource !== postSource'), 'quiz mappings from another source class must fail closed');
check(originalPaperIdentity.includes('getPostMappedQuizIdentity(postData, index)'), 'exact per-slot mapping must outrank legacy same-date inference');
check(originalPaperIdentity.includes('getPostLineExamType(quizLines[index] || "")'), 'a late-created same-day exam must be narrowed by the paper slot exam type');
check(originalPaperIdentity.includes('[exam && exam.date, exam && exam.exam, exam && exam.title]'), 'late ExamID inference must inspect the grade header and exam title together');
check(originalPaperIdentity.includes('if (exams.length !== 1) return null'), 'multiple quiz ExamIDs must fail closed instead of locating the first paper');
check(extractFunction('getPostLineExamType').includes('return "複習考"'), 'review exams must participate in the same class/date/type late-link contract');
check(quizFields.includes('getPostPendingExamPaperIdentity(postData, index)'), 'two question papers must each render an exact independent anchor');
const findTarget = extractFunction('findPendingTargetElement');
check(findTarget.includes('pendingTargetMatchesExam'), 'pending navigation must match exact exam identity');
check(findTarget.includes("examAnchor.querySelector('.score-report-section') || null"), 'absence navigation must highlight only the red score-report box');
check(findTarget.includes("target.section === 'makeup-paper' || target.section === 'exam-paper'"), 'paper navigation must distinguish exact makeup and original-exam sections');
check(!findTarget.includes("querySelector('[data-pending-paper-anchor]') || postAnchor"), 'paper navigation must never fall back to the whole DailyPost');
check(!findTarget.includes('querySelector("#" +'), 'pending navigation must not interpolate untrusted IDs into selectors');

const pendingRenderActions = extractFunction('renderPendingTasks');
check(pendingRenderActions.includes("task.kind === 'makeup_result'") && pendingRenderActions.includes("'查看補考卷'"), 'makeup-result cards must keep the report action and expose only the exact makeup-paper secondary action');
check(!pendingRenderActions.includes('查看原考試'), 'makeup-result cards must not retain the old original-exam secondary action');
check(pendingRenderActions.includes("task.kind === 'absence'") && pendingRenderActions.includes('getPendingAbsencePaperActionLabel(task)'), 'absence cards must expose their exact original exam-paper action');
const absencePaperLabel = extractFunction('getPendingAbsencePaperActionLabel');
check(absencePaperLabel.includes('查看鑑定考卷') && absencePaperLabel.includes('查看複習考卷') && absencePaperLabel.includes('查看小考卷'), 'absence paper labels must reflect the requested exam types');
check(absencePaperLabel.includes('查看隨堂考卷') && absencePaperLabel.includes('查看回家練習卷'), 'existing special exam types must not be mislabeled as a small quiz');
const exactPaperTarget = extractFunction('isPendingExactPaperTarget');
check(exactPaperTarget.includes('target.dailyPostId') && exactPaperTarget.includes('target.sourceClassKey') && exactPaperTarget.includes('target.examId'), 'paper buttons must require exact post, source class, and ExamID identity');

const showDone = extractFunction('shouldShowHomeworkDoneButton');
check(!showDone.includes('isTransferFormerClass'), 'verified former-class homework may expose the narrow done button');
const submitDone = extractFunction('submitHomeworkDone');
check(submitDone.includes('getHomeworkDoneDomKey(item) === homeworkDoneDomKey'), 'homework completion must resolve one exact rendered post');
check(submitDone.includes('dailyPostId: (post && (post.dailyPostId || post.id)) || ""'), 'homework completion must send the exact RTDB row key, not only an embedded post id');
check(submitDone.includes('sourceItemId: (post && (post.id || post.dailyPostId)) || ""'), 'homework completion must retain the embedded source item id when available');
check(submitDone.includes('sourceClassName: sourceClassName'), 'homework completion must retain the exact source class');
check(submitDone.includes('sourceClassKey: (post && (post.storedClassKey || post.sourceClassKey)) || safeKey(sourceClassName)'), 'homework completion must retain the exact source class key with a source-name fallback');
check(submitDone.includes('schedulePendingTasksRecompute();'), 'successful done flow must remove the local pending task immediately');
check(extractFunction('getHomeworkDoneRecordForPost').includes('resolveHomeworkDoneRecord'), 'rendered done buttons and the pending tab must share the legacy-alias-safe resolver');
check(submitDone.includes('gData.cohortHomeworkDoneRoot[sourceClassKey][studentKey][dateKey] = doneRecord'), 'successful done flow must update the exact local class-scoped record');
const localWriteClass = extractFunction('getHomeworkDoneLocalWriteClassKey');
check(localWriteClass.includes('isSamePendingSourceClass'), 'only an explicit natural-advanced cohort alias may redirect the local completion state to the current class');
check(localWriteClass.includes('post && post.isTransferFormerClass'), 'an explicit transfer must override promotion-alias redirect behavior');
check(extractFunction('mergeDailyPostClassNodeByKeys').includes('dailyPostId: postKey'), 'merged transfer posts must preserve the original RTDB row key');
check(html.includes("data-post-id='\" + escapeHtmlAttr(post.dailyPostId || post.id || '')"), 'precise post anchors must use the RTDB row key');

check(html.includes('.pending-unavailable'), 'policy-unavailable UI is missing');
check(html.includes('這次不會顯示數量'), 'unavailable policy must not present a false zero');
check(html.includes('@media (max-width: 600px)'), 'four-tab/pending mobile layout is missing');
check(html.includes('min-height: 44px;') && html.includes('.pending-action-btn { flex: 1 1 120px; }'), 'pending actions must retain 44px touch targets and wrapping at mobile width');
check(html.includes('.score-btn {') && html.includes('min-width: 88px;') && html.includes('min-height: 44px;'), 'the focused absence-report submit action must remain a 44px touch target after wrapping');

const rememberFeedbackJob = extractFunction('rememberAdminFeedbackJobForDashboard');
check(rememberFeedbackJob.includes('browserIndexSaved = false'), 'background feedback jobs must track local progress-index persistence failures');
check(rememberFeedbackJob.includes('return { data: data, browserIndexSaved: browserIndexSaved }'), 'background feedback job persistence status must be returned to the caller');
check(html.includes('但此瀏覽器無法保存進度索引'), 'queue UI must not promise Dashboard progress visibility when localStorage persistence fails');

async function checkExactFormerHomeworkSubmitBehavior() {
  let capturedForm = null;
  let successHandler = null;
  let recomputeCount = 0;
  const button = { disabled: false, innerText: '我已完成本次作業', classList: { add() {} } };
  const hint = { innerText: '' };
  const post = {
    id: 'embedded-post-id',
    dailyPostId: 'rtdb-row-key',
    date: '2026-08-09',
    className: '114原班',
    storedClassKey: '114原班_key',
    storedClassName: '114原班',
    sourceClassKey: '114原班_key',
    sourceStudentKey: 'old_student_key',
    isTransferFormerClass: true,
  };
  const runner = {
    withSuccessHandler(handler) { successHandler = handler; return runner; },
    withFailureHandler() { return runner; },
    submitHomeworkDone(form) {
      capturedForm = form;
      successHandler({ success: true, time: '2026/08/10 16:00' });
    },
  };
  const context = {
    gData: {
      className: '115現班',
      studentName: '學生甲',
      foundUserKey: 'student_key',
      dailyPost: [post],
      homeworkDone: {},
      studentKeysByClassKey: { '115現班': ['student_key'], '114原班_key': ['old_student_key'] },
      cohortHomeworkDoneRoot: { '114原班_key': { old_student_key: {} } },
    },
    ebookAuthSessionInfo: null,
    confirmStudentPreviewAction: async () => true,
    getHomeworkDoneDomKey: item => item === post ? 'exact-dom-key' : '',
    getStudentActionPostSourceClassName: () => '114原班',
    shouldUseHomeworkDoneFlowForPost: () => true,
    getPostHomeworkText: () => '完成講義第 3 頁',
    getHomeworkDoneDateKey: () => 'date_key',
    getHomeworkDoneLocalWriteClassKey: () => post.storedClassKey,
    getHomeworkDoneLocalWriteStudentKey: () => post.sourceStudentKey,
    safeKey: value => String(value || '').replace(/\s+/g, '_'),
    schedulePendingTasksRecompute: () => { recomputeCount += 1; },
    swalAlert: () => {},
    document: {
      getElementById(id) {
        if (id === 'homework-done-btn-exact-dom-key') return button;
        if (id === 'homework-done-hint-exact-dom-key') return hint;
        return null;
      },
    },
    google: { script: { run: runner } },
  };
  vm.createContext(context);
  vm.runInContext(`async ${submitDone}`, context);
  await context.submitHomeworkDone('exact-dom-key');
  check(capturedForm && capturedForm.dailyPostId === 'rtdb-row-key', 'submit behavior must send the RTDB row key');
  check(capturedForm && capturedForm.sourceItemId === 'embedded-post-id', 'submit behavior must send the embedded source item id');
  check(capturedForm && capturedForm.sourceClassKey === '114原班_key', 'submit behavior must send the former source class key');
  check(capturedForm && capturedForm.sourceClassName === '114原班', 'submit behavior must send the former source class name');
  check(context.gData.cohortHomeworkDoneRoot['114原班_key'].old_student_key.date_key.status === 'done', 'success behavior must update only the exact historical-key done record');
  check(context.gData.cohortHomeworkDoneRoot['114原班_key'].old_student_key.date_key.sourceClassKey === '114原班_key', 'optimistic done state must retain source class metadata');
  check(context.gData.cohortHomeworkDoneRoot['114原班_key'].old_student_key.date_key.sourceItemId === 'embedded-post-id', 'optimistic done state must retain exact post metadata');
  check(context.gData.cohortHomeworkDoneRoot['114原班_key'].old_student_key.date_key.dailyPostId === 'rtdb-row-key', 'optimistic done state must retain the RTDB row key');
  check(recomputeCount === 1, 'success behavior must recompute pending tasks once');
}

async function checkPendingReminderBehavior() {
  let alertCalls = 0;
  let openedTab = null;
  const persistedReminderIdentities = new Set();
  const context = {
    pendingEntryNoticeReady: true,
    pendingEntryReminderHandled: false,
    activeEmergencyAnnouncement: null,
    isAdminMode: false,
    isDashboardDraftPreviewMode: false,
    gData: { pendingPolicy: { loginReminder: true } },
    pendingTasksState: { status: 'ready', items: [{ taskId: 'due-task', title: 'private title' }] },
    pendingReminderShownSessionIdentity: '',
    getPendingReminderDeliveryIdentity: () => 'stable-login-session|due-slot',
    wasPendingReminderShownInBrowserSession: identity => persistedReminderIdentities.has(identity),
    markPendingReminderShownInBrowserSession: identity => persistedReminderIdentities.add(identity),
    window: { EbookPendingTasks: { getReminderDueItems: () => [{ taskId: 'due-task' }] } },
    swalAlert(title, text, icon, confirmText, options) {
      alertCalls += 1;
      check(title === '溫馨小提醒', 'behavior popup title must remain neutral');
      check(!text.includes('private title'), 'behavior popup must not expose individual task details');
      check(icon === 'warning' && confirmText === '查看待完成', 'behavior popup must use the expected warning action');
      check(options && options.iconColor === '#e11d48' && options.confirmButtonColor === '#e11d48', 'behavior popup must apply warning red options through swalAlert');
      return Promise.resolve({ isConfirmed: true });
    },
    switchTab(index) { openedTab = index; },
  };
  vm.createContext(context);
  vm.runInContext(pendingReminder, context);
  context.maybeShowPendingEntryReminder();
  await Promise.resolve();
  await Promise.resolve();
  context.maybeShowPendingEntryReminder();
  await Promise.resolve();
  check(alertCalls === 1, 'one login session must show the due popup only once');
  check(openedTab === 3, 'confirming the due popup must open the pending tab');

  context.pendingEntryReminderHandled = false;
  context.pendingReminderShownSessionIdentity = '';
  context.maybeShowPendingEntryReminder();
  await Promise.resolve();
  check(alertCalls === 1, 'the same due slot must remain suppressed after a same-tab page reload');

  context.pendingEntryReminderHandled = false;
  context.pendingReminderShownSessionIdentity = '';
  context.getPendingReminderDeliveryIdentity = () => 'stable-login-session|next-due-slot';
  context.maybeShowPendingEntryReminder();
  await Promise.resolve();
  check(alertCalls === 2, 'a later trusted server due slot may show one new reminder in the same browser tab');

  const alertsBeforeNeutralCheck = alertCalls;
  const neutralContext = {
    pendingEntryNoticeReady: true,
    pendingEntryReminderHandled: false,
    activeEmergencyAnnouncement: null,
    isAdminMode: false,
    isDashboardDraftPreviewMode: false,
    gData: { pendingPolicy: { loginReminder: true } },
    pendingTasksState: { status: 'ready', items: [{ taskId: 'future-task' }] },
    pendingReminderShownSessionIdentity: '',
    getPendingReminderDeliveryIdentity: () => 'neutral-session|future-slot',
    wasPendingReminderShownInBrowserSession: () => false,
    markPendingReminderShownInBrowserSession: () => {},
    window: { EbookPendingTasks: { getReminderDueItems: () => [] } },
    swalAlert() { alertCalls += 1; return Promise.resolve({ isConfirmed: true }); },
    switchTab() {},
  };
  vm.createContext(neutralContext);
  vm.runInContext(pendingReminder, neutralContext);
  neutralContext.maybeShowPendingEntryReminder();
  await Promise.resolve();
  check(alertCalls === alertsBeforeNeutralCheck, 'pre-due items must not show a login popup');
  check(neutralContext.pendingEntryReminderHandled === false, 'pre-due state must remain eligible for a later trusted policy refresh');
}

function checkLocalWriteClassRouting() {
  const context = {
    gData: { className: '115國二自然超前班' },
    safeKey: value => String(value || ''),
    isSamePendingSourceClass: (left, right) => left === '114國一自然超前班' && right === '115國二自然超前班',
  };
  vm.createContext(context);
  vm.runInContext(localWriteClass, context);
  check(
    context.getHomeworkDoneLocalWriteClassKey({ storedClassKey: '114國一自然超前班', isTransferFormerClass: false }) === '115國二自然超前班',
    'natural-advanced promotion aliases must keep the deployed current-class write location'
  );
  check(
    context.getHomeworkDoneLocalWriteClassKey({ storedClassKey: '114國一自然超前班', isTransferFormerClass: true }) === '114國一自然超前班',
    'a true transfer within the same cohort alias must write the exact former source class'
  );
  check(
    context.getHomeworkDoneLocalWriteClassKey({ storedClassKey: '114真正轉班舊班', isTransferFormerClass: true }) === '114真正轉班舊班',
    'a true transfer must continue to write the exact former source class'
  );
}

function checkPendingNavigationBehavior() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction('pendingTargetMatchesPost'), context);
  vm.runInContext(extractFunction('pendingTargetMatchesExam'), context);
  vm.runInContext(exactPaperTarget, context);

  const scoreReportBox = { marker: 'score-report-box' };
  let currentScoreReportBox = scoreReportBox;
  const examCard = {
    dataset: { examId: 'exam-1', storedExamId: 'stored-1', examColIndex: '7' },
    querySelector(selector) {
      if (selector === '.score-report-section') return currentScoreReportBox;
      return null;
    },
  };
  const originalPaper = {
    dataset: { examId: 'exam-1', storedExamId: 'stored-1', examColIndex: '7' },
    querySelector() { return null; },
  };
  const makeupPaper = {
    dataset: { examId: 'stored-1', storedExamId: 'stored-1', examColIndex: '' },
    querySelector() { return null; },
  };
  const postAnchor = {
    dataset: { postId: 'post-1', sourceClassKey: 'class-1', storedClassKey: 'class-1', postDate: '2026-08-02' },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === '[data-pending-exam-anchor]') return [examCard];
      if (selector === '[data-pending-exam-paper-anchor]') return [originalPaper];
      if (selector === '[data-pending-paper-anchor]') return [makeupPaper];
      return [];
    },
  };
  context.document = {
    querySelectorAll(selector) {
      if (selector === '[data-pending-post-anchor]') return [postAnchor];
      if (selector === '[data-pending-exam-anchor]') return [examCard];
      return [];
    },
  };
  vm.runInContext(findTarget, context);

  const absenceTarget = {
    dailyPostId: 'post-1', sourceClassKey: 'class-1', postDate: '2026-08-02',
    examId: 'exam-1', storedExamId: 'stored-1', colIndex: 7, section: 'absence-report',
  };
  check(context.findPendingTargetElement(absenceTarget) === scoreReportBox, 'absence navigation behavior must return only the exact red report box');
  currentScoreReportBox = null;
  check(context.findPendingTargetElement(absenceTarget) === null, 'absence navigation must fail closed when the red report box is absent');
  currentScoreReportBox = scoreReportBox;

  const originalPaperTarget = Object.assign({}, absenceTarget, { section: 'exam-paper' });
  check(context.findPendingTargetElement(originalPaperTarget) === originalPaper, 'absence paper action must resolve the exact original quiz anchor');
  check(context.findPendingTargetElement(Object.assign({}, originalPaperTarget, { examId: '', storedExamId: '' })) === null, 'original paper action without ExamID must fail closed');

  const makeupPaperTarget = Object.assign({}, absenceTarget, { section: 'makeup-paper' });
  check(context.findPendingTargetElement(makeupPaperTarget) === makeupPaper, 'makeup-result paper action must resolve the exact mapped makeup anchor');
  check(context.findPendingTargetElement(Object.assign({}, makeupPaperTarget, { examId: 'wrong', storedExamId: 'wrong' })) === null, 'wrong ExamID must never fall back to another makeup paper or the whole post');

  const labelContext = {};
  vm.createContext(labelContext);
  vm.runInContext(absencePaperLabel, labelContext);
  check(labelContext.getPendingAbsencePaperActionLabel({ title: '8/2 小考 生物' }) === '查看小考卷', 'ordinary absence uses the small-quiz paper label');
  check(labelContext.getPendingAbsencePaperActionLabel({ title: '8/2 鑑定考 生物' }) === '查看鑑定考卷', 'identification absence uses the identification-paper label');
  check(labelContext.getPendingAbsencePaperActionLabel({ title: '8/2 複習考 生物' }) === '查看複習考卷', 'review absence uses the review-paper label');
  check(labelContext.getPendingAbsencePaperActionLabel({ title: '8/2 隨堂考 生物' }) === '查看隨堂考卷', 'in-class absence keeps the in-class paper label');
  check(labelContext.getPendingAbsencePaperActionLabel({ title: '8/2 回家練習卷 生物' }) === '查看回家練習卷', 'take-home absence keeps the take-home paper label');
}

checkLocalWriteClassRouting();
checkPendingNavigationBehavior();

checkPendingReminderBehavior().then(checkExactFormerHomeworkSubmitBehavior).then(() => {
  if (failures.length) {
    console.error('eBook pending tasks integration smoke failed:');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('eBook pending tasks integration smoke passed');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
