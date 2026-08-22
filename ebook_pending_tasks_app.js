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

  function normalizeReminderTargetDate(value, dueParts) {
    var raw = text(value).trim();
    var full = raw.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
    if (full) return normalizeDateParts(full[1] + "-" + full[2] + "-" + full[3]);

    var partial = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
    if (!partial || !dueParts) return null;
    var month = Number(partial[1]);
    var year = dueParts.year;
    var monthDelta = month - dueParts.month;
    // A partial target near the previous calendar year is resolved against
    // the trusted server slot. An exact six-month gap is ambiguous, so it
    // deliberately fails closed instead of guessing a year.
    if (monthDelta > 6) year -= 1;
    else if (monthDelta === 6) return null;
    return normalizeDateParts(partial[1] + "-" + partial[2], year);
  }

  function normalizeReminderLabelDate(value, dueParts) {
    var rawDate = text(value).trim();
    var fallbackParts = normalizeDateParts(rawDate, dueParts.year);
    if (!fallbackParts) return null;
    var hasExplicitYear = /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/.test(rawDate);
    if (!hasExplicitYear && fallbackParts.month > dueParts.month + 6) {
      fallbackParts = normalizeDateParts(rawDate, dueParts.year - 1);
    }
    return fallbackParts;
  }

  function resolveReminderSourceDateParts(item, dueParts) {
    if (item && item.reminderSourceDateInvalid === true) return null;
    // New tasks carry an explicit stable source which is independent from the
    // reportTarget used to navigate to the latest host DailyPost.
    var explicitSourceDate = text(item && item.reminderSourceDate).trim();
    if (explicitSourceDate) return normalizeReminderLabelDate(explicitSourceDate, dueParts);

    // Legacy tasks never consult reportTarget: it can move to each newly
    // published DailyPost and would postpone the reminder forever. Prefer an
    // exact mapped paper, then the original display post, then the grade label.
    var paperDate = text(item && item.paperTarget && item.paperTarget.postDate).trim();
    if (paperDate) return normalizeReminderTargetDate(paperDate, dueParts);
    var displayDate = text(item && item.displayTarget && item.displayTarget.postDate).trim();
    if (displayDate) return normalizeReminderTargetDate(displayDate, dueParts);
    return normalizeReminderLabelDate(item && item.date, dueParts);
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
      // Reminder age follows the stable source captured when the task first
      // became actionable. reportTarget may keep moving for navigation, but it
      // must never move the reminder clock.
      var taskParts = resolveReminderSourceDateParts(item, dueParts);
      // reminderDueDateKey is the latest weekly slot that server time has
      // reached. A task dated on that same day belongs to the following
      // reminder cycle, so only an earlier task date has passed its first
      // weekly slot strictly after the task date.
      return !!taskParts && taskParts.key < dueParts.key;
    });
  }

  function isReminderDueState(result) {
    return getReminderDueItems(result).length > 0;
  }

  function monthDayKey(value) {
    var raw = text(value).trim();
    var full = raw.match(/\d{4}[\/.-](\d{1,2})[\/.-](\d{1,2})/);
    if (full && !normalizeDateParts(full[0])) return "";
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

  function dateIdentityParts(value) {
    var raw = text(value).trim();
    var full = raw.match(/(^|[^0-9])(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?!\d)/);
    if (full) {
      var exact = normalizeDateParts(full[2] + "-" + full[3] + "-" + full[4]);
      return exact ? { year: exact.year, month: exact.month, day: exact.day } : null;
    }
    var key = monthDayKey(raw);
    if (!key) return null;
    var parts = key.split("/");
    var legacy = normalizeDateParts(parts[0] + "-" + parts[1], 2000);
    return legacy ? { year: null, month: legacy.month, day: legacy.day } : null;
  }

  function selectYearAwareDateMatches(items, targetValue, getDateValue) {
    var target = dateIdentityParts(targetValue);
    if (!target) return [];
    var candidates = (items || []).map(function(item) {
      var parts = dateIdentityParts(getDateValue(item));
      if (!parts || parts.month !== target.month || parts.day !== target.day) return null;
      return { item: item, parts: parts };
    }).filter(Boolean);
    if (target.year) {
      var exactYear = candidates.filter(function(candidate) { return candidate.parts.year === target.year; });
      if (exactYear.length) return exactYear.map(function(candidate) { return candidate.item; });
      return candidates.filter(function(candidate) { return !candidate.parts.year; }).map(function(candidate) { return candidate.item; });
    }
    var legacy = candidates.filter(function(candidate) { return !candidate.parts.year; });
    if (legacy.length) return legacy.map(function(candidate) { return candidate.item; });
    var years = {};
    candidates.forEach(function(candidate) { years[candidate.parts.year] = true; });
    return Object.keys(years).length === 1 ? candidates.map(function(candidate) { return candidate.item; }) : [];
  }

  function parseReserveTime(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? new Date(value) : null;
    var raw = text(value).trim();
    if (!raw) return null;
    var match = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+\-]\d{2}:\d{2})$/.test(raw)) {
        var zonedDate = new Date(raw);
        return Number.isNaN(zonedDate.getTime()) ? null : zonedDate;
      }
      return null;
    }
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var hour = Number(match[4] || 0);
    var minute = Number(match[5] || 0);
    var second = Number(match[6] || 0);
    var validation = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (validation.getUTCFullYear() !== year || validation.getUTCMonth() !== month - 1 ||
        validation.getUTCDate() !== day || validation.getUTCHours() !== hour ||
        validation.getUTCMinutes() !== minute || validation.getUTCSeconds() !== second) return null;
    var date = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isPostEffective(post, now) {
    var reserveValue = post && post.reserveTime;
    var reserveRaw = text(reserveValue).trim();
    var reserve = parseReserveTime(reserveValue);
    if (reserveRaw && !reserve) return false;
    return !reserve || reserve.getTime() <= now.getTime();
  }

  function getPostHomeworkText(post) {
    return [post && post.hw1, post && post.hw2]
      .map(function(value) { return text(value).trim(); })
      .filter(Boolean)
      .join(" / ");
  }

  function formatPendingTaskTitle(value) {
    var result = text(value);
    var previous = "";
    var pass = 0;
    // DailyPost content supports small nested style tokens such as
    // {red:{u:text}}. Pending cards only need the readable text.
    while (result !== previous && pass < 6) {
      previous = result;
      result = result.replace(/\{(?:red|blue|mark|u):([^{}]*)\}/gi, "$1");
      pass += 1;
    }
    return result
      .replace(/\[([^\]]+)\]\(\s*https?:\/\/[^\s)]+\s*\)/gi, " $1")
      .replace(/\[([^\]]+)\]\s*https?:\/\/\S+/gi, " $1")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\*\*/g, "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "待完成項目";
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
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey));
    var sourceMatchesPosts = (posts || []).filter(function(post) {
      if (!post) return false;
      return sourceMatches(examSource, post.sourceClassKey || post.storedClassKey, helpers);
    });
    var stableMatches = sourceMatchesPosts.filter(function(post) {
      return getPostExamMains(post).some(function(postExam) {
        return hasSameStableExamIdentity(exam, postExam);
      });
    });
    if (stableMatches.length === 1) return stableMatches[0];
    if (stableMatches.length > 1) return null;
    var dateMatches = selectYearAwareDateMatches(sourceMatchesPosts, exam && exam.date, function(post) {
      return post && post.date;
    });
    return dateMatches.length === 1 ? dateMatches[0] : null;
  }

  function getPostExamMains(post) {
    var examData = post && post.examData;
    if (!examData || typeof examData !== "object") return [];
    var rows = Array.isArray(examData.exams) && examData.exams.length
      ? examData.exams.map(function(item) { return item && (item.main || item); })
      : [examData.main];
    return rows.filter(Boolean);
  }

  function hasSameStableExamIdentity(left, right) {
    var leftIds = [left && left.examId, left && left.storedExamId].map(normalizeExamId).filter(Boolean);
    var rightIds = [right && right.examId, right && right.storedExamId].map(normalizeExamId).filter(Boolean);
    if (!leftIds.length || !rightIds.length) return false;
    return leftIds.some(function(id) { return rightIds.indexOf(id) > -1; });
  }

  function hasNavigableOriginalExamPaper(post, helpers) {
    var lines = text(post && post.quiz).split(/\n+/).map(function(line) {
      return line.trim();
    }).filter(Boolean);
    if (!lines.length) return false;
    var options = helpers && typeof helpers.getDisplayOptions === "function"
      ? helpers.getDisplayOptions(post)
      : ((post && post.displayOptions) || {});
    var quiz = options && typeof options === "object" && options.quiz && typeof options.quiz === "object"
      ? options.quiz
      : {};
    var hasExplicitAnswerRole = quiz.slot1Role === "answer" || quiz.slot2Role === "answer";
    if (!hasExplicitAnswerRole) return true;
    return lines.some(function(_line, index) {
      var role = index === 0 ? quiz.slot1Role : quiz.slot2Role;
      return role !== "answer";
    });
  }

  function resolveExactExamPost(posts, exam, helpers, options) {
    options = options || {};
    var examIds = [exam && exam.examId, exam && exam.storedExamId].map(normalizeExamId).filter(Boolean);
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey)).trim();
    if (!examIds.length || !examSource) return null;
    var matches = (posts || []).filter(function(post) {
      var postSource = text(post && (post.sourceClassKey || post.storedClassKey)).trim();
      if (!post || !getPostRowKey(post) || !postSource) return false;
      if (options.requireQuiz === true && !hasNavigableOriginalExamPaper(post, helpers)) return false;
      if (!sourceMatches(examSource, postSource, helpers)) return false;
      var postExams = getPostExamMains(post);
      var matchingExams = postExams.filter(function(postExam) {
        return hasSameStableExamIdentity(exam, postExam);
      });
      if (matchingExams.length !== 1) return false;
      return options.requireSinglePostExam !== true || postExams.length === 1;
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function resolveOriginalExamPaperPost(posts, exam, helpers) {
    var examIds = [exam && exam.examId, exam && exam.storedExamId].map(normalizeExamId).filter(Boolean);
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey)).trim();
    if (examIds.length && examSource) {
      var mappedMatches = (posts || []).filter(function(post) {
        var postSource = text(post && (post.sourceClassKey || post.storedClassKey)).trim();
        if (!post || !getPostRowKey(post) || !postSource) return false;
        if (!sourceMatches(examSource, postSource, helpers) || !hasNavigableOriginalExamPaper(post, helpers)) return false;
        var options = helpers && typeof helpers.getDisplayOptions === "function"
          ? helpers.getDisplayOptions(post)
          : ((post && post.displayOptions) || {});
        var quiz = options && typeof options === "object" && options.quiz && typeof options.quiz === "object"
          ? options.quiz
          : {};
        var lines = text(post.quiz).split(/\n+/).map(function(line) { return line.trim(); }).filter(Boolean);
        var mappedSlots = [quiz.slot1Exam, quiz.slot2Exam].filter(function(mapping, index) {
          mapping = mapping && typeof mapping === "object" ? mapping : {};
          var mappedExamId = normalizeExamId(mapping.targetExamId);
          var mappedSource = text(mapping.sourceClassKey).trim();
          var role = index === 0 ? quiz.slot1Role : quiz.slot2Role;
          return !!lines[index] && role !== "answer" && mappedExamId && mappedSource === postSource &&
            sourceMatches(examSource, mappedSource, helpers) && examIds.indexOf(mappedExamId) > -1;
        });
        return mappedSlots.length === 1;
      });
      if (mappedMatches.length === 1) return mappedMatches[0];
      if (mappedMatches.length > 1) return null;
    }
    return resolveExactExamPost(posts, exam, helpers, {
      requireQuiz: true,
      requireSinglePostExam: true
    });
  }

  function isExamBeforePost(exam, post, helpers) {
    var postParts = normalizeDateParts(post && post.date);
    var examParts = normalizeDateParts(exam && exam.date, postParts && postParts.year);
    if (postParts && examParts) {
      var rawExamDate = text(exam && exam.date);
      var hasExplicitYear = /(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/.test(rawExamDate);
      if (!hasExplicitYear) {
        if (examParts.month > postParts.month + 6) {
          examParts = normalizeDateParts(rawExamDate, postParts.year - 1);
        } else if (postParts.month > examParts.month + 6) {
          examParts = normalizeDateParts(rawExamDate, postParts.year + 1);
        }
      }
      return !!examParts && examParts.key < postParts.key;
    }
    if (helpers && typeof helpers.isExamBeforePostDate === "function") {
      return helpers.isExamBeforePostDate(exam, post) === true;
    }
    return false;
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

  function makeupSourceMatches(left, right, helpers) {
    var leftText = text(left).trim();
    var rightText = text(right).trim();
    return !leftText || !rightText || sourceMatches(leftText, rightText, helpers);
  }

  function isGiftedScienceAutoMakeupClass(value) {
    return /^\d{3,4}小六資優自然週(?:六上午|日下午|日晚(?:上|間))班$/.test(text(value).trim());
  }

  function isMakeupEligibleExam(exam) {
    var raw = [exam && exam.date, exam && exam.exam, exam && exam.title].map(text).join(" ");
    if (raw.indexOf("隨堂") > -1) return false;
    return raw.indexOf("小考") > -1 || raw.indexOf("鑑定") > -1 || raw.indexOf("複習") > -1;
  }

  function getPostSessionStatus(post, helpers) {
    var options = helpers && typeof helpers.getDisplayOptions === "function"
      ? helpers.getDisplayOptions(post)
      : ((post && post.displayOptions) || {});
    var session = options && typeof options === "object" && options.session && typeof options.session === "object"
      ? options.session
      : {};
    return text(session.status).trim().toLowerCase();
  }

  function getPreviousFormalPost(posts, targetPost, helpers) {
    var targetParts = normalizeDateParts(targetPost && targetPost.date);
    var targetSource = text(targetPost && (targetPost.sourceClassKey || targetPost.storedClassKey)).trim();
    if (!targetParts || !targetSource) return null;
    var candidates = (posts || []).map(function(post) {
      if (!post || post === targetPost) return null;
      var postSource = text(post.sourceClassKey || post.storedClassKey).trim();
      if (!postSource || postSource !== targetSource) return null;
      var status = getPostSessionStatus(post, helpers);
      if (status === "supplemental" || status === "cancelled") return null;
      var parts = normalizeDateParts(post.date, targetParts.year);
      return parts && parts.key < targetParts.key ? { post: post, parts: parts } : null;
    }).filter(Boolean).sort(function(a, b) { return b.parts.key - a.parts.key; });
    return candidates.length ? candidates[0].post : null;
  }

  function resolveGiftedScienceMakeupExamForPost(posts, grades, post, helpers) {
    var postSource = text(post && (post.sourceClassKey || post.storedClassKey)).trim();
    if (!postSource || !isGiftedScienceAutoMakeupClass(postSource) || !text(post && post.makeup).trim()) return null;
    var makeup = getMakeupOptions(post, helpers);
    if (normalizeExamId(makeup.targetExamId || makeup.examId)) return null;
    var previous = getPreviousFormalPost(posts, post, helpers);
    if (!previous) return null;
    var candidatesById = {};
    (grades || []).forEach(function(exam) {
      var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey)).trim();
      if (!examSource || examSource !== postSource || !isMakeupEligibleExam(exam)) return;
      var examId = normalizeExamId(exam && (exam.examId || exam.storedExamId));
      if (!examId) return;
      var matches = selectYearAwareDateMatches([exam], previous.date, function(item) { return item && item.date; });
      if (matches.length === 1) candidatesById[examId] = exam;
    });
    var ids = Object.keys(candidatesById);
    return ids.length === 1 ? candidatesById[ids[0]] : null;
  }

  function resolveMappedMakeupPost(posts, exam, helpers, grades) {
    var ids = [exam && exam.examId, exam && exam.storedExamId]
      .map(normalizeExamId)
      .filter(Boolean);
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey));
    if (!ids.length) return { post: null, invalid: false };
    var matches = (posts || []).filter(function(post) {
      var postSource = text(post && (post.sourceClassKey || post.storedClassKey)).trim();
      // The app loader backfills current scoped posts with their class key; a
      // truly legacy missing value is tolerated only as that scoped fallback.
      if (examSource && postSource && postSource !== examSource) return false;
      var makeup = getMakeupOptions(post, helpers);
      // Only a persisted explicit targetExamId is authoritative. Legacy text/date
      // proximity is intentionally never used to guess which makeup paper belongs here.
      var mappedId = normalizeExamId(makeup.targetExamId);
      return !!mappedId && ids.indexOf(mappedId) > -1 && !!text(post.makeup).trim();
    });
    if (matches.length > 1) return { post: null, invalid: true };
    if (matches.length === 1) {
      var mappedSource = text(getMakeupOptions(matches[0], helpers).sourceClassKey).trim();
      if (!examSource || !mappedSource || mappedSource !== examSource) {
        return { post: null, invalid: true };
      }
      if (!isExamBeforePost(exam, matches[0], helpers)) {
        return { post: null, invalid: true };
      }
      return { post: matches[0], invalid: false };
    }
    var inferredMatches = (posts || []).filter(function(post) {
      var inferredExam = resolveGiftedScienceMakeupExamForPost(posts, grades, post, helpers);
      return inferredExam && hasSameStableExamIdentity(exam, inferredExam);
    });
    if (inferredMatches.length > 1) return { post: null, invalid: true };
    return inferredMatches.length === 1
      ? { post: inferredMatches[0], invalid: false, inferred: true }
      : { post: null, invalid: false };
  }

  function findMakeupReportHostPost(posts, exam, helpers) {
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey));
    var candidates = (posts || []).filter(function(post) {
      return makeupSourceMatches(examSource, post && (post.sourceClassKey || post.storedClassKey), helpers) &&
        isExamBeforePost(exam, post, helpers);
    });
    var dated = candidates.map(function(post) {
      var parts = normalizeDateParts(post && post.date);
      return parts ? { post: post, key: parts.key } : null;
    }).filter(Boolean);
    if (!dated.length) return null;
    var latestKey = Math.max.apply(Math, dated.map(function(candidate) { return candidate.key; }));
    var latest = dated.filter(function(candidate) { return candidate.key === latestKey; });
    return latest.length === 1 ? latest[0].post : null;
  }

  // Canonical IDs and class patterns must stay aligned with Dashboard's
  // ThresholdMakeupTiming contract. A rescheduled DailyPost persists the ID,
  // original schedule and actual schedule, so every client can validate the
  // one-off session without guessing from the current calendar.
  var CLASS_SESSION_CONTRACTS = [
    { id: "p6_gifted_science_sat_am", pattern: /^\d{3,4}小六資優自然週六上午班$/, weekday: 6, startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
    { id: "p6_gifted_science_sun_pm", pattern: /^\d{3,4}小六資優自然週日下午班$/, weekday: 0, startHour: 14, startMinute: 0, endHour: 17, endMinute: 0 },
    { id: "p6_gifted_science_sun_night", pattern: /^\d{3,4}小六資優自然週日晚上班$/, weekday: 0, startHour: 18, startMinute: 0, endHour: 21, endMinute: 0 },
    { id: "g7_advanced_science_sat", pattern: /^\d{3,4}國一自然超前班$/, weekday: 6, startHour: 13, startMinute: 0, endHour: 16, endMinute: 0 },
    { id: "g8_advanced_science_sat", pattern: /^\d{3,4}國二自然超前班$/, weekday: 6, startHour: 18, startMinute: 0, endHour: 21, endMinute: 0 },
    { id: "g7_advanced_math_sat", pattern: /^\d{3,4}國一數學超前班$/, weekday: 6, startHour: 18, startMinute: 0, endHour: 21, endMinute: 0 },
    { id: "g8_advanced_math_sun", pattern: /^\d{3,4}國二數學超前班$/, weekday: 0, startHour: 18, startMinute: 0, endHour: 21, endMinute: 0 },
    { id: "p6_gifted_math_wed", pattern: /^\d{3,4}(?:小六)?資優數學(?:班)?$/, weekday: 3, startHour: 18, startMinute: 0, endHour: 21, endMinute: 0 }
  ];

  function compactClassIdentity(value) {
    // Firebase-safe class keys may replace whitespace with underscores. Do not
    // erase other punctuation: a malformed/hybrid class name must not become a
    // valid policy match that Dashboard would reject.
    return text(value).trim().replace(/[\s_]/g, "");
  }

  function resolveClassSessionContract(values) {
    var labels = (Array.isArray(values) ? values : [values]).map(compactClassIdentity).filter(Boolean);
    var matches = CLASS_SESSION_CONTRACTS.filter(function(contract) {
      return labels.some(function(label) {
        return contract.pattern.test(label);
      });
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function getTrustedPendingNow(options, policy) {
    var raw = Object.prototype.hasOwnProperty.call(options || {}, "now") ? options.now : null;
    var explicit = raw instanceof Date ? raw.getTime() : (typeof raw === "number" ? raw : NaN);
    if (Number.isFinite(explicit) && explicit > 0) return new Date(explicit);
    var loadedAt = Number(policy && policy.loadedAt);
    return Number.isFinite(loadedAt) && loadedAt > 0 ? new Date(loadedAt) : null;
  }

  function getTaipeiDateParts(value) {
    var timestamp = value instanceof Date ? value.getTime() : Number(value);
    if (!Number.isFinite(timestamp)) return null;
    var shifted = new Date(timestamp + 8 * 60 * 60 * 1000);
    return normalizeDateParts(
      shifted.getUTCFullYear() + "-" + (shifted.getUTCMonth() + 1) + "-" + shifted.getUTCDate()
    );
  }

  function fullDateParts(value) {
    var identity = dateIdentityParts(value);
    if (!identity || !identity.year) return null;
    return normalizeDateParts(identity.year + "-" + identity.month + "-" + identity.day);
  }

  function resolveThresholdExamDateParts(posts, exam, helpers) {
    var explicit = fullDateParts(exam && exam.date);
    if (explicit) return explicit;
    var target = dateIdentityParts(exam && exam.date);
    if (!target) return null;
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey));
    var sourcePosts = (posts || []).filter(function(post) {
      return post && sourceMatches(examSource, post.sourceClassKey || post.storedClassKey, helpers);
    });
    var stablePosts = sourcePosts.filter(function(post) {
      return getPostExamMains(post).some(function(postExam) {
        return hasSameStableExamIdentity(exam, postExam);
      });
    });
    if (stablePosts.length) {
      var stableDateKeys = {};
      var hasInvalidStableDate = false;
      stablePosts.forEach(function(post) {
        var postParts = fullDateParts(post && post.date);
        if (!postParts) hasInvalidStableDate = true;
        else stableDateKeys[postParts.key] = postParts;
      });
      var uniqueStableDateKeys = Object.keys(stableDateKeys);
      return !hasInvalidStableDate && uniqueStableDateKeys.length === 1
        ? stableDateKeys[uniqueStableDateKeys[0]]
        : null;
    }
    var keys = {};
    sourcePosts.forEach(function(post) {
      var postParts = fullDateParts(post && post.date);
      if (postParts && postParts.month === target.month && postParts.day === target.day) keys[postParts.key] = postParts;
    });
    var uniqueKeys = Object.keys(keys);
    return uniqueKeys.length === 1 ? keys[uniqueKeys[0]] : null;
  }

  function sessionEndTimestamp(parts, contract) {
    if (!parts || !contract) return NaN;
    // Class dates and the contract are fixed to Asia/Taipei (UTC+8), without
    // relying on the browser/device timezone.
    return Date.UTC(parts.year, parts.month - 1, parts.day, contract.endHour - 8, contract.endMinute, 0, 0);
  }

  function parseSessionClock(value) {
    var match = text(value).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
      ? { hour: hour, minute: minute, total: hour * 60 + minute, label: sessionClockLabel(hour, minute) }
      : null;
  }

  function sessionClockLabel(hour, minute) {
    return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
  }

  function getPostSessionMetadata(post, parts, contract, helpers) {
    var options = helpers && typeof helpers.getDisplayOptions === "function"
      ? helpers.getDisplayOptions(post)
      : ((post && post.displayOptions) || {});
    var session = options && typeof options === "object" && options.session && typeof options.session === "object"
      ? options.session
      : {};
    var status = text(session.status).trim().toLowerCase();
    if (status === "cancelled" || status === "supplemental") {
      return { status: status, valid: true };
    }
    if (!status) return { status: "standard", valid: true };
    if (status !== "rescheduled") return { status: "invalid", valid: false };
    var actualDate = fullDateParts(session.actualDate);
    var originalStart = parseSessionClock(session.originalStartTime);
    var originalEnd = parseSessionClock(session.originalEndTime);
    var start = parseSessionClock(session.startTime);
    var end = parseSessionClock(session.endTime);
    var originalWeekdayRaw = session.originalWeekday;
    var originalWeekdayText = text(originalWeekdayRaw).trim();
    var originalWeekdayValid = (typeof originalWeekdayRaw === "number" && Number.isInteger(originalWeekdayRaw)) ||
      (typeof originalWeekdayRaw === "string" && /^[0-6]$/.test(originalWeekdayText));
    var originalWeekday = originalWeekdayValid ? Number(originalWeekdayRaw) : NaN;
    var expectedStart = sessionClockLabel(contract.startHour, contract.startMinute);
    var expectedEnd = sessionClockLabel(contract.endHour, contract.endMinute);
    if (!actualDate || !parts || actualDate.key !== parts.key || text(session.policyId).trim() !== contract.id ||
        !originalWeekdayValid || originalWeekday !== contract.weekday || !originalStart || !originalEnd ||
        originalStart.label !== expectedStart || originalEnd.label !== expectedEnd ||
        !start || !end || end.total <= start.total) {
      return { status: "rescheduled", valid: false };
    }
    return {
      status: "rescheduled",
      valid: true,
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute
    };
  }

  function resolveSessionForPostDate(posts, parts, contract, helpers) {
    var activePosts = [];
    var overrides = [];
    var invalidOverride = false;
    (posts || []).forEach(function(post) {
      var metadata = getPostSessionMetadata(post, parts, contract, helpers);
      if (metadata.status === "cancelled" || metadata.status === "supplemental") return;
      activePosts.push(post);
      if (!metadata.valid) {
        invalidOverride = true;
        return;
      }
      if (metadata.status !== "rescheduled") return;
      overrides.push(metadata);
    });
    if (invalidOverride) {
      return { valid: false, ignored: false, reason: "invalid_class_session_override", activePosts: activePosts };
    }
    if (!activePosts.length) {
      return { valid: false, ignored: true, reason: "ignored_non_session_post", activePosts: [] };
    }
    var signatures = {};
    overrides.forEach(function(override) {
      signatures[
        sessionClockLabel(override.startHour, override.startMinute) + "|" +
        sessionClockLabel(override.endHour, override.endMinute)
      ] = override;
    });
    var signatureKeys = Object.keys(signatures);
    if (signatureKeys.length > 1) {
      return { valid: false, ignored: false, reason: "ambiguous_class_session_override", activePosts: activePosts };
    }
    if (signatureKeys.length === 1) {
      var override = signatures[signatureKeys[0]];
      return {
        valid: true,
        ignored: false,
        source: "rescheduled",
        timestamp: sessionEndTimestamp(parts, override),
        activePosts: activePosts
      };
    }
    var weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    return weekday === contract.weekday
      ? { valid: true, ignored: false, source: "standard", timestamp: sessionEndTimestamp(parts, contract), activePosts: activePosts }
      : { valid: false, ignored: false, reason: "class_session_date_mismatch", activePosts: activePosts };
  }

  function formatFullDateParts(parts) {
    if (!parts) return "";
    return String(parts.year).padStart(4, "0") + "-" +
      String(parts.month).padStart(2, "0") + "-" + String(parts.day).padStart(2, "0");
  }

  function getPendingTaskSortDateParts(task) {
    var candidates = [
      task && task.date,
      task && task.displayTarget && task.displayTarget.postDate,
      task && task.paperTarget && task.paperTarget.postDate
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      var parts = fullDateParts(candidates[index]);
      if (parts) return parts;
    }
    return null;
  }

  function resolveExamClassSessionContract(exam, context) {
    var sourceLabels = [
      exam && exam.sourceClassName,
      exam && exam.className,
      exam && exam.storedClassName,
      exam && exam.sourceClassKey,
      exam && exam.storedClassKey
    ].filter(function(value) { return !!text(value).trim(); });
    if (sourceLabels.length) return resolveClassSessionContract(sourceLabels);
    return resolveClassSessionContract([
      context && context.className,
      context && context.classKey
    ]);
  }

  function resolveGradeHomeworkTaskEligibility(options, policy, exam, context, helpers) {
    var trustedNow = getTrustedPendingNow(options, policy);
    if (!trustedNow) return { allowed: false, reason: "missing_trusted_now" };
    var timingPosts = Array.isArray(options.sessionPosts) ? options.sessionPosts : (options.posts || []);
    var examParts = resolveThresholdExamDateParts(timingPosts, exam, helpers);
    if (!examParts) return { allowed: false, reason: "ambiguous_homework_date" };
    var contract = resolveExamClassSessionContract(exam, context);
    if (!contract) return { allowed: false, reason: "missing_class_session" };
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey)) || (context && context.classKey);
    var sourcePosts = timingPosts.filter(function(post) {
      return post && sourceMatches(examSource, post.sourceClassKey || post.storedClassKey, helpers);
    });
    // Prefer the exact full-year DailyPost. Only when it does not exist may a
    // legacy M/D post act as the publication record for this already-resolved
    // source date. This prevents an older/effective short-date row from
    // bypassing a future exact-year post in a mixed migration dataset.
    var matchingPosts = selectYearAwareDateMatches(
      sourcePosts,
      formatFullDateParts(examParts),
      function(post) { return post && post.date; }
    );
    if (!matchingPosts.length) {
      var trustedToday = getTaipeiDateParts(trustedNow);
      // The student-visible public DailyPost node does not contain scheduled
      // rows before publication. A same-day/future grade with no matching post
      // therefore cannot use the historical source-record fallback, or it
      // would become pending at class end before the contact book is released.
      if (!trustedToday || examParts.key >= trustedToday.key) {
        return { allowed: false, reason: "source_daily_post_not_published" };
      }
    }
    var session = resolveSessionForPostDate(matchingPosts.length ? matchingPosts : [{}], examParts, contract, helpers);
    if (matchingPosts.length) {
      var activePosts = session.activePosts || [];
      var hasInvalidReserve = false;
      var hasEffectivePost = false;
      activePosts.forEach(function(post) {
        var reserveValue = post && post.reserveTime;
        var reserveRaw = text(reserveValue).trim();
        var reserve = parseReserveTime(reserveValue);
        if (reserveRaw && !reserve) {
          hasInvalidReserve = true;
          return;
        }
        if (!reserve || reserve.getTime() <= trustedNow.getTime()) hasEffectivePost = true;
      });
      if (hasInvalidReserve) return { allowed: false, reason: "invalid_daily_post_reserve_time" };
      if (activePosts.length && !hasEffectivePost) return { allowed: false, reason: "source_daily_post_not_published" };
    }
    // Historical grade-only rows may have no DailyPost at all. They retain the
    // source-record fallback, but once a matching post exists its reserveTime
    // and session metadata are authoritative and must pass the gates above.
    if (!session.valid) {
      return {
        allowed: false,
        reason: session.ignored ? "ignored_homework_session" : (session.reason || "homework_date_not_class_session")
      };
    }
    var eligibleAt = session.timestamp;
    if (!Number.isFinite(eligibleAt) || trustedNow.getTime() < eligibleAt) {
      return { allowed: false, reason: "homework_session_not_ended", eligibleAt: eligibleAt };
    }
    return {
      allowed: true,
      reason: "eligible",
      eligibleAt: eligibleAt,
      sessionKey: contract.id,
      date: formatFullDateParts(examParts)
    };
  }

  function resolveThresholdTaskEligibility(options, policy, exam, context, helpers) {
    var trustedNow = getTrustedPendingNow(options, policy);
    if (!trustedNow) return { allowed: false, reason: "missing_trusted_now" };
    var allPosts = Array.isArray(options.sessionPosts) ? options.sessionPosts : (options.posts || []);
    var examParts = resolveThresholdExamDateParts(allPosts, exam, helpers);
    if (!examParts) return { allowed: false, reason: "ambiguous_exam_date" };
    var contract = resolveExamClassSessionContract(exam, context);
    if (!contract) return { allowed: false, reason: "missing_class_session" };
    var examSource = text(exam && (exam.sourceClassKey || exam.storedClassKey)) || (context && context.classKey);
    var records = [];
    allPosts.forEach(function(post) {
      if (!post || !sourceMatches(examSource, post.sourceClassKey || post.storedClassKey, helpers)) return;
      var postParts = fullDateParts(post.date);
      if (!postParts || postParts.key <= examParts.key) return;
      var sessionMetadata = getPostSessionMetadata(post, postParts, contract, helpers);
      if (sessionMetadata.status === "cancelled" || sessionMetadata.status === "supplemental") return;
      var reserveValue = post.reserveTime;
      var reserveRaw = text(reserveValue).trim();
      var reserve = parseReserveTime(reserveValue);
      records.push({
        post: post,
        parts: postParts,
        invalidReserve: !!reserveRaw && !reserve,
        effective: !reserveRaw || (!!reserve && reserve.getTime() <= trustedNow.getTime())
      });
    });
    records.sort(function(left, right) { return left.parts.key - right.parts.key; });
    if (!records.length) {
      return { allowed: false, reason: "missing_next_effective_post" };
    }

    var dateKeys = [];
    records.forEach(function(record) {
      if (dateKeys.indexOf(record.parts.key) === -1) dateKeys.push(record.parts.key);
    });
    var selected = null;
    var firstMismatch = null;
    for (var dateIndex = 0; dateIndex < dateKeys.length; dateIndex += 1) {
      var dateKey = dateKeys[dateIndex];
      var sameDate = records.filter(function(record) { return record.parts.key === dateKey; });
      var session = resolveSessionForPostDate(sameDate.map(function(record) { return record.post; }), sameDate[0].parts, contract, helpers);
      if (session.ignored) continue;
      if (session.valid) {
        if (sameDate.some(function(record) { return record.invalidReserve; })) {
          return {
            allowed: false,
            reason: "invalid_daily_post_reserve_time",
            nextPostDate: formatFullDateParts(sameDate[0].parts)
          };
        }
        if (!sameDate.some(function(record) { return record.effective; })) {
          return {
            allowed: false,
            reason: "missing_next_effective_post",
            nextPostDate: formatFullDateParts(sameDate[0].parts)
          };
        }
        selected = { parts: sameDate[0].parts, session: session };
        break;
      }
      if (session.reason === "class_session_date_mismatch") {
        if (!firstMismatch) firstMismatch = { parts: sameDate[0].parts, reason: session.reason };
        continue;
      }
      return { allowed: false, reason: session.reason || "ambiguous_next_session" };
    }
    if (!selected) {
      return {
        allowed: false,
        reason: firstMismatch ? firstMismatch.reason : "missing_next_effective_post",
        nextPostDate: firstMismatch ? formatFullDateParts(firstMismatch.parts) : ""
      };
    }
    var eligibleAt = selected.session.timestamp;
    if (!Number.isFinite(eligibleAt) || trustedNow.getTime() < eligibleAt) {
      return { allowed: false, reason: "next_session_not_ended", eligibleAt: eligibleAt };
    }
    var activePosts = selected.session.activePosts || [];
    var firstPost = activePosts[0] || null;
    return {
      allowed: true,
      reason: activePosts.length === 1 ? "eligible" : "eligible_date_only",
      examDateKey: examParts.key,
      nextPost: activePosts.length === 1 ? firstPost : { date: firstPost ? text(firstPost.date) : formatFullDateParts(selected.parts) },
      sourceDailyPostId: activePosts.length === 1 ? getPostRowKey(firstPost) : "",
      eligibleAt: eligibleAt,
      sessionKey: contract.id
    };
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
    var legacySourceClassKeys = context.helpers &&
      typeof context.helpers.getLegacyPendingSkipSourceClassKeys === "function"
      ? context.helpers.getLegacyPendingSkipSourceClassKeys(base.sourceClassKey, base)
      : [];
    var sourceClassKeys = [base.sourceClassKey].concat(
      Array.isArray(legacySourceClassKeys) ? legacySourceClassKeys : [legacySourceClassKeys]
    ).map(text).filter(function(value, index, list) {
      return !!value && list.indexOf(value) === index;
    });
    var sourceItemIds = [base.sourceItemId].concat(base.legacySourceItemIds || []).map(text).filter(function(value, index, list) {
      return !!value && list.indexOf(value) === index;
    });
    var legacySkipIdentities = [];
    sourceClassKeys.forEach(function(sourceClassKey) {
      sourceItemIds.forEach(function(sourceItemId) {
        if (sourceClassKey === text(base.sourceClassKey) && sourceItemId === text(base.sourceItemId)) return;
        var legacyIdentity = buildSkipIdentity({
          classKey: context.classKey,
          studentKey: context.studentKey,
          itemType: base.itemType,
          sourceClassKey: sourceClassKey,
          sourceItemId: sourceItemId
        });
        if (legacyIdentity && !legacySkipIdentities.some(function(existing) {
          return existing.lookupKey === legacyIdentity.lookupKey;
        })) legacySkipIdentities.push(legacyIdentity);
      });
    });
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

    var now = getTrustedPendingNow(options, policy) ||
      (options.now instanceof Date ? options.now : new Date(options.now || Date.now()));
    var posts = (options.posts || []).filter(function(post) { return isPostEffective(post, now); });
    var grades = options.grades || [];
    var feedback = options.feedbackHistory || [];
    var rawStudentKey = text(options.studentKey);
    var helpers = options.helpers || {};
    var context = {
      classKey: safeSegment(options.classKey || options.className),
      className: text(options.className),
      studentKey: safeSegment(options.studentKey),
      helpers: helpers
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
      doneFlowPosts.push({ date: text(post.date), sourceClassKey: sourceClassKey });
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
        reminderSourceDate: text(post.date),
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
      var stableExamId = normalizeExamId(exam && (exam.storedExamId || exam.examId));
      var linkedPost = findPostForExam(posts, exam, helpers);

      if (isHomework) {
        var examUsesDoneFlow = helpers && typeof helpers.shouldUseHomeworkDoneFlowForClass === "function"
          ? helpers.shouldUseHomeworkDoneFlowForClass(sourceClassName)
          : false;
        if (examUsesDoneFlow) return;
        var matchingDonePosts = selectYearAwareDateMatches(doneFlowPosts, exam && exam.date, function(donePost) {
          return donePost && donePost.date;
        });
        if (matchingDonePosts.some(function(donePost) {
          return sourceMatches(sourceClassKey, donePost.sourceClassKey, helpers);
        })) return;
        if (isCompletedHomeworkScore(exam && exam.score)) return;
        var homeworkEligibility = resolveGradeHomeworkTaskEligibility(options, policy, exam, context, helpers);
        if (!homeworkEligibility.allowed) return;
        pushIfActive(tasks, createTask({
          kind: "homework_score",
          itemType: "homework",
          neutralLabel: "作業待完成",
          title: titleText.trim() || "作業",
          date: text(exam && exam.date),
          sourceClassKey: sourceClassKey,
          sourceClassName: sourceClassName,
          sourceItemId: stableExamId || colKey,
          legacySourceItemIds: stableExamId && colKey ? [colKey] : [],
          homeworkEligibleAt: homeworkEligibility.eligibleAt,
          homeworkSessionKey: homeworkEligibility.sessionKey,
          sourceDailyPostId: getPostRowKey(linkedPost),
          reminderSourceDate: homeworkEligibility.date,
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
        var absencePaperResolution = guidanceAbsence
          ? { post: null, invalid: false }
          : resolveMappedMakeupPost(posts, exam, helpers, grades);
        var absencePaperPost = absencePaperResolution.post;
        var exactAbsenceExamPost = resolveExactExamPost(posts, exam, helpers);
        var originalExamPaperPost = guidanceAbsence ? null : resolveOriginalExamPaperPost(posts, exam, helpers);
        pushIfActive(tasks, createTask({
          kind: guidanceAbsence ? "guidance_absence" : "absence",
          itemType: "makeup",
          neutralLabel: guidanceAbsence ? "請假輔導待完成" : "請假考試待補",
          title: titleText.trim() || "考試",
          date: text(exam && exam.date),
          sourceClassKey: sourceClassKey,
          sourceClassName: sourceClassName,
          sourceItemId: stableExamId || colKey,
          legacySourceItemIds: stableExamId && colKey ? [colKey] : [],
          reminderSourceDateInvalid: absencePaperResolution.invalid === true,
          reminderSourceDate: text(
            (absencePaperPost && absencePaperPost.date) ||
            (exactAbsenceExamPost && exactAbsenceExamPost.date) ||
            (exam && exam.date)
          ),
          displayTarget: exactAbsenceExamPost ? {
            tab: "contact",
            dailyPostId: getPostRowKey(exactAbsenceExamPost),
            sourceClassKey: text(exactAbsenceExamPost.sourceClassKey || exactAbsenceExamPost.storedClassKey),
            postDate: text(exactAbsenceExamPost.date),
            examId: normalizeExamId(exam && exam.examId),
            storedExamId: normalizeExamId(exam && exam.storedExamId),
            colIndex: exam && exam.colIndex,
            section: "absence-report",
            focus: "score-report"
          } : null,
          // Navigation stays on the original exam paper. The mapped makeup
          // paper above is only the stable reminder-source date.
          paperTarget: originalExamPaperPost ? {
            tab: "contact",
            dailyPostId: getPostRowKey(originalExamPaperPost),
            sourceClassKey: text(originalExamPaperPost.sourceClassKey || originalExamPaperPost.storedClassKey),
            postDate: text(originalExamPaperPost.date),
            examId: normalizeExamId(exam && exam.examId),
            storedExamId: normalizeExamId(exam && exam.storedExamId),
            colIndex: exam && exam.colIndex,
            section: "exam-paper",
            focus: "exam-paper",
            url: extractFirstUrl(originalExamPaperPost.quiz)
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

      // A low score is not actionable at exam time. It becomes a pending
      // makeup only after the next effective DailyPost for the same class has
      // reached that class's scheduled end time. All missing/ambiguous inputs
      // deliberately hide the task instead of notifying early.
      var thresholdEligibility = resolveThresholdTaskEligibility(options, policy, exam, context, helpers);
      if (!thresholdEligibility.allowed) return;

      var reportHost = threshold.isGuidance ? null : findMakeupReportHostPost(posts, exam, helpers);
      var mappedPaperResolution = threshold.isGuidance
        ? { post: null, invalid: false }
        : resolveMappedMakeupPost(posts, exam, helpers, grades);
      var mappedPaperPost = mappedPaperResolution.post;
      var reminderSourceDate = text(
        thresholdEligibility.nextPost && thresholdEligibility.nextPost.date
      );
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
        sourceItemId: stableExamId || colKey,
        legacySourceItemIds: stableExamId && colKey ? [colKey] : [],
        thresholdEligibleAt: thresholdEligibility.eligibleAt,
        thresholdSessionKey: thresholdEligibility.sessionKey,
        sourceDailyPostId: thresholdEligibility.sourceDailyPostId,
        reminderSourceDateInvalid: false,
        reminderSourceDate: reminderSourceDate,
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
          examId: normalizeExamId(exam && exam.examId),
          storedExamId: normalizeExamId(exam && exam.storedExamId),
          colIndex: exam && exam.colIndex,
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
      // Never order legacy M/D labels by the browser's wall-clock year. Prefer
      // an exact task/header date, then the exact DailyPost anchor; unresolved
      // historical items keep a deterministic label order instead of being
      // silently moved into the current calendar year.
      var left = getPendingTaskSortDateParts(a);
      var right = getPendingTaskSortDateParts(b);
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
      reminderSourceDateInvalid: task.reminderSourceDateInvalid === true,
      reminderSourceDate: text(task.reminderSourceDate),
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
    formatPendingTaskTitle: formatPendingTaskTitle,
    isCompletedHomeworkScore: isCompletedHomeworkScore,
    resolveHomeworkDoneRecord: resolveHomeworkDoneRecord,
    buildPendingTasks: buildPendingTasks,
    normalizePreviewTasks: normalizePreviewTasks,
    monthDayKey: monthDayKey,
    dateIdentityParts: dateIdentityParts,
    selectYearAwareDateMatches: selectYearAwareDateMatches,
    resolveClassSessionContract: resolveClassSessionContract,
    resolveGradeHomeworkTaskEligibility: resolveGradeHomeworkTaskEligibility,
    resolveThresholdTaskEligibility: resolveThresholdTaskEligibility,
    resolveGiftedScienceMakeupExamForPost: resolveGiftedScienceMakeupExamForPost
  };
});
