(function(root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EbookLifecycleApp = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  function uniqueStrings(values) {
    var result = [];
    var seen = Object.create(null);
    (values || []).forEach(function(value) {
      var text = (value === undefined || value === null ? '' : String(value)).trim();
      if (!text || seen[text]) return;
      seen[text] = true;
      result.push(text);
    });
    return result;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function isValidDateParts(year, month, day) {
    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return false;
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function datePartsToKey(year, month, day) {
    if (!isValidDateParts(year, month, day)) return null;
    return (year * 10000) + (month * 100) + day;
  }

  function dateKeyToParts(dateKey) {
    var key = Number(dateKey);
    if (!Number.isInteger(key) || key < 10000101) return null;
    var year = Math.floor(key / 10000);
    var month = Math.floor((key % 10000) / 100);
    var day = key % 100;
    return isValidDateParts(year, month, day) ? { year: year, month: month, day: day } : null;
  }

  function dateKeyToUtcMs(dateKey) {
    var parts = dateKeyToParts(dateKey);
    return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : NaN;
  }

  function parseFullDateParts(value) {
    var text = (value === undefined || value === null ? '' : String(value)).trim();
    var match = text.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (!match) return null;
    var year = parseInt(match[1], 10);
    var month = parseInt(match[2], 10);
    var day = parseInt(match[3], 10);
    return isValidDateParts(year, month, day) ? { year: year, month: month, day: day } : null;
  }

  function parsePartialDateParts(value) {
    var text = (value === undefined || value === null ? '' : String(value)).trim();
    if (parseFullDateParts(text)) return null;
    var pattern = /(^|[^0-9])(\d{1,2})([\/.\-])(\d{1,2})(?=[^0-9]|$)/g;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      var tokenStart = match.index + match[1].length;
      var tokenEnd = tokenStart + match[2].length + 1 + match[4].length;
      var before = text.charAt(tokenStart - 1);
      var after = text.charAt(tokenEnd);
      if (match[3] === '-' && (before === '第' || after === '章')) continue;
      var month = parseInt(match[2], 10);
      var day = parseInt(match[4], 10);
      if (isValidDateParts(2000, month, day)) return { month: month, day: day };
    }
    return null;
  }

  function inferPartialDateKey(partial, options) {
    var opts = options || {};
    var fallbackYear = Number(opts.fallbackYear) || 0;
    if (opts.preferFallbackYear === true && fallbackYear) {
      return datePartsToKey(fallbackYear, partial.month, partial.day);
    }
    var anchorKeys = [];
    if (opts.anchorDateKey) anchorKeys.push(Number(opts.anchorDateKey));
    (opts.anchorDateKeys || []).forEach(function(key) {
      if (key) anchorKeys.push(Number(key));
    });
    anchorKeys = anchorKeys.filter(function(key) { return !!dateKeyToParts(key); });

    if (!anchorKeys.length && fallbackYear) {
      return datePartsToKey(fallbackYear, partial.month, partial.day);
    }
    if (!anchorKeys.length) return null;

    var candidateYears = [];
    anchorKeys.forEach(function(key) {
      var parts = dateKeyToParts(key);
      candidateYears.push(parts.year - 1, parts.year, parts.year + 1);
    });
    if (fallbackYear) candidateYears.push(fallbackYear);
    candidateYears = uniqueStrings(candidateYears).map(Number);

    var bestKey = null;
    var bestDistance = Infinity;
    candidateYears.forEach(function(year) {
      var candidateKey = datePartsToKey(year, partial.month, partial.day);
      if (!candidateKey) return;
      var candidateMs = dateKeyToUtcMs(candidateKey);
      var distance = Math.min.apply(Math, anchorKeys.map(function(anchorKey) {
        return Math.abs(candidateMs - dateKeyToUtcMs(anchorKey));
      }));
      if (distance < bestDistance || (distance === bestDistance && (bestKey === null || candidateKey < bestKey))) {
        bestDistance = distance;
        bestKey = candidateKey;
      }
    });
    return bestKey;
  }

  function parseDateKey(value, options) {
    var full = parseFullDateParts(value);
    if (full) return datePartsToKey(full.year, full.month, full.day);
    var partial = parsePartialDateParts(value);
    return partial ? inferPartialDateKey(partial, options) : null;
  }

  function formatDateKey(dateKey) {
    var parts = dateKeyToParts(dateKey);
    return parts ? (parts.year + '-' + pad2(parts.month) + '-' + pad2(parts.day)) : '';
  }

  function collectionValues(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection.slice();
    if (typeof collection !== 'object') return [];
    return Object.keys(collection).map(function(key) {
      var item = collection[key];
      if (!item || typeof item !== 'object') return item;
      return Object.assign({ id: item.id || key }, item);
    });
  }

  function flattenCollections(sources) {
    if (!Array.isArray(sources)) return collectionValues(sources);
    var result = [];
    sources.forEach(function(source) {
      var looksLikeEnrollmentRecord = source && typeof source === 'object' && !Array.isArray(source) &&
        (source.enrollmentDate || source.effectiveDate) &&
        (source.classKey || source.className || source.toClassKey || source.toClassName);
      result = result.concat(looksLikeEnrollmentRecord ? [source] : collectionValues(source));
    });
    return result;
  }

  function normalizeTransferRecord(record, fallbackId) {
    var item = record || {};
    var effectiveDate = String(item.effectiveDate || '').trim();
    return {
      id: String(item.id || fallbackId || '').trim(),
      studentName: String(item.studentName || '').trim(),
      studentKey: String(item.studentKey || '').trim(),
      fromClassName: String(item.fromClassName || item.oldClassName || '').trim(),
      fromClassKey: String(item.fromClassKey || item.fromClassName || item.oldClassName || '').trim(),
      toClassName: String(item.toClassName || item.newClassName || '').trim(),
      toClassKey: String(item.toClassKey || item.toClassName || item.newClassName || '').trim(),
      effectiveDate: effectiveDate,
      effectiveDateKey: parseDateKey(effectiveDate),
      createdAt: item.createdAt || '',
      status: String(item.status || 'active').trim(),
      raw: item
    };
  }

  function looksLikeTransferRecord(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value) &&
      (value.fromClassKey || value.fromClassName || value.oldClassName) &&
      (value.toClassKey || value.toClassName || value.newClassName) &&
      value.effectiveDate);
  }

  function listActiveTransfers(records) {
    var values = looksLikeTransferRecord(records) ? [records] : collectionValues(records);
    return values.map(function(item, index) {
      return normalizeTransferRecord(item, item && item.id ? item.id : String(index));
    }).filter(function(item) {
      return item.status !== 'deleted' && item.fromClassKey && item.toClassKey && item.effectiveDateKey;
    });
  }

  function compareTransferCandidates(a, b) {
    var dateDiff = (b.effectiveDateKey || 0) - (a.effectiveDateKey || 0);
    if (dateDiff) return dateDiff;
    var createdDiff = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    if (createdDiff) return createdDiff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  }

  function selectIncomingTransfer(records, toClassKey, beforeDateKey) {
    var targetKey = String(toClassKey || '').trim();
    var upperBound = beforeDateKey === undefined || beforeDateKey === null ? Infinity : Number(beforeDateKey);
    var candidates = listActiveTransfers(records).filter(function(item) {
      return item.toClassKey === targetKey && item.effectiveDateKey < upperBound;
    }).sort(compareTransferCandidates);
    if (!candidates.length) return { transfer: null, ambiguous: false, candidates: [] };
    var selected = candidates[0];
    var sameMoment = candidates.filter(function(item) {
      return item.effectiveDateKey === selected.effectiveDateKey;
    });
    var distinctSources = uniqueStrings(sameMoment.map(function(item) { return item.fromClassKey; }));
    return {
      transfer: selected,
      ambiguous: distinctSources.length > 1,
      candidates: sameMoment
    };
  }

  function buildTransferChain(records, currentClassKey, options) {
    var opts = options || {};
    var maxDepth = Number.isInteger(opts.maxDepth) && opts.maxDepth > 0 ? opts.maxDepth : 8;
    var cursor = String(currentClassKey || '').trim();
    var upperBound = opts.beforeDateKey === undefined || opts.beforeDateKey === null ? Infinity : Number(opts.beforeDateKey);
    var chain = [];
    var ambiguities = [];
    var seenEdges = Object.create(null);

    for (var depth = 0; cursor && depth < maxDepth; depth++) {
      var selection = selectIncomingTransfer(records, cursor, upperBound);
      if (!selection.transfer) break;
      var transfer = selection.transfer;
      var edgeKey = [transfer.id, transfer.fromClassKey, transfer.toClassKey, transfer.effectiveDateKey].join('|');
      if (seenEdges[edgeKey]) break;
      seenEdges[edgeKey] = true;
      transfer = Object.assign({}, transfer, { depth: depth });
      chain.push(transfer);
      if (selection.ambiguous) {
        ambiguities.push({
          toClassKey: cursor,
          effectiveDateKey: transfer.effectiveDateKey,
          candidateIds: selection.candidates.map(function(item) { return item.id; }),
          fromClassKeys: uniqueStrings(selection.candidates.map(function(item) { return item.fromClassKey; }))
        });
      }
      upperBound = transfer.effectiveDateKey;
      cursor = transfer.fromClassKey;
    }

    var hasMore = !!selectIncomingTransfer(records, cursor, upperBound).transfer;
    return {
      currentClassKey: String(currentClassKey || '').trim(),
      chain: chain,
      ambiguities: ambiguities,
      truncated: chain.length >= maxDepth && hasMore,
      oldestClassKey: cursor || String(currentClassKey || '').trim()
    };
  }

  function normalizeChain(chainOrResult, currentClassKey) {
    if (chainOrResult && Array.isArray(chainOrResult.chain)) return chainOrResult;
    if (Array.isArray(chainOrResult)) {
      return { currentClassKey: String(currentClassKey || '').trim(), chain: chainOrResult };
    }
    return buildTransferChain(chainOrResult || {}, currentClassKey);
  }

  function getTrackedClassKeys(currentClassKey, chainOrRecords, additionalClassKeys) {
    var chainResult = normalizeChain(chainOrRecords, currentClassKey);
    var values = [currentClassKey];
    (chainResult.chain || []).forEach(function(item) {
      values.push(item.fromClassKey);
    });
    values = values.concat(additionalClassKeys || []);
    return uniqueStrings(values);
  }

  function resolveClassAtDate(currentClassKey, chainOrRecords, value, options) {
    var opts = options || {};
    var chainResult = normalizeChain(chainOrRecords, currentClassKey);
    var anchorKeys = (chainResult.chain || []).map(function(item) { return item.effectiveDateKey; });
    var dateKey = typeof value === 'number' ? value : parseDateKey(value, {
      fallbackYear: opts.fallbackYear,
      anchorDateKey: opts.anchorDateKey,
      anchorDateKeys: (opts.anchorDateKeys || []).concat(anchorKeys)
    });
    if (!dateKeyToParts(dateKey)) dateKey = null;
    var fallbackClassKey = String(opts.fallbackClassKey || currentClassKey || '').trim();
    if (!dateKey) return { classKey: fallbackClassKey, dateKey: null, matched: false };

    var cursor = String(currentClassKey || '').trim();
    (chainResult.chain || []).forEach(function(transfer) {
      if (transfer.toClassKey !== cursor) return;
      if (dateKey < transfer.effectiveDateKey) cursor = transfer.fromClassKey;
    });
    return { classKey: cursor || fallbackClassKey, dateKey: dateKey, matched: true };
  }

  function normalizeEnrollmentRecord(record, fallbackId) {
    var item = record || {};
    var enrollmentDate = String(item.enrollmentDate || item.effectiveDate || '').trim();
    return {
      id: String(item.id || fallbackId || '').trim(),
      studentName: String(item.studentName || item.name || '').trim(),
      studentKey: String(item.studentKey || '').trim(),
      className: String(item.className || item.toClassName || '').trim(),
      classKey: String(item.classKey || item.toClassKey || item.className || item.toClassName || '').trim(),
      enrollmentDate: enrollmentDate,
      enrollmentDateKey: parseDateKey(enrollmentDate),
      createdAt: item.createdAt || '',
      status: String(item.status || 'active').trim(),
      raw: item
    };
  }

  function looksLikeEnrollmentRecord(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value) &&
      (value.enrollmentDate || value.effectiveDate) &&
      (value.classKey || value.className || value.toClassKey || value.toClassName));
  }

  function listActiveEnrollments(sources) {
    var values = looksLikeEnrollmentRecord(sources) ? [sources] : flattenCollections(sources);
    return values.map(function(item, index) {
      return normalizeEnrollmentRecord(item, item && item.id ? item.id : String(index));
    }).filter(function(item) {
      return item.status !== 'deleted' && item.classKey && item.enrollmentDateKey;
    });
  }

  function mergeEnrollmentLowerBound(sources, options) {
    var opts = options || {};
    var allowedKeys = uniqueStrings(opts.classKeys || []);
    var allowedSet = Object.create(null);
    allowedKeys.forEach(function(key) { allowedSet[key] = true; });
    var records = listActiveEnrollments(sources).filter(function(item) {
      return !allowedKeys.length || !!allowedSet[item.classKey];
    }).sort(function(a, b) {
      var dateDiff = b.enrollmentDateKey - a.enrollmentDateKey;
      if (dateDiff) return dateDiff;
      var createdDiff = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (createdDiff) return createdDiff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
    if (!records.length) return null;
    return {
      dateKey: records[0].enrollmentDateKey,
      date: formatDateKey(records[0].enrollmentDateKey),
      record: records[0],
      records: records
    };
  }

  function isOnOrAfterEnrollmentLowerBound(item, sources, options) {
    var lowerBound = mergeEnrollmentLowerBound(sources, options);
    if (!lowerBound) return true;
    var value = item && (item.date || item.targetDate || item.time);
    var itemKey = parseDateKey(value, {
      fallbackYear: Math.floor(lowerBound.dateKey / 10000),
      anchorDateKey: lowerBound.dateKey
    });
    return !itemKey || itemKey >= lowerBound.dateKey;
  }

  function getFeedbackDateKey(feedback, chainResult, options) {
    var row = feedback || {};
    var timeParts = parseFullDateParts(row.time);
    var fallbackYear = timeParts ? timeParts.year : Number(options && options.fallbackYear) || 0;
    var anchorKeys = (chainResult && chainResult.chain ? chainResult.chain : []).map(function(item) {
      return item.effectiveDateKey;
    });
    var targetKey = parseDateKey(row.targetDate, {
      fallbackYear: fallbackYear,
      preferFallbackYear: !!timeParts,
      anchorDateKeys: anchorKeys
    });
    if (targetKey) return targetKey;
    return parseDateKey(row.time, { anchorDateKeys: anchorKeys });
  }

  function isFeedbackOnPostDate(feedback, postDate, chainResult, options) {
    var postDateKey = parseDateKey(postDate, options || {});
    if (!postDateKey) return false;
    var feedbackDateKey = getFeedbackDateKey(feedback, chainResult, Object.assign({}, options || {}, {
      fallbackYear: Math.floor(postDateKey / 10000)
    }));
    return !!feedbackDateKey && feedbackDateKey === postDateKey;
  }

  function resolveClassName(classKey, classNameByKey, fallbackName) {
    var map = classNameByKey || {};
    return String(map[classKey] || fallbackName || classKey || '').trim();
  }

  function resolveFeedbackScope(options) {
    var opts = options || {};
    var feedback = opts.feedback || {};
    var currentClassKey = String(opts.currentClassKey || '').trim();
    var storedClassKey = String(opts.storedClassKey || feedback.storedClassKey || feedback.sourceClassKey || currentClassKey).trim();
    var chainResult = normalizeChain(opts.chain || opts.transferRecords || {}, currentClassKey);
    var trackedTransferKeys = getTrackedClassKeys(currentClassKey, chainResult);
    var belongsToTransferChain = trackedTransferKeys.indexOf(storedClassKey) !== -1;
    var dateKey = getFeedbackDateKey(feedback, chainResult, opts);
    var displayClassKey = storedClassKey || currentClassKey;

    if (belongsToTransferChain && dateKey) {
      displayClassKey = resolveClassAtDate(currentClassKey, chainResult, dateKey, {
        fallbackClassKey: storedClassKey
      }).classKey;
    }

    var sameCohort = typeof opts.isSameCohort === 'function'
      ? opts.isSameCohort(displayClassKey, currentClassKey)
      : false;
    var storedClassName = resolveClassName(storedClassKey, opts.classNameByKey, feedback.storedClassName || feedback.sourceClassName);
    var displayClassName = resolveClassName(displayClassKey, opts.classNameByKey, displayClassKey === storedClassKey ? storedClassName : '');
    var currentClassName = resolveClassName(currentClassKey, opts.classNameByKey, opts.currentClassName);

    return {
      storedClassKey: storedClassKey,
      storedClassName: storedClassName,
      displayClassKey: displayClassKey,
      displayClassName: displayClassName,
      sourceClassKey: displayClassKey,
      sourceClassName: displayClassName,
      currentClassKey: currentClassKey,
      currentClassName: currentClassName,
      dateKey: dateKey,
      isTransferFormerClass: !!(displayClassKey && currentClassKey && displayClassKey !== currentClassKey && !sameCohort)
    };
  }

  return {
    parseDateKey: parseDateKey,
    formatDateKey: formatDateKey,
    normalizeTransferRecord: normalizeTransferRecord,
    listActiveTransfers: listActiveTransfers,
    selectIncomingTransfer: selectIncomingTransfer,
    buildTransferChain: buildTransferChain,
    getTrackedClassKeys: getTrackedClassKeys,
    resolveClassAtDate: resolveClassAtDate,
    normalizeEnrollmentRecord: normalizeEnrollmentRecord,
    listActiveEnrollments: listActiveEnrollments,
    mergeEnrollmentLowerBound: mergeEnrollmentLowerBound,
    isOnOrAfterEnrollmentLowerBound: isOnOrAfterEnrollmentLowerBound,
    getFeedbackDateKey: getFeedbackDateKey,
    isFeedbackOnPostDate: isFeedbackOnPostDate,
    resolveFeedbackScope: resolveFeedbackScope
  };
});
