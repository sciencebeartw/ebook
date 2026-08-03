const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(
  html.includes('stageStudentHomeworkFiles(Array.from(input.files), dateStr, input);'),
  'choosing homework files should stage them instead of immediately submitting'
);
check(
  html.includes('id="homework-upload-note-${safeDateId}"') && html.includes('submitStudentHomeworkUpload'),
  'homework upload area should keep an optional note and explicit submit action'
);
check(
  html.includes("if (uploadBatchNote) contentParts.push(uploadBatchNote);") && html.includes("[附件]' + item.url"),
  'homework feedback should combine the optional note with uploaded attachment URLs'
);
check(
  html.includes('stageStudentFeedbackAttachments') && html.includes('sendStudentFeedbackWithAttachments'),
  'student text composer should support staged attachments'
);
check(
  html.includes('stageAdminModeReplyAttachments') && html.includes('prepareAdminModeAttachmentContent'),
  'god-view teacher replies should support answer attachments'
);
check(
  html.includes('stageAdminModeDirectAttachments') && html.includes('god-direct-message'),
  'god-view direct teacher messages should support attachments'
);
check(
  html.includes("fileRef.put(file, metadata)") && html.includes("uploadFeedbackFilePromise(file, path)"),
  'new attachment flows must reuse binary Firebase Storage uploads'
);
check(
  html.includes("附件仍保留，可直接重試") && html.includes('draft.uploaded = uploaded;'),
  'teacher/student attachment drafts should remain retryable after message failure'
);
check(
  html.includes('FEEDBACK_ATTACHMENT_MAX_FILES = 5') && html.includes('STUDENT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024'),
  'message attachment count and student/god-view file size guards should remain explicit'
);
check(
  html.includes("document.getElementById('feedback-send-' + safeId)") &&
    html.includes('renderStudentHomeworkDraft(post.date);') &&
    html.includes('renderStudentFeedbackAttachmentDraft(post.date);'),
  'existing text-only sends and staged drafts should survive the new composer layout and live rerenders'
);

if (failures.length) {
  console.error('eBook feedback attachment smoke failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('✓ eBook feedback attachment smoke passed');
