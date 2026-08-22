const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(
  html.includes('ebook_feedback_threads_app.js?v=20260822_feedback_threads_v1') &&
    html.includes('feedbackThreadApi.buildFeedbackThreads(myHistory)'),
  'the pure feedback-thread helper must be loaded before the eBook renderer uses it'
);
check(
  html.includes("block.kind === \"operational\"") &&
    html.includes('h.type === FEEDBACK_TYPE_LABELS.sticker') &&
    html.includes('isMakeupScoreReportType(h.type)'),
  'operational sticker and makeup cards must remain outside social reply threads'
);
check(
  html.includes('var isCollapsible = replies.length > 2') &&
    html.includes('查看 " + replies.length + " 則回覆') &&
    html.includes('toggleEbookFeedbackThreadReplies'),
  'threads with more than two replies should expose an accessible collapse control'
);
check(
  html.includes("aria-controls='feedback-thread-replies-") &&
    html.includes("button.setAttribute('aria-expanded'") &&
    html.includes('ebookExpandedFeedbackThreads[context.threadId]'),
  'reply collapse state must be accessible and survive realtime rerenders'
);
check(
  html.includes('feedbackThreadApi.getLatestReplyableKeyedMessage(thread)') &&
    html.includes('feedbackThreadApi.getLatestStudentMessage(thread)') &&
    html.includes('buildStudentThreadReplyBox(studentContextKey)') &&
    html.includes('buildAdminReplyBox(teacherContextKey'),
  'students and god view should each get one thread-level composer with the correct latest reply target'
);
check(
  html.includes('feedbackThreadApi && thread.root.key') &&
    html.includes('studentTargetItem.storedClassName || studentTargetItem.sourceClassName') &&
    html.includes('storedStudentKey: studentTargetItem.storedStudentKey') &&
    html.includes('sourceClassName: feedbackOptions.sourceClassName || resolveStudentActionSourceClassName(realDate)') &&
    html.includes('form.storedStudentKey = feedbackOptions.storedStudentKey'),
  'thread replies must require a durable root key and preserve the exact historical class/student identity'
);
check(
  html.includes('!isAdminMode && !isDashboardDraftPreviewMode && !post.isTransferFormerClass') &&
    html.includes('registerStudentFeedbackComposer("new_" + safeDateId') &&
    html.includes('replyToFeedbackKey: ""'),
  'new top-level messages must remain separate roots and old transferred posts must stay read-only'
);
check(
  html.includes("form.replyToFeedbackKey = feedbackOptions.replyToFeedbackKey") &&
    html.includes("context.replyToFeedbackKey ? 'student-feedback-thread' : 'student-feedback'") &&
    html.includes('prepareAdminModeAttachmentContent(contextKey, false'),
  'student and god-view thread replies must support text, files, photos, and attachment-only submission'
);
check(
  html.includes('"feedback_thread_" + safeDateId + "_" + thread.id') &&
    !html.includes('thread.id + "_" + blockIndex') &&
    html.includes('submitLabel: "回覆"') &&
    html.includes('submitLabel: "新增留言"') &&
    html.includes('btn.innerText = submitLabel'),
  'thread draft keys and idle button labels must remain stable across realtime ordering changes'
);
check(
  html.includes('.feedback-thread-replies') &&
    html.includes('margin-left: 18px') &&
    html.includes('.feedback-thread-composer-main .fb-input') &&
    html.includes('flex: 1 0 100%') &&
    html.includes('overflow-wrap: anywhere'),
  'mobile thread replies must narrow indentation, stack the input, and wrap long attachment text'
);
check(
  html.includes('data-feedback-key=') &&
    html.includes('escapeHtmlAttr(entry && entry.key') &&
    /makeDomSafeId\(\s*["']feedback_thread_["']/.test(html),
  'feedback keys and thread DOM identifiers must not be inserted as raw HTML or handlers'
);

if (failures.length) {
  console.error('eBook feedback thread UI smoke failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('✓ eBook feedback thread UI smoke passed');
