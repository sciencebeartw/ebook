const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const helper = require(path.join(root, "exam_identity_app.js"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const validId = "exam_12345678-1234-4abc-8def-1234567890ab";

assert.strictEqual(helper.normalizeExamId(validId), validId);
assert.strictEqual(helper.normalizeMode("unexpected"), "off");
assert.ok(html.includes("exam_identity_app.js?v=20260712_exam_identity_phase1"));
assert.ok(html.includes("targetExamId"));
assert.ok(html.includes("loadExamIdByClassColKey"), "eBook must load scoped class catalogs for grade identity");
assert.ok(html.includes("/meta/examCatalog/${classKey}"), "catalog reads must be class-scoped");
assert.ok(!html.includes("db.ref(`${BEAR_SUBJECT}/meta/examCatalog`).once"), "eBook must not read the examCatalog root");
assert.ok(html.includes('examId: (options.examIdByColKey || {})[col] || ""'), "grade cards must carry the stable exam ID");
assert.ok(/normalize\w*FeedbackExamId/.test(html));
assert.ok(!html.includes("resolveFeedbackTarget("), "Phase 1 不得改用 examId resolver");
assert.ok(!/db\.ref\([^\n]{0,160}meta\/examCatalog[`'\"]?\)\.once/.test(html), "eBook 不得新增 examCatalog root read");
assert.ok(!/ebook_exam_identity_config/.test(html), "Phase 1 不得新增 feature config RTDB read");

console.log("exam identity Phase 1 browser smoke passed");
