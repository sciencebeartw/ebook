(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EbookPendingTasks = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
  "use strict";

  function text(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function safeSegment(value) {
    return text(value)
      .trim()
      .replace(/[.#$[\]\/]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 180);
  }

  // Must remain byte-for-byte compatible with dashboard/homework_reminder_skip_app.js.
  function stableHash(value) {
    var raw = text(value);
    var h1 = 0x811c9dc5;
    var h2 = 0x9e3779b9;
    for (var i = 0; i < raw.length; i += 1) {
      var code = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 0x01000193);
      h2 = Math.imul(h2 ^ code, 0x85ebca6b);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") +
      (h2 >>> 0).toString(16).padStart(8, "0");
  }

  function buildSkipIdentity(item) {
    item = item || {};
    var classKey = safeSegment(item.classKey || item.sheet);
    var studentKey = safeSegment(item.studentKey || item.name);
    var itemType = safeSegment(item.itemType || item.type || "homework");
    var sourceClassKey = safeSegment(item.sourceClassKey || item.classKey || item.sheet);
    var sourceItemId = safeSegment(item.sourceItemId || item.hwName);
    if (!classKey || !studentKey || !sourceItemId) return null;
    var itemKey = itemType.slice(0, 36) + "_" + stableHash([itemType, sourceClassKey, sourceItemId].join("|"));
    return {
      classKey: classKey,
      studentKey: studentKey,
      itemType: itemType,
      sourceClassKey: sourceClassKey,
      sourceItemId: sourceItemId,
      itemKey: itemKey,
      lookupKey: [classKey, studentKey, itemKey].join("/")
    };
  }

  function normalizePendingPolicy(policy) {
    policy = policy || {};
    var status = text(policy.status).trim().toLowerCase();
    if (status !== "ready") {
      return {
        status: "unavailable",
        skippedItemKeys: {},
        skippedClassItemKeys: {},
        version: Number(policy.version || 1),
        showPending: false,
        loginReminder: false,
        reminderDue: false,
        reminderDueAt: "",
        reminderDueDateKey: ""
      };
    }
    var lookup = {};
    var classLookup = {};
    var keys = Array.isArray(policy.skippedItemKeys)
      ? policy.skippedItemKeys
      : Object.keys(policy.skippedItemKeys || {}).filter(function(key) {
          return !!policy.skippedItemKeys[key];
        });
    keys.forEach(function(key) {
      key = safeSegment(key);
      if (key) lookup[key] = true;
    });
    var items = Array.isArray(policy.items)
      ? policy.items
      : Object.keys(policy.items || {}).map(function(key) {
          var row = policy.items[key];
          return row && typeof row === "object" ? Object.assign({ itemKey: key }, row) : { itemKey: key };
        });
    items.forEach(function(item) {
      var key = safeSegment(item && item.itemKey);
      if (!key && item) {
        var identity = buildSkipIdentity(item);
        key = identity && identity.itemKey;
      }
      if (!key) return;
      var classKey = safeSegment(item && (item.classKey || item.sheet));
      if (classKey) classLookup[classKey + "/" + key] = true;
      else lookup[key] = true;
    });
    var loadedAt = typeof policy.loadedAt === "number" && Number.isFinite(policy.loadedAt) && policy.loadedAt > 0
      ? policy.loadedAt
      : 0;
    var reminderDueAt = typeof policy.reminderDueAt === "number" && Number.isFinite(policy.reminderDueAt) &&
      policy.reminderDueAt > 0 && loadedAt > 0 && policy.reminderDueAt <= loadedAt
      ? policy.reminderDueAt
      : 0;
    var loginReminder = policy.showPending === true && policy.loginReminder === true;
    var explicitDueDateKey = normalizeReminderDueDateKey(policy.reminderDueDateKey, 0);
    var dueAtDateKey = normalizeReminderDueDateKey("", reminderDueAt);
    var hasTrustedDueDate = !!explicitDueDateKey && explicitDueDateKey === dueAtDateKey;
    return {
      status: "ready",
      skippedItemKeys: lookup,
      skippedClassItemKeys: classLookup,
      version: Number(policy.version || 1),
      loadedAt: loadedAt,
      showPending: policy.showPending === true,
      loginReminder: loginReminder,
      reminderDue: loginReminder && policy.reminderDue === true && reminderDueAt > 0 && hasTrustedDueDate,
      reminderDueAt: reminderDueAt,
      reminderDueDateKey: hasTrustedDueDate ? explicitDueDateKey : ""
    };
  }

  function normalizeDateParts(value, fallbackYear) {
    var raw = text(value).trim();
    var full = raw.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    var year = full ? Number(full[1]) : Number(fallbackYear || 0);
    var partial = full || raw.match(/(^|[^0-9])(\d{1,2})[\/.-](\d{1,2})(?=[^0-9]|$)/);
    if (!full && partial && partial[0].indexOf("-") > -1) {
      var afterPartial = raw.charAt(partial.index + partial[0].length);
      if (partial[1] === "第" || afterPartial === "章") partial = null;
    }
    if (!partial) return null;
    var month = Number(full ? full[2] : partial[2]);
    var day = Number(full ? full[3] : partial[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    var date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return { year: year, month: month, day: day, key: year * 10000 + month * 100 + day };
  }

  function normalizeReminderDueDateKey(value, reminderDueAt) {
    function format(parts) {
      return parts
        ? String(parts.year).padStart(4, "0") + "-" + String(parts.month).padStart(2, "0") + "-" + String(parts.day).padStart(2, "0")
        : "";
    }
    function fromTimestamp(raw) {
      if (raw === "" || raw === undefined || raw === null || typeof raw === "boolean") return null;
      var numeric = Number(raw);
      if (!Number.isFinite(numeric)) return null;
      if (numeric > 0 && numeric < 100000000000) numeric *= 1000;
      if (numeric < 100000000000) return null;
      // Server policy uses Asia/Taipei class dates. Shift explicitly before UTC
      // extraction so the result never depends on the device timezone.
      var shifted = new Date(numeric + 8 * 60 * 60 * 1000);
      if (Number.isNaN(shifted.getTime())) return null;
      return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate()
      };
    }

    var rawKey = text(value).trim();
    var compact = rawKey.match(/^(\d{4})(\d{2})(\d{2})$/);
    var parts = compact
      ? normalizeDateParts(compact[1] + "-" + compact[2] + "-" + compact[3])
      : normalizeDateParts(rawKey);
    if (parts) return format(parts);

    var rawAt = text(reminderDueAt).trim();
    var explicitDate = rawAt.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (explicitDate) {
      parts = normalizeDateParts(explicitDate[1] + "-" + explicitDate[2] + "-" + explicitDate[3]);
      if (parts) return format(parts);
    }
    return format(fromTimestamp(reminderDueAt));
  }

  function getReminderDueItems(result) {
    result = result || {};
    var items = result.status === "ready" && Array.isArray(result.items) ? result.items : [];
    var policy = result.policy || {};
    if (!items.length || policy.status !== "ready" || policy.loginReminder !== true || policy.reminderDue !== true) return [];

    // This flag is constructed only by the local Dashboard draft-preview path;
    // normalizePendingPolicy deliberately never accepts it from server data.
    if (policy.previewReminderDueAll === true) return items.slice();
    var dueDateKey = normalizeReminderDueDateKey(policy.reminderDueDateKey, 0);
    var dueAtDateKey = normalizeReminderDueDateKey("", policy.reminderDueAt);
    if (!dueDateKey || dueDateKey !== dueAtDateKey) return [];
    var dueParts = normalizeDateParts(dueDateKey);
    if (!dueParts) return [];

    return items.filter(function(item) {
      var rawDate = text(item && item.date).trim();
      var taskParts = normalizeDateParts(rawDate, dueParts.year);
      if (!taskParts) return false;
      var hasExplicitYear = /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/.test(rawDate);
      if (!hasExplicitYear && taskParts.month > dueParts.month + 6) {
        taskParts = normalizeDateParts(rawDate, dueParts.year - 1);
      }
      return !!taskParts && taskParts.key <= dueParts.key;
    });
  }

  function isReminderDueState(result) {
    return getReminderDueItems(result).length > 0;
  }

  function monthDayKey(value) {
    var raw = text(value).trim();
    var full = raw.match(/\d{4}[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    var partial = full || raw.match(/(^|[^0-9])(\d{1,2})[\/.-](\d{1,2})(?=[^0-9]|$)/);
    if (!full && partial && partial[0].indexOf("-") > -1) {
      var afterPartial = raw.charAt(partial.index + partial[0].length);
      if (partial[1] === "第" || afterPartial === "章") partial = null;
    }
    if (!partial) return "";
    var month = Number(full ? full[1] : partial[2]);
    var day = Number(full ? full[2] : partial[3]);
    return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? month + "/" + day : "";
  }

  function parseReserveTime(value) {
    var raw = text(value).trim();
    if (!raw) return null;
    var normalized = raw.replace("T", " ").replace(/-/g, "/");
    var date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isPostEffective(post, now) {
    var reserve = parseReserveTime(post && post.reserveTime);
    return !reserve || reserve.getTime() <= now.getTime();
  }

  function getPostHomeworkText(post) {
    return [post && post.hw1, post && post.hw2]
      .map(function(value) { return text(value).trim(); })
      .filter(Boolean)
      .join(" / ");
  }

  function isCompletedHomeworkScore(rawScore) {
    var raw = text(rawScore).trim();
    if (!raw || raw === "#N/A" || raw === "0" || raw === "０") return false;
    if (raw.indexOf("缺") > -1 || raw.indexOf("未") > -1) return false;
    return true;
  }

  function normalizeExamId(value) {
    return text(value).trim();
  }

  function hasResultColor(exam, helpers) {
    if (helpers && typeof helpers.getMakeupColorInfo === "function") {
      return !!helpers.getMakeupColorInfo(exam && exam.cellColor);
    }
    return ["#00ff00", "#ffff00", "#ff9900", "#ff0000"].indexOf(text(exam && exam.cellColor).toLowerCase()) > -1;
  }

  function getThreshold(exam, helpers) {
    var isGuidance = helpers && typeof helpers.isMathGuidanceExam === "function" && helpers.isMathGuidanceExam(exam);
    return {
      isGuidance: !!isGuidance,
      value: Number(isGuidance ? exam && exam.guidanceThreshold : exam && exam.makeupThreshold) || 0
    };
  }

  function getScoreNumber(exam) {
    if (exam && exam.scoreNum !== undefined && exam.scoreNum !== null && exam.scoreNum !== "" &&
        Number.isFinite(Number(exam.scoreNum))) return Number(exam.scoreNum);
    var match = text(exam && exam.score).match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function isPureAbsence(exam) {
    var raw = text(exam && exam.score).trim();
    return raw.indexOf("假") > -1 && getScoreNumber(exam) === null;
  }

  function sourceMatches(left, right, helpers) {
    if (helpers && typeof helpers.isSameSource === "function") return helpers.isSameSource(left, right);
    return !left || !right || left === right;
  }

  function findPostForExam(posts, exam, helpers) {
    var examDate = monthDayKey(exam && exam.date);
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey));
    return (posts || []).find(function(post) {
      if (!post || !examDate || monthDayKey(post.date) !== examDate) return false;
      return sourceMatches(examSource, post.sourceClassKey || post.storedClassKey, helpers);
    }) || null;
  }

  function isExamBeforePost(exam, post, helpers) {
    if (helpers && typeof helpers.isExamBeforePostDate === "function") {
      return helpers.isExamBeforePostDate(exam, post);
    }
    var postParts = normalizeDateParts(post && post.date);
    var examParts = normalizeDateParts(exam && exam.date, postParts && postParts.year);
    return !!(postParts && examParts && examParts.key < postParts.key);
  }

  function getMakeupOptions(post, helpers) {
    var options = helpers && typeof helpers.getDisplayOptions === "function"
      ? helpers.getDisplayOptions(post)
      : ((post && post.displayOptions) || {});
    return options && typeof options === "object" && options.makeup && typeof options.makeup === "object"
      ? options.makeup
      : {};
  }

  function extractFirstUrl(value) {
    var match = text(value).match(/https?:\/\/[^\s<]+/);
    return match ? match[0] : "";
  }

  function findMappedMakeupPost(posts, exam, helpers) {
    var ids = [exam && exam.examId, exam && exam.storedExamId]
      .map(normalizeExamId)
      .filter(Boolean);
    if (!ids.length) return null;
    return (posts || []).find(function(post) {
      var makeup = getMakeupOptions(post, helpers);
      // Only a persisted explicit targetExamId is authoritative. Legacy text/date
      // proximity is intentionally never used to guess which makeup paper belongs here.
      var mappedId = normalizeExamId(makeup.targetExamId);
      return !!mappedId && ids.indexOf(mappedId) > -1 && !!text(post.makeup).trim();
    }) || null;
  }

  function findMakeupReportHostPost(posts, exam, helpers) {
    return (posts || []).find(function(post) {
      return isExamBeforePost(exam, post, helpers);
    }) || null;
  }

  function createTask(base, context) {
    var identity = buildSkipIdentity({
      classKey: context.classKey,
      studentKey: context.studentKey,
      itemType: base.itemType,
      sourceClassKey: base.sourceClassKey,
      sourceItemId: base.sourceItemId
    });
    if (!identity) return null;
    var legacySkipIdentities = (base.legacySourceItemIds || []).map(function(sourceItemId) {
      return buildSkipIdentity({
        classKey: context.classKey,
        studentKey: context.studentKey,
        itemType: base.itemType,
        sourceClassKey: base.sourceClassKey,
        sourceItemId: sourceItemId
      });
    }).filter(Boolean);
    return Object.assign({}, base, {
      taskId: identity.itemKey,
      skipIdentity: identity,
      legacySkipIdentities: legacySkipIdentities
    });
  }

  function isIdentitySkipped(identity, policy) {
    if (!identity) return false;
    var classItemKey = identity.classKey + "/" + identity.itemKey;
    return !!(policy.skippedItemKeys[identity.itemKey] || policy.skippedClassItemKeys[classItemKey]);
  }

  function pushIfActive(tasks, task, policy) {
    if (!task) return;
    if (isIdentitySkipped(task.skipIdentity, policy) || (task.legacySkipIdentities || []).some(function(identity) {
      return isIdentitySkipped(identity, policy);
    })) return;
    tasks.push(task);
  }

  function getPostSourceClassKey(post, context) {
    return text(post && (post.storedClassKey || post.sourceClassKey)) || context.classKey;
  }

  function getPostSourceClassName(post, context) {
    return text(post && (post.storedClassName || post.className || post.sourceClassName)) || context.className;
  }

  function getPostRowKey(post) {
    return text(post && (post.dailyPostId || post.id));
  }

  function normalizeHomeworkDoneComparisonText(value) {
    return text(value)
      .replace(/[\s\/／|｜]+/g, "")
      .trim();
  }

  function homeworkDoneHasScopedMetadata(doneRecord) {
    return !!text(doneRecord && (
      doneRecord.sourceClassKey || doneRecord.sourceClassName ||
      doneRecord.sourceItemId || doneRecord.sourceDailyPostId || doneRecord.dailyPostId
    )).trim();
  }

  function homeworkDoneHasPostIdentityMetadata(doneRecord) {
    return !!text(doneRecord && (
      doneRecord.sourceItemId || doneRecord.sourceDailyPostId || doneRecord.dailyPostId
    )).trim();
  }

  function homeworkDoneScopedMetadataMatches(doneRecord, post, sourceClassKey) {
    if (!doneRecord) return false;
    var metadataClassKey = text(doneRecord.sourceClassKey || doneRecord.sourceClassName).trim();
    if (metadataClassKey && safeSegment(metadataClassKey) !== safeSegment(sourceClassKey)) return false;
    var embeddedIds = [post && post.id].map(text).filter(Boolean);
    var rowIds = [post && post.dailyPostId, post && post._rowKey].map(text).filter(Boolean);
    var allIds = embeddedIds.concat(rowIds).filter(function(value, index, list) {
      return list.indexOf(value) === index;
    });
    var sourceItemId = text(doneRecord.sourceItemId).trim();
    var sourceDailyPostId = text(doneRecord.sourceDailyPostId).trim();
    var dailyPostId = text(doneRecord.dailyPostId).trim();
    if (sourceItemId && embeddedIds.length && embeddedIds.indexOf(sourceItemId) === -1) return false;
    if (sourceItemId && !embeddedIds.length && rowIds.indexOf(sourceItemId) === -1) return false;
    if (sourceDailyPostId && rowIds.indexOf(sourceDailyPostId) === -1) return false;
    // GAS stores the verified embedded ID in DailyPostId, while the optimistic
    // browser record stores the RTDB row key there. Both are exact identities.
    if (dailyPostId && allIds.indexOf(dailyPostId) === -1) return false;
    return true;
  }

  function getHomeworkDonePostText(post, helpers) {
    return helpers && typeof helpers.getPostHomeworkText === "function"
      ? helpers.getPostHomeworkText(post)
      : getPostHomeworkText(post);
  }

  function getHomeworkDonePostDateKey(post, helpers) {
    return helpers && typeof helpers.getHomeworkDoneDateKey === "function"
      ? helpers.getHomeworkDoneDateKey(post && post.date)
      : safeSegment(text(post && post.date).replace(/-/g, "/"));
  }

  function getPostSourceStudentKey(options, post, sourceClassKey, fallbackStudentKey) {
    var explicit = text(post && post.sourceStudentKey).trim();
    if (explicit) return explicit;
    var configured = options && options.studentKeysByClassKey && options.studentKeysByClassKey[sourceClassKey];
    if (Array.isArray(configured) && configured.length === 1) return text(configured[0]).trim();
    if (configured && typeof configured === "object" && !Array.isArray(configured)) {
      var enabledKeys = Object.keys(configured).filter(function(key) { return configured[key] === true; });
      if (enabledKeys.length === 1) return enabledKeys[0];
    }
    if (typeof configured === "string") return configured.trim();
    return text(fallbackStudentKey).trim();
  }

  function isHomeworkDoneFlowPost(post, context, helpers) {
    var homeworkText = getHomeworkDonePostText(post, helpers);
    if (!text(homeworkText).trim()) return false;
    return !(helpers && typeof helpers.shouldUseHomeworkDoneFlowForPost === "function") ||
      helpers.shouldUseHomeworkDoneFlowForPost(post, getPostSourceClassName(post, context)) === true;
  }

  function hasDifferentSameCohortHomeworkPost(posts, post, sourceClassKey, dateKey, context, helpers) {
    return (posts || []).some(function(candidate) {
      if (!candidate || candidate === post || getHomeworkDonePostDateKey(candidate, helpers) !== dateKey) return false;
      var candidateSourceClassKey = getPostSourceClassKey(candidate, context);
      if (!candidateSourceClassKey) return false;
      if (candidateSourceClassKey !== sourceClassKey && (
        !helpers || typeof helpers.isSameSource !== "function" ||
        helpers.isSameSource(candidateSourceClassKey, sourceClassKey) !== true
      )) return false;
      return isHomeworkDoneFlowPost(candidate, context, helpers);
    });
  }

  function getHomeworkDoneRecord(options, sourceClassKey, sourceStudentKey, currentStudentKey, dateKey, post, context, posts, helpers) {
    var scopedRoot = options && options.cohortHomeworkDoneRoot;
    if (scopedRoot && typeof scopedRoot === "object") {
      var classNode = scopedRoot[sourceClassKey] || {};
      var studentNode = classNode[sourceStudentKey] || {};
      var directRecord = studentNode[dateKey] || null;
      if (directRecord && (!homeworkDoneHasScopedMetadata(directRecord) ||
        homeworkDoneScopedMetadataMatches(directRecord, post, sourceClassKey))) {
        var ambiguousDirectRecord = directRecord.status === "done" &&
          !homeworkDoneHasPostIdentityMetadata(directRecord) &&
          hasDifferentSameCohortHomeworkPost(posts, post, sourceClassKey, dateKey, context, helpers);
        if (!ambiguousDirectRecord || (
          normalizeHomeworkDoneComparisonText(directRecord.homeworkText) &&
          normalizeHomeworkDoneComparisonText(directRecord.homeworkText) ===
            normalizeHomeworkDoneComparisonText(getHomeworkDonePostText(post, helpers))
        )) return directRecord;
      }

      // 2026-08 前的自然超前升班流程，會把舊班聯絡簿的完成回報寫在
      // 目前班級的日期節點。只對同一升班 cohort 做窄相容；一般換班仍
      // 必須使用來源班級的 exact record，避免同日兩班互相誤判完成。
      var currentClassKey = context && context.classKey;
      var isSameCohort = sourceClassKey && currentClassKey && sourceClassKey !== currentClassKey &&
        helpers && typeof helpers.isSameSource === "function" &&
        helpers.isSameSource(sourceClassKey, currentClassKey) === true;
      if (!isSameCohort) return null;

      var currentStudentNode = ((scopedRoot[currentClassKey] || {})[currentStudentKey]) || {};
      var legacyCurrentRecord = currentStudentNode[dateKey] || null;
      if (!legacyCurrentRecord || legacyCurrentRecord.status !== "done") return null;

      if (homeworkDoneHasScopedMetadata(legacyCurrentRecord)) {
        return homeworkDoneScopedMetadataMatches(legacyCurrentRecord, post, sourceClassKey)
          ? legacyCurrentRecord
          : null;
      }

      var sourceHomeworkText = getHomeworkDonePostText(post, helpers);
      var metadataHomeworkText = normalizeHomeworkDoneComparisonText(legacyCurrentRecord.homeworkText);
      if (metadataHomeworkText && metadataHomeworkText === normalizeHomeworkDoneComparisonText(sourceHomeworkText)) {
        return legacyCurrentRecord;
      }

      var hasDifferentCurrentPost = (posts || []).some(function(candidate) {
        if (!candidate || getPostSourceClassKey(candidate, context) !== currentClassKey) return false;
        var candidateDateKey = getHomeworkDonePostDateKey(candidate, helpers);
        if (candidateDateKey !== dateKey) return false;
        return isHomeworkDoneFlowPost(candidate, context, helpers);
      });
      return hasDifferentCurrentPost ? null : legacyCurrentRecord;
    }
    var legacyFlat = options && options.homeworkDone;
    var legacyFlatRecord = legacyFlat && legacyFlat[dateKey] || null;
    if (!legacyFlatRecord) return null;
    if (homeworkDoneHasScopedMetadata(legacyFlatRecord) &&
        !homeworkDoneScopedMetadataMatches(legacyFlatRecord, post, sourceClassKey)) {
      return null;
    }
    if (!homeworkDoneHasPostIdentityMetadata(legacyFlatRecord) &&
        hasDifferentSameCohortHomeworkPost(posts, post, sourceClassKey, dateKey, context, helpers)) {
      var legacyHomeworkText = normalizeHomeworkDoneComparisonText(legacyFlatRecord.homeworkText);
      if (!legacyHomeworkText || legacyHomeworkText !==
          normalizeHomeworkDoneComparisonText(getHomeworkDonePostText(post, helpers))) {
        return null;
      }
    }
    return legacyFlatRecord;
  }

  function resolveHomeworkDoneRecord(options, post, resolvedPosts, resolvedContext) {
    options = options || {};
    var helpers = options.helpers || {};
    var context = resolvedContext || {
      classKey: safeSegment(options.classKey || options.className),
      className: text(options.className),
      studentKey: safeSegment(options.studentKey)
    };
    var dateKey = getHomeworkDonePostDateKey(post, helpers);
    var sourceClassKey = getPostSourceClassKey(post, context);
    var currentStudentKey = text(options.studentKey);
    var sourceStudentKey = getPostSourceStudentKey(options, post, sourceClassKey, currentStudentKey);
    return getHomeworkDoneRecord(
      options,
      sourceClassKey,
      sourceStudentKey,
      currentStudentKey,
      dateKey,
      post,
      context,
      resolvedPosts || options.posts || [],
      helpers
    );
  }

  function isExamSourceWritable(exam, sourceClassKey, sourceClassName, context, helpers) {
    if (helpers && typeof helpers.isExamSourceClassWritable === "function") {
      return helpers.isExamSourceClassWritable(exam, sourceClassKey, sourceClassName) === true;
    }
    if (exam && exam.isTransferFormerClass === true) return false;
    var semanticSource = text(exam && (exam.sourceClassKey || exam.sourceClassName || exam.className)) || sourceClassKey || sourceClassName;
    var sourceKey = safeSegment(semanticSource);
    var currentNameKey = safeSegment(context.className);
    return !sourceKey || sourceKey === context.classKey || sourceKey === currentNameKey;
  }

  function buildPendingTasks(options) {
    options = options || {};
    var policy = normalizePendingPolicy(options.pendingPolicy);
    if (policy.status !== "ready") return { status: "unavailable", items: [], policy: policy };

    var now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    var posts = (options.posts || []).filter(function(post) { return isPostEffective(post, now); });
    var grades = options.grades || [];
    var feedback = options.feedbackHistory || [];
    var rawStudentKey = text(options.studentKey);
    var helpers = options.helpers || {};
    var context = {
      classKey: safeSegment(options.classKey || options.className),
      className: text(options.className),
      studentKey: safeSegment(options.studentKey)
    };
    if (!context.classKey || !context.studentKey) return { status: "unavailable", items: [], policy: policy };

    var tasks = [];
    var doneFlowPosts = [];
    posts.forEach(function(post) {
      var homeworkText = helpers && typeof helpers.getPostHomeworkText === "function"
        ? text(helpers.getPostHomeworkText(post)).trim()
        : getPostHomeworkText(post);
      if (!homeworkText) return;
      var useDoneFlow = helpers && typeof helpers.shouldUseHomeworkDoneFlowForPost === "function"
        ? helpers.shouldUseHomeworkDoneFlowForPost(post, getPostSourceClassName(post, context))
        : true;
      if (!useDoneFlow) return;
      var dateKey = helpers && typeof helpers.getHomeworkDoneDateKey === "function"
        ? helpers.getHomeworkDoneDateKey(post.date)
        : safeSegment(text(post.date).replace(/-/g, "/"));
      var legacySourceItemIds = helpers && typeof helpers.getLegacyHomeworkSkipSourceItemIds === "function"
        ? helpers.getLegacyHomeworkSkipSourceItemIds(post, dateKey)
        : [dateKey, safeSegment(post.date)];
      var postRowKey = getPostRowKey(post);
      legacySourceItemIds = (Array.isArray(legacySourceItemIds) ? legacySourceItemIds : [legacySourceItemIds]).filter(function(value, index, list) {
        return !!text(value) && text(value) !== text(post.id) && list.indexOf(value) === index;
      });
      if (postRowKey && postRowKey !== text(post.id) && legacySourceItemIds.indexOf(postRowKey) === -1) {
        legacySourceItemIds.push(postRowKey);
      }
      var sourceClassKey = getPostSourceClassKey(post, context);
      var sourceStudentKey = getPostSourceStudentKey(options, post, sourceClassKey, rawStudentKey);
      doneFlowPosts.push({ dateKey: monthDayKey(post.date), sourceClassKey: sourceClassKey });
      var doneRecord = getHomeworkDoneRecord(options, sourceClassKey, sourceStudentKey, rawStudentKey, dateKey, post, context, posts, helpers);
      var done = !!(doneRecord && doneRecord.status === "done");
      if (done) return;
      pushIfActive(tasks, createTask({
        kind: "homework_done",
        itemType: "homework_report",
        neutralLabel: "作業待完成",
        title: homeworkText,
        date: text(post.date),
        sourceClassKey: sourceClassKey,
        sourceClassName: getPostSourceClassName(post, context),
        sourceItemId: text(post.id) || postRowKey || dateKey,
        legacySourceItemIds: legacySourceItemIds,
        displayTarget: {
          tab: "contact",
          dailyPostId: postRowKey,
          sourceClassKey: text(post.sourceClassKey || post.storedClassKey),
          postDate: text(post.date),
          section: "homework",
          focus: "homework"
        },
        writeTarget: {
          dailyPostId: postRowKey,
          sourceItemId: text(post.id) || postRowKey,
          storedClassKey: sourceClassKey,
          storedClassName: getPostSourceClassName(post, context),
          sourceStudentKey: sourceStudentKey,
          targetDate: text(post.date)
        }
      }, context), policy);
    });

    grades.forEach(function(exam) {
      var titleText = text(exam && exam.date) + " " + text(exam && exam.exam);
      var isHomework = helpers && typeof helpers.isHomeworkColumnTitle === "function"
        ? helpers.isHomeworkColumnTitle(titleText)
        : titleText.indexOf("作業") > -1;
      var sourceClassKey = text(exam && (exam.sourceClassKey || exam.storedClassKey)) || context.classKey;
      var sourceClassName = text(exam && (exam.sourceClassName || exam.className || exam.storedClassName)) || context.className;
      var storedClassKey = text(exam && exam.storedClassKey) || sourceClassKey;
      var storedClassName = text(exam && exam.storedClassName) || sourceClassName;
      // Historical exam feedback remains read-only after a transfer. Only the
      // exact former daily post homework_done flow above has a backend exception.
      if (!isExamSourceWritable(exam, sourceClassKey, sourceClassName, context, helpers)) return;
      var colKey = exam && exam.colIndex !== undefined && exam.colIndex !== null ? "col_" + exam.colIndex : "";
      var linkedPost = findPostForExam(posts, exam, helpers);

      if (isHomework) {
        var examUsesDoneFlow = helpers && typeof helpers.shouldUseHomeworkDoneFlowForClass === "function"
          ? helpers.shouldUseHomeworkDoneFlowForClass(sourceClassName)
          : false;
        if (examUsesDoneFlow) return;
        var gradeDateKey = monthDayKey(exam && exam.date);
        if (doneFlowPosts.some(function(donePost) {
          return donePost.dateKey === gradeDateKey && sourceMatches(sourceClassKey, donePost.sourceClassKey, helpers);
        })) return;
        if (isCompletedHomeworkScore(exam && exam.score)) return;
        pushIfActive(tasks, createTask({
          kind: "homework_score",
          itemType: "homework",
          neutralLabel: "作業待完成",
          title: titleText.trim() || "作業",
          date: text(exam && exam.date),
          sourceClassKey: sourceClassKey,
          sourceClassName: sourceClassName,
          sourceItemId: colKey || normalizeExamId(exam && (exam.storedExamId || exam.examId)),
          displayTarget: {
            tab: linkedPost ? "contact" : "grades",
            dailyPostId: getPostRowKey(linkedPost),
            sourceClassKey: text((linkedPost && linkedPost.sourceClassKey) || exam.sourceClassKey),
            postDate: text(linkedPost && linkedPost.date),
            examId: normalizeExamId(exam && exam.examId),
            storedExamId: normalizeExamId(exam && exam.storedExamId),
            colIndex: exam && exam.colIndex,
            section: "homework-score"
          },
          writeTarget: {
            storedClassKey: storedClassKey,
            storedClassName: storedClassName,
            storedExamId: normalizeExamId(exam && (exam.storedExamId || exam.examId)),
            colIndex: exam && exam.colIndex
          }
        }, context), policy);
        return;
      }

      var exempt = helpers && typeof helpers.isEnrollmentExemptExam === "function" && helpers.isEnrollmentExemptExam(exam);
      if (exempt) return;
      var scoreReport = helpers && typeof helpers.getLatestScoreReportInfo === "function"
        ? helpers.getLatestScoreReportInfo(exam, feedback)
        : null;
      if (isPureAbsence(exam) && !scoreReport && !hasResultColor(exam, helpers)) {
        var guidanceAbsence = helpers && typeof helpers.isMathGuidanceExam === "function" && helpers.isMathGuidanceExam(exam);
        var absencePaperPost = guidanceAbsence ? null : findMappedMakeupPost(posts, exam, helpers);
        pushIfActive(tasks, createTask({
          kind: guidanceAbsence ? "guidance_absence" : "absence",
          itemType: "makeup",
          neutralLabel: guidanceAbsence ? "請假輔導待完成" : "請假考試待補",
          title: titleText.trim() || "考試",
          date: text(exam && exam.date),
          sourceClassKey: sourceClassKey,
          sourceClassName: sourceClassName,
          sourceItemId: normalizeExamId(exam && (exam.storedExamId || exam.examId)) || colKey,
          displayTarget: {
            tab: linkedPost ? "contact" : "grades",
            dailyPostId: getPostRowKey(linkedPost),
            sourceClassKey: text((linkedPost && linkedPost.sourceClassKey) || exam.sourceClassKey),
            postDate: text(linkedPost && linkedPost.date),
            examId: normalizeExamId(exam && exam.examId),
            storedExamId: normalizeExamId(exam && exam.storedExamId),
            colIndex: exam && exam.colIndex,
            section: "absence-report",
            focus: "score-report"
          },
          paperTarget: absencePaperPost ? {
            tab: "contact",
            dailyPostId: getPostRowKey(absencePaperPost),
            sourceClassKey: text(absencePaperPost.sourceClassKey || absencePaperPost.storedClassKey),
            postDate: text(absencePaperPost.date),
            section: "makeup-paper",
            url: extractFirstUrl(absencePaperPost.makeup)
          } : null,
          writeTarget: {
            storedClassKey: storedClassKey,
            storedClassName: storedClassName,
            storedExamId: normalizeExamId(exam && (exam.storedExamId || exam.examId)),
            storedDate: text(exam && (exam.storedDate || exam.date)),
            colIndex: exam && exam.colIndex
          }
        }, context), policy);
        return;
      }

      var threshold = getThreshold(exam, helpers);
      var scoreNum = getScoreNumber(exam);
      var resultReport = helpers && typeof helpers.getLatestResultReportInfo === "function"
        ? helpers.getLatestResultReportInfo(exam, feedback)
        : null;
      if (!threshold.value || scoreNum === null || scoreNum >= threshold.value || hasResultColor(exam, helpers) || resultReport) return;

      var reportHost = threshold.isGuidance ? null : findMakeupReportHostPost(posts, exam, helpers);
      var mappedPaperPost = threshold.isGuidance ? null : findMappedMakeupPost(posts, exam, helpers);
      var taskKind = threshold.isGuidance ? "guidance" : (reportHost ? "makeup_result" : "makeup");
      var taskLabel = threshold.isGuidance ? "輔導待完成" : (reportHost ? "補考結果待回報" : "補考待完成");
      pushIfActive(tasks, createTask({
        kind: taskKind,
        itemType: "makeup",
        neutralLabel: taskLabel,
        title: titleText.trim() || "考試",
        date: text(exam && exam.date),
        sourceClassKey: sourceClassKey,
        sourceClassName: sourceClassName,
        sourceItemId: normalizeExamId(exam && (exam.storedExamId || exam.examId)) || colKey,
        displayTarget: {
          tab: linkedPost ? "contact" : "grades",
          dailyPostId: getPostRowKey(linkedPost),
          sourceClassKey: text((linkedPost && linkedPost.sourceClassKey) || exam.sourceClassKey),
          postDate: text(linkedPost && linkedPost.date),
          examId: normalizeExamId(exam && exam.examId),
          storedExamId: normalizeExamId(exam && exam.storedExamId),
          colIndex: exam && exam.colIndex,
          section: "exam"
        },
        reportTarget: reportHost ? {
          tab: "contact",
          dailyPostId: getPostRowKey(reportHost),
          sourceClassKey: text(reportHost.sourceClassKey || reportHost.storedClassKey),
          postDate: text(reportHost.date),
          examId: normalizeExamId(exam && exam.examId),
          storedExamId: normalizeExamId(exam && exam.storedExamId),
          colIndex: exam && exam.colIndex,
          section: "makeup-result",
          focus: "makeup-result"
        } : null,
        paperTarget: mappedPaperPost ? {
          tab: "contact",
          dailyPostId: getPostRowKey(mappedPaperPost),
          sourceClassKey: text(mappedPaperPost.sourceClassKey || mappedPaperPost.storedClassKey),
          postDate: text(mappedPaperPost.date),
          section: "makeup-paper",
          url: extractFirstUrl(mappedPaperPost.makeup)
        } : null,
        writeTarget: {
          storedClassKey: storedClassKey,
          storedClassName: storedClassName,
          storedExamId: normalizeExamId(exam && (exam.storedExamId || exam.examId)),
          storedDate: text(exam && (exam.storedDate || exam.date)),
          colIndex: exam && exam.colIndex
        }
      }, context), policy);
    });

    tasks.sort(function(a, b) {
      var left = normalizeDateParts(a.date, now.getFullYear());
      var right = normalizeDateParts(b.date, now.getFullYear());
      var diff = (right ? right.key : 0) - (left ? left.key : 0);
      return diff || text(a.neutralLabel).localeCompare(text(b.neutralLabel), "zh-Hant");
    });
    return { status: "ready", items: tasks, policy: policy };
  }

  function normalizePreviewTask(task, index) {
    task = task || {};
    var id = safeSegment(task.taskId || ("preview_" + index));
    function target(value) {
      value = value || {};
      return {
        tab: ["contact", "grades"].indexOf(value.tab) > -1 ? value.tab : "contact",
        dailyPostId: text(value.dailyPostId),
        sourceClassKey: text(value.sourceClassKey),
        postDate: text(value.postDate),
        examId: text(value.examId),
        storedExamId: text(value.storedExamId),
        colIndex: value.colIndex === undefined || value.colIndex === null ? "" : text(value.colIndex),
        section: text(value.section),
        focus: text(value.focus),
        url: /^https?:\/\//.test(text(value.url)) ? text(value.url) : ""
      };
    }
    return {
      taskId: id,
      kind: text(task.kind || "homework_done"),
      neutralLabel: text(task.neutralLabel || "作業待完成"),
      title: text(task.title || "待完成項目"),
      date: text(task.date),
      sourceClassName: text(task.sourceClassName),
      displayTarget: target(task.displayTarget),
      reportTarget: task.reportTarget ? target(task.reportTarget) : null,
      paperTarget: task.paperTarget ? target(task.paperTarget) : null
    };
  }

  function normalizePreviewTasks(tasks) {
    return (Array.isArray(tasks) ? tasks : []).map(normalizePreviewTask);
  }

  return {
    safeSegment: safeSegment,
    stableHash: stableHash,
    buildSkipIdentity: buildSkipIdentity,
    normalizePendingPolicy: normalizePendingPolicy,
    normalizeReminderDueDateKey: normalizeReminderDueDateKey,
    getReminderDueItems: getReminderDueItems,
    isReminderDueState: isReminderDueState,
    isCompletedHomeworkScore: isCompletedHomeworkScore,
    resolveHomeworkDoneRecord: resolveHomeworkDoneRecord,
    buildPendingTasks: buildPendingTasks,
    normalizePreviewTasks: normalizePreviewTasks,
    monthDayKey: monthDayKey
  };
});
