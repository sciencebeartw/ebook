#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const EBOOK_DIR = path.resolve(__dirname, '..');
const ADMIN_DIR = path.resolve(EBOOK_DIR, '..');
const INDEX_PATH = path.join(EBOOK_DIR, 'index.html');
const FUNCTIONS_PATH = path.join(ADMIN_DIR, 'functions', 'index.js');
const DATABASE_RULES_PATH = path.join(ADMIN_DIR, 'firebase-rules', 'database.rules.json');
const STORAGE_RULES_PATH = path.join(ADMIN_DIR, 'firebase-rules', 'storage.rules');
const LOCAL_FIREBASE_CONFIG_PATH = path.join(EBOOK_DIR, 'firebase.json');

const html = fs.readFileSync(INDEX_PATH, 'utf8');
const functionsSource = fs.readFileSync(FUNCTIONS_PATH, 'utf8');
const storageRules = fs.readFileSync(STORAGE_RULES_PATH, 'utf8');
const localFirebaseConfig = JSON.parse(fs.readFileSync(LOCAL_FIREBASE_CONFIG_PATH, 'utf8'));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkIncludes(source, fragment, message) {
  check(source.includes(fragment), `${message} (missing: ${fragment})`);
}

function extractBalancedBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Missing marker: ${marker}`);
  const braceStart = source.indexOf('{', start + marker.length);
  if (braceStart === -1) throw new Error(`Missing opening brace after: ${marker}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unterminated block: ${marker}`);
}

function extractFunction(source, name) {
  return extractBalancedBlock(source, `function ${name}`);
}

function extractStorageMatch(matchPath) {
  const marker = `match ${matchPath} {`;
  const start = storageRules.indexOf(marker);
  if (start === -1) throw new Error(`Missing Storage match: ${matchPath}`);
  const braceStart = start + marker.length - 1;
  let depth = 0;
  for (let index = braceStart; index < storageRules.length; index += 1) {
    if (storageRules[index] === '{') depth += 1;
    if (storageRules[index] === '}') depth -= 1;
    if (depth === 0) return storageRules.slice(start, index + 1);
  }
  throw new Error(`Unterminated Storage match: ${matchPath}`);
}

function parseCommentedJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(line => !/^\s*\/\//.test(line))
    .join('\n');
  return JSON.parse(text);
}

// 1. The eBook must own an isolated named Firebase app and include Auth before use.
const authSdkIndex = html.indexOf('firebase-auth.js');
const appInitIndex = html.indexOf('firebase.initializeApp(firebaseConfig, "ebook")');
check(authSdkIndex !== -1 && appInitIndex !== -1 && authSdkIndex < appInitIndex, 'Firebase Auth SDK must load before named eBook app initialization');
checkIncludes(html, 'firebase.app("ebook")', 'existing named eBook app must be reused');
checkIncludes(html, 'const db = ebookFirebaseApp.database();', 'RTDB must come from the named app');
checkIncludes(html, 'const ebookAuth = ebookFirebaseApp.auth();', 'Auth must come from the named app');
checkIncludes(html, 'const ebookFunctions = ebookFirebaseApp.functions();', 'Functions must come from the named app');
checkIncludes(html, 'const ebookStorage = ebookFirebaseApp.storage();', 'Storage must come from the named app');
check(!/firebase\.(?:database|functions|storage)\(\)/.test(html), 'eBook must not silently use default Firebase database/functions/storage instances');
check(!localFirebaseConfig.database && !localFirebaseConfig.storage, 'eBook repo must not expose legacy RTDB/Storage deployment targets');

// 2. Student login must authenticate through the callable, sign in, then perform one exact student read.
const getStudentData = extractBalancedBlock(html, 'getStudentData: async function');
const loginCallIndex = getStudentData.indexOf("httpsCallable('createEbookStudentSession')");
const customTokenIndex = getStudentData.indexOf('signInWithCustomToken(session.firebaseCustomToken)');
const exactStudentReadIndex = getStudentData.indexOf("executeFirebaseRead(u, '', true, session.className, session.studentKey)");
check(loginCallIndex !== -1 && customTokenIndex > loginCallIndex && exactStudentReadIndex > customTokenIndex, 'student flow must be callable login -> custom-token sign-in -> exact student read');
checkIncludes(getStudentData, 'firebase.auth.Auth.Persistence.NONE', 'student Auth persistence must not survive the page session');
check(!getStudentData.includes("/studentLoginIndex/"), 'main student login flow must not read studentLoginIndex from the browser');
check(!getStudentData.includes("BEAR_SUBJECT + '/students'"), 'main student login flow must not contain a root students fallback');

const executeFirebaseRead = extractFunction(html, 'executeFirebaseRead');
checkIncludes(executeFirebaseRead, 'if (targetClass && targetStudentKey)', 'exact target identity must be required before student data load');
checkIncludes(executeFirebaseRead, '`${BEAR_SUBJECT}/students/${sClass}/${targetStudentKey}`', 'browser student read must target class + student key');
checkIncludes(executeFirebaseRead, "throw new Error('缺少已驗證的學生識別碼", 'class-only reads must fail closed');
const transferIndexLoader = extractFunction(html, 'loadStudentTransferIndexForStudent');
const enrollmentIndexLoader = extractFunction(html, 'loadStudentEnrollmentIndexForStudent');
checkIncludes(transferIndexLoader, 'throw new Error(', 'transfer index read failures must fail closed');
checkIncludes(enrollmentIndexLoader, 'throw new Error(', 'enrollment index read failures must fail closed');

const executeCallSites = [...html.matchAll(/executeFirebaseRead\(([^\n;]*)\)/g)]
  .map(match => match[1])
  .filter(args => !args.includes('studentName, password, bypassPwd'));
check(executeCallSites.length === 3, `expected exactly three authenticated executeFirebaseRead call sites, found ${executeCallSites.length}`);
executeCallSites.forEach(args => {
  check(args.split(',').length >= 5, `executeFirebaseRead call must include target class and student key: ${args}`);
});

const credentialLookup = extractFunction(functionsSource, 'findEbookStudentByCredentials');
checkIncludes(credentialLookup, '`${subjectKey}/studentLoginIndex/${nameKey}`', 'Function login must use the scoped login index');
checkIncludes(credentialLookup, '`${subjectKey}/students/${classKey}/${studentKey}`', 'Function login must verify each exact indexed student');
check(!credentialLookup.includes('`${subjectKey}/students`'), 'Function credential lookup must not read the full students root');
check(
  credentialLookup.indexOf('canonicalizeEbookLoginCandidates') < credentialLookup.indexOf('isStudentLoginMatch'),
  'lifecycle canonical current class must be selected before password verification'
);
const exactAdminStudentLookup = extractFunction(functionsSource, 'findEbookStudent');
checkIncludes(exactAdminStudentLookup, 'matches.length !== 1', 'god session student-name lookup must fail closed on duplicate names');

const createAuthSession = extractFunction(functionsSource, 'createEbookAuthSession');
checkIncludes(createAuthSession, '`${EBOOK_AUTH_SESSION_BASE}/${uid}`', 'server session must be persisted by auth UID');
checkIncludes(createAuthSession, 'ebookAccess: true', 'custom token must carry ebookAccess');
checkIncludes(createAuthSession, 'ebookExpiresAt: expiresAt', 'custom token must carry business-session expiry for Storage');
const createStudentSession = extractBalancedBlock(functionsSource, 'exports.createEbookStudentSession');
checkIncludes(createStudentSession, 'getEbookStudentAuthUid(', 'student login must reuse a stable non-reversible Firebase Auth UID');
checkIncludes(functionsSource, 'exports.pruneExpiredEbookSessions', 'expired eBook sessions must have scheduled cleanup');
checkIncludes(functionsSource, 'admin.auth().deleteUsers(authUids)', 'cleanup must remove ephemeral Firebase Auth users as well as RTDB sessions');

// 3. All student writes must use the authenticated callable and stable request IDs.
checkIncludes(html, 'ebookFunctions.httpsCallable("runEbookStudentAction")', 'student writes must call runEbookStudentAction');
check(!html.includes('const SCRIPT_URLS ='), 'browser must not call the privileged GAS endpoint directly');
checkIncludes(functionsSource, 'exports.runEbookStudentAction', 'runEbookStudentAction callable must be exported');
const runStudentAction = extractBalancedBlock(functionsSource, 'exports.runEbookStudentAction');
checkIncludes(runStudentAction, 'getEbookAuthSessionFromContext(context)', 'student action must resolve server session from Auth context');
checkIncludes(runStudentAction, 'EBOOK_STUDENT_ACTIONS.has(action)', 'student action must use an action allowlist');
checkIncludes(runStudentAction, 'studentName: session.studentName', 'student identity must come from the server session');
checkIncludes(runStudentAction, 'clientRequestId: checked.clientRequestId', 'feedback request ID must be server-validated');
checkIncludes(runStudentAction, 'ebookAccess.normalizeClientRequestId(rawPayload.clientRequestId)', 'non-feedback request IDs must be normalized');
checkIncludes(runStudentAction, 'const writableStudentClassKeys = new Set([', 'student writes must use a separate writable-class allowlist');
checkIncludes(runStudentAction, 'session.safeClassKey', 'student writes must allow the current class');
checkIncludes(runStudentAction, 'ebookAccess.getNaturalAdvancedAliasClassKeys', 'natural promotion aliases must remain writable as one course cohort');
checkIncludes(runStudentAction, '轉班前聯絡簿只供查閱', 'ordinary transfer-history classes must be server-enforced read-only');
checkIncludes(runStudentAction, 'if (action === "changeUserPassword")', 'password changes must revoke the current eBook business session');
checkIncludes(runStudentAction, 'await session.ref.remove()', 'password changes must remove the RTDB session immediately');
checkIncludes(runStudentAction, 'admin.auth().deleteUser(context.auth.uid)', 'password changes must revoke the ephemeral Firebase Auth user');

async function verifyStableStudentRequestId() {
  const captured = [];
  let mode = 'reject';
  let randomSeed = 1;
  const sandbox = {
    window: {
      crypto: {
        getRandomValues(array) {
          for (let index = 0; index < array.length; index += 1) array[index] = randomSeed++;
          return array;
        },
      },
    },
    Uint32Array,
    Math,
    Date,
    JSON,
    isDashboardDraftPreviewMode: false,
    isStudentPreviewMode: false,
    pendingEbookRequestIds: {},
    ebookFunctions: {
      httpsCallable(name) {
        if (name !== 'runEbookStudentAction') throw new Error(`unexpected callable ${name}`);
        return request => {
          captured.push(request);
          return mode === 'success'
            ? Promise.resolve({ data: { result: { success: true } } })
            : Promise.reject(new Error('ambiguous network failure'));
        };
      },
    },
    console: { error() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(extractFunction(html, 'createClientRequestId'), sandbox);
  vm.runInContext(extractFunction(html, 'doPostAction'), sandbox);

  const invoke = () => new Promise(resolve => {
    sandbox.doPostAction('submitFeedback', { targetDate: '2026/07/11', content: 'same payload' }, resolve, resolve);
  });
  await invoke();
  await invoke();
  check(captured[0].data.clientRequestId === captured[1].data.clientRequestId, 'ambiguous student retry must reuse the same clientRequestId');
  mode = 'success';
  await invoke();
  check(captured[1].data.clientRequestId === captured[2].data.clientRequestId, 'successful retry must still send the pending clientRequestId');
  mode = 'reject';
  await invoke();
  check(captured[3].data.clientRequestId !== captured[2].data.clientRequestId, 'a new operation after confirmed success must get a new clientRequestId');
}

// 4. Student Storage writes and rollback must share the same UID/claim/expiry boundary.
checkIncludes(html, "var authUid = ebookAuth.currentUser && ebookAuth.currentUser.uid", 'student upload path must derive UID from current Auth user');
checkIncludes(html, "'uploads/student/' + authUid + '/' + subjectKey", 'student upload must use the scoped UID path');
checkIncludes(html, 'uploadBatchPaths.push(res.path || path)', 'successful upload paths must be retained for rollback');
const uploadHelper = extractFunction(html, 'uploadToFirebase');
checkIncludes(uploadHelper, 'path: path', 'upload helper must return the exact uploaded Storage path');
const cleanupUpload = extractFunction(html, 'cleanupStudentUploadBatch');
checkIncludes(cleanupUpload, 'ebookStorage.ref(path).delete()', 'rollback must delete each uploaded path');
const processUploadQueue = extractFunction(html, 'processUploadQueue');
checkIncludes(processUploadQueue, 'cleanupStudentUploadBatch()', 'feedback write failure must trigger attachment rollback');

const studentStorage = extractStorageMatch('/uploads/student/{sessionUid}/{allPaths=**}');
[
  'request.auth.uid == sessionUid',
  'request.auth.token.ebookAccess == true',
  'request.auth.token.ebookExpiresAt > request.time.toMillis()',
  'isSafeEbookAttachment(15 * 1024 * 1024)',
  'allow update: if false',
  'allow delete:',
].forEach(fragment => checkIncludes(studentStorage, fragment, 'student Storage rule must match the upload/rollback contract'));
const uidCheckCount = (studentStorage.match(/request\.auth\.uid == sessionUid/g) || []).length;
const expiryCheckCount = (studentStorage.match(/ebookExpiresAt > request\.time\.toMillis\(\)/g) || []).length;
check(uidCheckCount >= 2 && expiryCheckCount >= 2, 'both create and delete must require same UID and unexpired eBook claim');

// 5. God sessions must mint/sign in a scoped token and preserve stored/source class on every historical action.
const getGodSession = extractBalancedBlock(functionsSource, 'exports.getEbookGodSession');
checkIncludes(getGodSession, 'includeFirebaseToken', 'god session must opt in to custom-token issuance');
checkIncludes(getGodSession, 'response.firebaseCustomToken = auth.customToken', 'god session response must include scoped custom token');
checkIncludes(getGodSession, 'shouldRefreshFirebaseToken', 'god heartbeat must refresh the Storage expiry claim before it becomes stale');
checkIncludes(getGodSession, 'studentKey: session.studentKey', 'god token session must remain target-student scoped');
const renewGodSession = extractFunction(html, 'renewEbookGodSession');
checkIncludes(renewGodSession, 'includeFirebaseToken: needsFirebaseToken', 'initial god load must request Firebase token');
checkIncludes(renewGodSession, 'ebookAuth.signInWithCustomToken(ebookGodSessionInfo.firebaseCustomToken)', 'god view must sign in before RTDB reads');

const sendGodReplyUi = extractFunction(html, 'sendAdminModeReply');
checkIncludes(sendGodReplyUi, 'context.storedClassName || context.sourceClassName', 'god reply must target the stored feedback class');
const sendGodDirectUi = extractFunction(html, 'sendAdminModeDirectMessage');
checkIncludes(sendGodDirectUi, 'sourceClassName: context.sourceClassName', 'god direct message must target the displayed post source class');
const retiredLegacyDirectUi = extractFunction(html, 'sendDirectStudentMessage');
const retiredLegacyReplyUi = extractFunction(html, 'sendAdminReply');
const retiredLegacyFeedbackWrite = extractFunction(html, 'writeFeedbackDirectToFirebase');
checkIncludes(retiredLegacyDirectUi, 'retireLegacyAdminFeedbackAction()', 'retired built-in admin direct message must route teachers back to Dashboard');
checkIncludes(retiredLegacyReplyUi, 'retireLegacyAdminFeedbackAction()', 'retired built-in admin reply must route teachers back to Dashboard');
check(!retiredLegacyFeedbackWrite.includes('submitFeedback'), 'retired built-in admin UI must not retain a direct feedback write bypass');
const stickerReviewUi = extractFunction(html, 'approveGodSticker');
checkIncludes(stickerReviewUi, 'sourceClassName: context.sourceClassName', 'god sticker review must target the stored/source class');
const stickerAdjustmentUi = extractFunction(html, 'writeGodStickerAdjustment');
checkIncludes(stickerAdjustmentUi, 'sourceClassName: context.sourceClassName', 'god sticker adjustment must target the post source class');
const makeupColorUi = extractFunction(html, 'setGodMakeupResultColor');
checkIncludes(makeupColorUi, 'sourceClassName: (colorReview && colorReview.storedClassName) || context.sourceClassName', 'god makeup color must target the verified result feedback source class');
checkIncludes(makeupColorUi, 'teacherColorCorrection: isColorCorrection', 'god makeup color changes must use the explicit correction contract');
checkIncludes(makeupColorUi, 'expectedCurrentColor: isColorCorrection ? currentColorInfo.hex', 'god makeup color corrections must send the color that was originally displayed');
checkIncludes(makeupColorUi, "createStableEbookRequestId('god-makeup-color-correction'", 'god makeup color correction retries must retain a deterministic idempotency key');
const godAdminActionFn = extractBalancedBlock(functionsSource, 'exports.runEbookGodAdminAction');
checkIncludes(godAdminActionFn, 'payload.teacherColorCorrection === true', 'god admin callable must distinguish color corrections from first registrations');
checkIncludes(godAdminActionFn, 'ebookAccess.normalizeClientRequestId(payload.clientRequestId || payload.requestId)', 'color corrections must require a valid idempotency key server-side');
checkIncludes(godAdminActionFn, 'expectedCurrentColor === colorHex', 'color corrections with no actual change must fail closed server-side');
checkIncludes(godAdminActionFn, 'cachedCurrentColor !== colorHex && !isTeacherColorCorrection', 'an existing cached makeup color must not be overwritten outside the correction contract');
checkIncludes(godAdminActionFn, 'action === "writeMakeupResultColorGas" && gasCode === "color-changed-before-write"', 'stale color corrections must return an actionable refresh message');
const makeupScoreUi = extractFunction(html, 'writeGodMakeupScore');
checkIncludes(makeupScoreUi, 'context.scoreReview.storedClassName || context.sourceClassName', 'god reported-score writeback must prefer stored feedback class');
const directMakeupScoreUi = extractFunction(html, 'writeGodDirectMakeupScore');
checkIncludes(directMakeupScoreUi, 'sourceClassName: context.sourceClassName', 'god direct score writeback must target the historical exam source class');
const scoreCorrectionUi = extractFunction(html, 'writeGodScoreCorrection');
checkIncludes(scoreCorrectionUi, 'teacherScoreCorrection: true', 'god score correction must use the explicit correction contract');
checkIncludes(scoreCorrectionUi, 'expectedCurrentScore: context.currentScore', 'god score correction must send the score value that was originally displayed');
checkIncludes(scoreCorrectionUi, 'createStableEbookRequestId', 'god score correction retries must retain a deterministic idempotency key');
const scoreWriteTargetFn = extractFunction(functionsSource, 'assertEbookScoreWriteTarget');
checkIncludes(scoreWriteTargetFn, 'payload.teacherScoreCorrection === true', 'score write target validation must distinguish corrections from absence writeback');
checkIncludes(scoreWriteTargetFn, 'rawScore !== expectedCurrentScore', 'score correction must reject stale overwrite attempts');
checkIncludes(scoreWriteTargetFn, 'correctionNumber > 100', 'score correction must enforce the 0 to 100 range server-side');

function checkStableGodUi(functionSource, label) {
  check(!/clientRequestId:\s*createClientRequestId\(/.test(functionSource), `${label} must not generate a fresh ID for every retry`);
  check(/context\.(?:clientRequestId|requestId)\s*=\s*context\.(?:clientRequestId|requestId)\s*\|\|\s*createClientRequestId\(/.test(functionSource), `${label} must retain its clientRequestId in context until success`);
  check(/clientRequestId:\s*context\.(?:clientRequestId|requestId)/.test(functionSource), `${label} callable payload must use the retained clientRequestId`);
}
checkStableGodUi(sendGodReplyUi, 'god reply');
checkStableGodUi(sendGodDirectUi, 'god direct message');

const sendGodReplyFn = extractBalancedBlock(functionsSource, 'exports.sendEbookGodReply');
const sendGodDirectFn = extractBalancedBlock(functionsSource, 'exports.sendEbookGodDirectMessage');
check(!sendGodReplyFn.includes('|| `godreply_'), 'god reply Function must reject a missing ID instead of inventing a non-idempotent fallback');
check(!sendGodDirectFn.includes('|| `goddirect_'), 'god direct Function must reject a missing ID instead of inventing a non-idempotent fallback');
checkIncludes(sendGodReplyFn, '${sourceSession.safeClassKey}/${sourceSession.studentKey}/${feedbackKey}', 'god reply must look up the original feedback in its stored class');
checkIncludes(sendGodReplyFn, 'persistEbookAdminFeedbackJob', 'god reply must create a durable background job');
checkIncludes(sendGodDirectFn, 'persistEbookAdminFeedbackJob', 'god direct message must create a durable background job');
check(!sendGodReplyFn.includes('submitEbookFeedbackToGas'), 'god reply must not bypass the durable queue');
check(!sendGodDirectFn.includes('submitEbookFeedbackToGas'), 'god direct message must not bypass the durable queue');
const pendingStickerCheck = extractFunction(functionsSource, 'assertEbookPendingSticker');
checkIncludes(pendingStickerCheck, 'studentFeedbackRef.child(feedbackKey)', 'sticker review must prefer an exact feedback child read');
checkIncludes(pendingStickerCheck, 'candidates.length > 1', 'legacy timestamp-only sticker lookup must fail on ambiguity');

// Chapter ranges such as 「第1-8章」 are not calendar dates; exact exam routing must not misread them as 1/8.
const examLookupSandbox = {};
vm.createContext(examLookupSandbox);
[
  'normalizeEbookExamLookupText',
  'getEbookExamLookupDateParts',
  'ebookExamLookupTextHasDate',
  'ebookExamLookupDateCandidates',
  'ebookFeedbackMatchesExamTitle',
  'ebookExamMatchesTargetDate',
  'isEbookScoreExam',
  'listEbookExamEntries',
  'resolveEbookExamIdentity',
].forEach(name => vm.runInContext(extractFunction(functionsSource, name), examLookupSandbox));
check(examLookupSandbox.ebookExamLookupTextHasDate('生物第1-8章複習考') === false, 'chapter range must not be classified as an exam date');
check(examLookupSandbox.ebookExamLookupDateCandidates('生物第1-8章複習考').length === 0, 'chapter range must not produce 1/8 date candidates');
check(examLookupSandbox.ebookExamLookupTextHasDate('6/20 回家練習卷') === true, 'real M/D date on a homework-practice exam must remain detectable');
check(
  examLookupSandbox.ebookFeedbackMatchesExamTitle(
    { targetExamTitle: '6/20 回家練習卷' },
    { date: '6/20', exam: '回家練習卷' }
  ) === true,
  'dated 回家練習卷 must still resolve to its exact exam'
);
check(
  examLookupSandbox.ebookFeedbackMatchesExamTitle(
    { targetExamTitle: '6/20鑑定考 主題一 基本量測' },
    { date: '6/20鑑定考', examName: '主題一 基本量測' }
  ) === true,
  'date descriptor plus exact exam name must remain a valid full-title identity'
);
check(
  examLookupSandbox.ebookExamMatchesTargetDate({ date: '11/1小考' }, '2026/1/1') === false,
  '1/1 must not match 11/1 by substring'
);
const repairedIdentity = examLookupSandbox.resolveEbookExamIdentity({
  col_5: { date: '7/4小考', examName: '力與平衡、摩擦力木' },
  col_6: { date: '7/4小考', examName: '力與平衡、摩擦力' },
}, {
  requestedColIndex: 5,
  targetDate: '2026/7/4',
  targetExamTitle: '7/4小考 力與平衡、摩擦力',
});
check(
  repairedIdentity.status === 'resolved' && repairedIdentity.colIndex === 6 && repairedIdentity.repaired === true,
  'a unique drift repair must return the verified column instead of preserving the stale column'
);
const duplicateIdentity = examLookupSandbox.resolveEbookExamIdentity({
  col_5: { date: '7/4小考', examName: '力與平衡、摩擦力' },
  col_6: { date: '7/4小考', examName: '力與平衡、摩擦力' },
}, {
  requestedColIndex: 5,
  targetDate: '2026/7/4',
  targetExamTitle: '7/4小考 力與平衡、摩擦力',
});
check(duplicateIdentity.status === 'duplicate', 'duplicate exact identities must fail closed');

// 6. Browser paths and RTDB rules must remain structurally identical.
const database = parseCommentedJson(DATABASE_RULES_PATH).rules;
const subjectRules = database.$subject;
const sessionNeedles = [
  'auth.token.ebookAccess === true',
  ".child('ebook_auth_sessions').child(auth.uid).child('subjectKey').val() === $subject",
  ".child('ebook_auth_sessions').child(auth.uid).child('allowedClassKeys').child($classKey).val() === true",
  ".child('ebook_auth_sessions').child(auth.uid).child('expiresAt').val() > now",
];
['students', 'grades', 'feedbacks', 'homeworkDone'].forEach(nodeName => {
  const rule = subjectRules[nodeName].$classKey.$studentKey['.read'];
  sessionNeedles.forEach(needle => checkIncludes(rule, needle, `/${nodeName}/$classKey/$studentKey must enforce eBook session scope`));
  checkIncludes(rule, ".child('studentKey').val() === $studentKey", `/${nodeName}/$classKey/$studentKey must enforce target student`);
});
sessionNeedles.forEach(needle => checkIncludes(subjectRules.dailyPosts.$classKey['.read'], needle, '/dailyPosts/$classKey must enforce class-scoped session'));
checkIncludes(subjectRules.bulletins.$classKey['.read'], "$classKey === '全校'", 'bulletins must allow the fixed 全校 path to valid sessions');
check(subjectRules.studentLoginIndex['.read'] !== true, 'studentLoginIndex must not be publicly readable');
check(subjectRules.feedbacks['.write'] === false, 'all client feedback writes must remain disabled');
check(database.admin_workspace.ebook_auth_sessions['.read'] === false, 'eBook auth sessions must be hidden from clients');
['ebook_auth_sessions', 'ebook_login_rate_limits', 'ebook_god_sessions'].forEach(nodeName => {
  check(
    Array.isArray(database.admin_workspace[nodeName]['.indexOn']) && database.admin_workspace[nodeName]['.indexOn'].includes('expiresAt'),
    `/admin_workspace/${nodeName} must index expiresAt for bounded scheduled cleanup`
  );
});

// 7. Every inline script must at least parse as JavaScript before browser smoke tests.
const inlineScriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let inlineMatch;
let inlineCount = 0;
while ((inlineMatch = inlineScriptPattern.exec(html)) !== null) {
  inlineCount += 1;
  try {
    // eslint-disable-next-line no-new-func
    new Function(inlineMatch[1]);
  } catch (error) {
    failures.push(`inline script #${inlineCount} syntax error: ${error.message}`);
  }
}
check(inlineCount >= 3, `expected multiple inline scripts, found ${inlineCount}`);

(async () => {
  await verifyStableStudentRequestId();
  if (failures.length) {
    console.error(`eBook auth/security contract failed (${failures.length}):`);
    failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log('✓ eBook auth/security integration contract passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
