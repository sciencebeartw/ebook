(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) root.BearExamIdentity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";

  var EXAM_ID_PATTERN = /^exam_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
  var MODE_VALUES = { off: true, shadow: true, enforce: true };

  function parseExamId(value) {
    var raw = value === undefined || value === null ? "" : String(value).trim().toLowerCase();
    if (!raw) return { present: false, valid: false, value: "", reason: "missing" };
    if (!EXAM_ID_PATTERN.test(raw)) return { present: true, valid: false, value: "", reason: "invalid-format" };
    return { present: true, valid: true, value: raw, reason: "" };
  }

  function normalizeExamId(value) {
    return parseExamId(value).value;
  }

  function normalizeMode(value) {
    var mode = value === undefined || value === null ? "" : String(value).trim().toLowerCase();
    return MODE_VALUES[mode] ? mode : "off";
  }

  function resolveEffectiveMode(config, classKey) {
    var source = config && typeof config === "object" && !Array.isArray(config) ? config : {};
    var key = classKey === undefined || classKey === null ? "" : String(classKey);
    var classConfig = key && source[key] && typeof source[key] === "object" ? source[key] : {};
    var defaultConfig = source._default && typeof source._default === "object" ? source._default : {};
    return {
      examIdMode: normalizeMode(classConfig.examIdMode || defaultConfig.examIdMode),
      writebackLedgerMode: normalizeMode(classConfig.writebackLedgerMode || defaultConfig.writebackLedgerMode)
    };
  }

  function normalizeCatalog(rawCatalog) {
    if (!rawCatalog || typeof rawCatalog !== "object" || Array.isArray(rawCatalog)) {
      return { success: false, entries: {}, errors: [{ code: "invalid-catalog" }] };
    }
    var entries = {};
    var errors = [];
    var colOwners = {};

    Object.keys(rawCatalog).forEach(function(rawExamId) {
      var parsed = parseExamId(rawExamId);
      var item = rawCatalog[rawExamId];
      if (!parsed.valid) {
        errors.push({ code: "invalid-exam-id", examId: rawExamId });
        return;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push({ code: "invalid-entry", examId: parsed.value });
        return;
      }
      var embedded = parseExamId(item.examId || parsed.value);
      if (!embedded.valid || embedded.value !== parsed.value) {
        errors.push({ code: "entry-id-mismatch", examId: parsed.value });
        return;
      }
      var colKey = item.colKey === undefined || item.colKey === null ? "" : String(item.colKey).trim();
      var colIndex = /^col_\d+$/.test(colKey) ? Number(colKey.slice(4)) : -1;
      if (!Number.isInteger(colIndex) || colIndex < 5 || colIndex > 18277) {
        errors.push({ code: "invalid-col-key", examId: parsed.value, colKey: colKey });
        return;
      }
      if (colOwners[colKey] && colOwners[colKey] !== parsed.value) {
        errors.push({ code: "duplicate-col-key", colKey: colKey, examIds: [colOwners[colKey], parsed.value] });
        return;
      }
      colOwners[colKey] = parsed.value;
      var date = item.date === undefined || item.date === null ? "" : String(item.date);
      var title = item.title === undefined || item.title === null ? "" : String(item.title);
      var updatedAt = Number(item.updatedAt || 0);
      if (date.length > 300 || title.length > 300 || !Number.isInteger(updatedAt) || updatedAt < 0) {
        errors.push({ code: "invalid-entry-fields", examId: parsed.value });
        return;
      }
      entries[parsed.value] = {
        examId: parsed.value,
        colKey: colKey,
        date: date,
        title: title,
        updatedAt: updatedAt
      };
    });

    return { success: errors.length === 0, entries: entries, errors: errors };
  }

  function resolveFeedbackTarget(feedback, rawCatalog, requestedMode) {
    var mode = normalizeMode(requestedMode);
    var parsed = parseExamId(feedback && feedback.targetExamId);
    var base = {
      mode: mode,
      examId: parsed.value,
      resolved: false,
      authoritative: false,
      blocking: false,
      reason: ""
    };
    if (mode === "off") {
      base.reason = "legacy-mode";
      return base;
    }
    if (!parsed.valid) {
      base.reason = parsed.reason;
      base.blocking = mode === "enforce";
      return base;
    }
    var catalog = normalizeCatalog(rawCatalog);
    if (!catalog.success) {
      base.reason = "invalid-catalog";
      base.blocking = mode === "enforce";
      base.catalogErrors = catalog.errors;
      return base;
    }
    var entry = catalog.entries[parsed.value];
    if (!entry) {
      base.reason = "exam-id-not-found";
      base.blocking = mode === "enforce";
      return base;
    }
    base.resolved = true;
    base.authoritative = mode === "enforce";
    base.catalogEntry = entry;
    return base;
  }

  return Object.freeze({
    EXAM_ID_PATTERN: EXAM_ID_PATTERN,
    parseExamId: parseExamId,
    normalizeExamId: normalizeExamId,
    normalizeMode: normalizeMode,
    resolveEffectiveMode: resolveEffectiveMode,
    normalizeCatalog: normalizeCatalog,
    resolveFeedbackTarget: resolveFeedbackTarget
  });
});
