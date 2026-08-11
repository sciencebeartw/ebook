(function(root, factory) {
  var lifecycle = root && root.EbookLifecycleApp;
  if (typeof module !== 'undefined' && module.exports) {
    lifecycle = require('./ebook_lifecycle_app.js');
    module.exports = factory(lifecycle);
    return;
  }
  if (root) root.EbookPromotionApp = factory(lifecycle);
})(typeof window !== 'undefined' ? window : globalThis, function(Lifecycle) {
  'use strict';

  var MAX_PROMOTION_EDGES = 8;
  var STORAGE_MODES = {
    same_grid_renamed: true,
    separate_grids: true
  };

  function text(value) {
    return (value === undefined || value === null ? '' : String(value)).trim();
  }

  function uniqueStrings(values) {
    var result = [];
    var seen = Object.create(null);
    (values || []).forEach(function(value) {
      var normalized = text(value);
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      result.push(normalized);
    });
    return result;
  }

  function dateKeyFromCanonical(value) {
    var raw = text(value);
    var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return 0;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 0;
    return (year * 10000) + (month * 100) + day;
  }

  function dateKeyFromParts(year, month, day) {
    return dateKeyFromCanonical(
      String(year).padStart(4, '0') + '-' +
      String(month).padStart(2, '0') + '-' +
      String(day).padStart(2, '0')
    );
  }

  function parseDateKeyWithAnchors(value, anchorDateKeys) {
    var raw = text(value);
    var full = raw.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if (full) return dateKeyFromParts(Number(full[1]), Number(full[2]), Number(full[3]));
    var partialPattern = /(^|[^0-9])(\d{1,2})([\/.\-])(\d{1,2})(?=[^0-9]|$)/g;
    var partial = null;
    var match;
    while ((match = partialPattern.exec(raw)) !== null) {
      var tokenStart = match.index + match[1].length;
      var tokenEnd = tokenStart + match[2].length + 1 + match[4].length;
      if (match[3] === '-' && (raw.charAt(tokenStart - 1) === '第' || raw.charAt(tokenEnd) === '章')) continue;
      if (dateKeyFromParts(2000, Number(match[2]), Number(match[4]))) {
        partial = { month: Number(match[2]), day: Number(match[4]) };
        break;
      }
    }
    if (!partial) return 0;
    var anchors = uniqueStrings(anchorDateKeys || []).map(Number).filter(function(key) {
      var canonical = String(key);
      return /^\d{8}$/.test(canonical) && dateKeyFromParts(
        Number(canonical.slice(0, 4)),
        Number(canonical.slice(4, 6)),
        Number(canonical.slice(6, 8))
      ) === key;
    });
    if (!anchors.length) return 0;
    var candidateYears = [];
    anchors.forEach(function(anchorKey) {
      var year = Math.floor(anchorKey / 10000);
      candidateYears.push(year - 1, year, year + 1);
    });
    candidateYears = uniqueStrings(candidateYears).map(Number);
    var bestDistance = Infinity;
    var bestKeys = [];
    candidateYears.forEach(function(year) {
      var candidateKey = dateKeyFromParts(year, partial.month, partial.day);
      if (!candidateKey) return;
      var candidateUtc = Date.UTC(year, partial.month - 1, partial.day);
      var distance = Math.min.apply(Math, anchors.map(function(anchorKey) {
        var anchorText = String(anchorKey);
        return Math.abs(candidateUtc - Date.UTC(
          Number(anchorText.slice(0, 4)),
          Number(anchorText.slice(4, 6)) - 1,
          Number(anchorText.slice(6, 8))
        ));
      }));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKeys = [candidateKey];
      } else if (distance === bestDistance && bestKeys.indexOf(candidateKey) === -1) {
        bestKeys.push(candidateKey);
      }
    });
    return bestKeys.length === 1 ? bestKeys[0] : 0;
  }

  function normalizeAllowedClassKeySet(value) {
    var result = Object.create(null);
    if (Array.isArray(value)) {
      value.forEach(function(key) {
        key = text(key);
        if (key) result[key] = true;
      });
      return result;
    }
    Object.keys(value || {}).forEach(function(key) {
      if (value[key] === true) result[text(key)] = true;
    });
    return result;
  }

  function readPolicyKey(policy, key) {
    return text(policy && policy[key]);
  }

  function normalizeEdge(rawEdge, index) {
    var edge = rawEdge || {};
    var transitionKind = text(edge.transitionKind || (edge.promotionId ? 'promotion' : 'transfer'));
    var promotionId = text(edge.promotionId);
    var fromClassKey = text(edge.fromClassKey);
    var toClassKey = text(edge.toClassKey);
    var fromClassName = text(edge.fromClassName || fromClassKey);
    var toClassName = text(edge.toClassName || toClassKey);
    var effectiveDate = text(edge.effectiveDate);
    var effectiveDateKey = dateKeyFromCanonical(effectiveDate);
    var sourceStudentKey = text(edge.sourceStudentKey);
    var studentKey = text(edge.studentKey);
    var transitionId = text(edge.transitionId || (transitionKind === 'promotion' ? promotionId : (edge.id || edge.transferId)));
    if (!transitionId) transitionId = [fromClassKey, toClassKey, effectiveDate, sourceStudentKey, studentKey].join('|');
    var storageMode = text(edge.storageMode);
    var policies = edge.dataPolicies || {};
    var grades = policies.grades || {};
    var dailyPosts = policies.dailyPosts || {};
    var bulletins = policies.bulletins || {};
    var bulletinPolicyName = text(bulletins.policy || 'boundary_history');

    if (transitionKind !== 'promotion' && transitionKind !== 'transfer') throw new Error('promotion-context-invalid-transition-kind:' + index);
    if (!fromClassKey || !toClassKey || fromClassKey === toClassKey) throw new Error('promotion-edge-invalid-class:' + transitionId);
    if (!effectiveDateKey) throw new Error('promotion-edge-invalid-date:' + transitionId);
    if (!sourceStudentKey || !studentKey) throw new Error('promotion-edge-invalid-student-map:' + transitionId);
    if (transitionKind === 'transfer') {
      return {
        transitionId: transitionId,
        id: 'transfer:' + transitionId,
        recordKind: 'transfer',
        transitionKind: 'transfer',
        priority: 30,
        fromClassKey: fromClassKey,
        fromClassName: fromClassName,
        toClassKey: toClassKey,
        toClassName: toClassName,
        effectiveDate: effectiveDate,
        effectiveDateKey: effectiveDateKey,
        sourceStudentKey: sourceStudentKey,
        studentKey: studentKey,
        raw: edge
      };
    }
    if (!promotionId) throw new Error('promotion-edge-missing-id:' + index);
    if (!STORAGE_MODES[storageMode]) throw new Error('promotion-edge-invalid-storage-mode:' + promotionId);

    var normalized = {
      transitionId: transitionId,
      promotionId: promotionId,
      id: 'promotion:' + promotionId,
      recordKind: 'promotion',
      transitionKind: 'promotion',
      priority: 20,
      fromClassKey: fromClassKey,
      fromClassName: fromClassName,
      toClassKey: toClassKey,
      toClassName: toClassName,
      effectiveDate: effectiveDate,
      effectiveDateKey: effectiveDateKey,
      sourceStudentKey: sourceStudentKey,
      studentKey: studentKey,
      storageMode: storageMode,
      dataPolicies: {
        grades: {
          beforeDataClassKey: readPolicyKey(grades, 'beforeDataClassKey'),
          beforeDisplayClassKey: readPolicyKey(grades, 'beforeDisplayClassKey'),
          afterDataClassKey: readPolicyKey(grades, 'afterDataClassKey'),
          afterDisplayClassKey: readPolicyKey(grades, 'afterDisplayClassKey')
        },
        dailyPosts: {
          beforeDataClassKey: readPolicyKey(dailyPosts, 'beforeDataClassKey'),
          afterDataClassKey: readPolicyKey(dailyPosts, 'afterDataClassKey')
        },
        bulletins: {
          beforeDataClassKey: readPolicyKey(bulletins, 'beforeDataClassKey'),
          afterDataClassKey: readPolicyKey(bulletins, 'afterDataClassKey'),
          policy: bulletinPolicyName
        }
      },
      raw: edge
    };

    var gradePolicy = normalized.dataPolicies.grades;
    var postPolicy = normalized.dataPolicies.dailyPosts;
    var bulletinPolicy = normalized.dataPolicies.bulletins;
    if (!gradePolicy.beforeDataClassKey || !gradePolicy.afterDataClassKey ||
        gradePolicy.beforeDisplayClassKey !== fromClassKey || gradePolicy.afterDisplayClassKey !== toClassKey) {
      throw new Error('promotion-edge-invalid-grade-policy:' + promotionId);
    }
    if (!postPolicy.beforeDataClassKey || !postPolicy.afterDataClassKey ||
        postPolicy.beforeDataClassKey !== fromClassKey || postPolicy.afterDataClassKey !== toClassKey) {
      throw new Error('promotion-edge-invalid-post-policy:' + promotionId);
    }
    if (bulletinPolicy.policy !== 'boundary_history' && bulletinPolicy.policy !== 'current_only') {
      throw new Error('promotion-edge-invalid-bulletin-policy:' + promotionId);
    }
    if (bulletinPolicy.afterDataClassKey !== toClassKey) throw new Error('promotion-edge-invalid-bulletin-policy:' + promotionId);
    if (bulletinPolicy.policy === 'boundary_history' && bulletinPolicy.beforeDataClassKey !== fromClassKey) {
      throw new Error('promotion-edge-invalid-bulletin-policy:' + promotionId);
    }
    if (bulletinPolicy.policy === 'current_only' && bulletinPolicy.beforeDataClassKey) {
      throw new Error('promotion-edge-invalid-bulletin-policy:' + promotionId);
    }
    if (storageMode === 'same_grid_renamed' &&
        (gradePolicy.beforeDataClassKey !== toClassKey || gradePolicy.afterDataClassKey !== toClassKey)) {
      throw new Error('promotion-edge-invalid-renamed-grid-policy:' + promotionId);
    }
    if (storageMode === 'separate_grids' &&
        (gradePolicy.beforeDataClassKey !== fromClassKey || gradePolicy.afterDataClassKey !== toClassKey)) {
      throw new Error('promotion-edge-invalid-separate-grid-policy:' + promotionId);
    }
    return normalized;
  }

  function normalizePromotionContext(rawContext, options) {
    var optionsValue = options || {};
    if (!rawContext) {
      return {
        status: 'absent',
        version: 1,
        currentClassKey: text(optionsValue.currentClassKey),
        edges: [],
        promotionEdges: [],
        classNameByKey: {},
        classKeys: [],
        lineageKeyByClassKey: {}
      };
    }
    if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
      throw new Error('promotion-context-invalid-shape');
    }
    if (Number(rawContext.version) !== 1) throw new Error('promotion-context-unsupported-version');
    if (!Array.isArray(rawContext.edges)) throw new Error('promotion-context-invalid-edges');
    if (rawContext.edges.length > MAX_PROMOTION_EDGES) throw new Error('promotion-context-too-deep');

    var currentClassKey = text(optionsValue.currentClassKey || rawContext.currentClassKey);
    var currentStudentKey = text(optionsValue.currentStudentKey);
    if (!currentClassKey || text(rawContext.currentClassKey) !== currentClassKey) {
      throw new Error('promotion-context-current-class-mismatch');
    }
    if (!rawContext.edges.length) {
      return {
        status: 'absent',
        version: 1,
        currentClassKey: currentClassKey,
        edges: [],
        promotionEdges: [],
        classNameByKey: {},
        classKeys: [currentClassKey],
        lineageKeyByClassKey: {}
      };
    }

    var edges = rawContext.edges.map(normalizeEdge).sort(function(a, b) {
      return a.effectiveDateKey - b.effectiveDateKey;
    });
    var seenIds = Object.create(null);
    edges.forEach(function(edge, index) {
      if (seenIds[edge.transitionId]) throw new Error('promotion-context-duplicate-id:' + edge.transitionId);
      seenIds[edge.transitionId] = true;
      if (index > 0) {
        var previous = edges[index - 1];
        if (previous.effectiveDateKey >= edge.effectiveDateKey) throw new Error('promotion-context-date-ambiguity');
        if (previous.toClassKey !== edge.fromClassKey || previous.studentKey !== edge.sourceStudentKey) {
          throw new Error('promotion-context-broken-chain');
        }
      }
    });

    var latest = edges[edges.length - 1];
    if (latest.toClassKey !== currentClassKey) throw new Error('promotion-context-does-not-reach-current-class');
    if (currentStudentKey && latest.studentKey !== currentStudentKey) {
      throw new Error('promotion-context-current-student-mismatch');
    }

    var allowed = normalizeAllowedClassKeySet(optionsValue.allowedClassKeys);
    var hasAllowedConstraint = Object.keys(allowed).length > 0;
    var allReferencedClassKeys = [currentClassKey];
    edges.forEach(function(edge) {
      allReferencedClassKeys.push(edge.fromClassKey, edge.toClassKey);
      Object.keys(edge.dataPolicies || {}).forEach(function(domain) {
        var policy = edge.dataPolicies[domain] || {};
        Object.keys(policy).forEach(function(key) {
          if (/ClassKey$/.test(key) && policy[key]) allReferencedClassKeys.push(policy[key]);
        });
      });
    });
    allReferencedClassKeys = uniqueStrings(allReferencedClassKeys);
    if (hasAllowedConstraint) {
      allReferencedClassKeys.forEach(function(classKey) {
        if (!allowed[classKey]) throw new Error('promotion-context-class-not-authorized:' + classKey);
      });
    }

    var classNameByKey = {};
    edges.forEach(function(edge) {
      classNameByKey[edge.fromClassKey] = edge.fromClassName || edge.fromClassKey;
      classNameByKey[edge.toClassKey] = edge.toClassName || edge.toClassKey;
    });
    var promotionEdges = edges.filter(function(edge) { return edge.recordKind === 'promotion'; });
    if (!promotionEdges.length) {
      return {
        status: 'absent',
        version: 1,
        currentClassKey: currentClassKey,
        edges: edges,
        promotionEdges: [],
        classNameByKey: classNameByKey,
        classKeys: allReferencedClassKeys,
        lineageKeyByClassKey: {}
      };
    }
    var componentParent = {};
    function find(key) {
      if (!componentParent[key]) componentParent[key] = key;
      if (componentParent[key] !== key) componentParent[key] = find(componentParent[key]);
      return componentParent[key];
    }
    function union(left, right) {
      var leftRoot = find(left);
      var rightRoot = find(right);
      if (leftRoot !== rightRoot) componentParent[rightRoot] = leftRoot;
    }
    promotionEdges.forEach(function(edge) { union(edge.fromClassKey, edge.toClassKey); });
    var componentIds = {};
    promotionEdges.forEach(function(edge) {
      var rootKey = find(edge.fromClassKey);
      if (!componentIds[rootKey]) componentIds[rootKey] = [];
      componentIds[rootKey].push(edge.promotionId);
    });
    var lineageKeyByClassKey = {};
    Object.keys(componentParent).forEach(function(classKey) {
      var rootKey = find(classKey);
      lineageKeyByClassKey[classKey] = 'promotion:' + uniqueStrings(componentIds[rootKey] || []).sort().join('>');
    });
    return {
      status: 'ready',
      version: 1,
      currentClassKey: currentClassKey,
      edges: edges,
      promotionEdges: promotionEdges,
      classNameByKey: classNameByKey,
      classKeys: allReferencedClassKeys,
      lineageKeyByClassKey: lineageKeyByClassKey
    };
  }

  function contextHasClass(context, classKey) {
    return !!(context && context.status === 'ready' && context.lineageKeyByClassKey[text(classKey)]);
  }

  function getLineageKey(context, classKey) {
    return contextHasClass(context, classKey) ? context.lineageKeyByClassKey[text(classKey)] : '';
  }

  function getPromotionTransferRecords(context) {
    var result = {};
    if (!context || context.status !== 'ready') return result;
    context.promotionEdges.forEach(function(edge) {
      result[edge.id] = Object.assign({}, edge);
    });
    return result;
  }

  function getVerifiedLifecycleIndexReadScopes(context, currentClassKey, currentStudentKey) {
    var classKey = text(currentClassKey);
    var studentKey = text(currentStudentKey);
    if (!classKey || !studentKey) throw new Error('promotion-lifecycle-read-scope-missing-current-identity');
    if (!context || context.currentClassKey !== classKey) {
      throw new Error('promotion-lifecycle-read-scope-current-class-mismatch');
    }
    var result = [];
    var seen = Object.create(null);
    function add(scopeClassKey, scopeStudentKey) {
      var normalizedClassKey = text(scopeClassKey);
      var normalizedStudentKey = text(scopeStudentKey);
      if (!normalizedClassKey || !normalizedStudentKey) {
        throw new Error('promotion-lifecycle-read-scope-invalid-identity');
      }
      var identity = normalizedClassKey + '|' + normalizedStudentKey;
      if (seen[identity]) return;
      seen[identity] = true;
      result.push({ classKey: normalizedClassKey, studentKey: normalizedStudentKey });
    }
    add(classKey, studentKey);
    (context.edges || []).forEach(function(edge) {
      // Transfer index records are stored under the destination identity. The signed
      // Functions chain is complete, so no public-index branch may expand this scope.
      add(edge.toClassKey, edge.studentKey);
    });
    if (result.length > MAX_PROMOTION_EDGES) {
      throw new Error('promotion-lifecycle-read-scope-too-deep');
    }
    return result;
  }

  function matchesVerifiedLifecycleTransition(context, rawItem, options) {
    var item = rawItem || {};
    var opts = options || {};
    var destinationClassKey = text(opts.destinationClassKey);
    var destinationStudentKey = text(opts.destinationStudentKey);
    var transitionKind = text(item.transitionKind || (item.promotionId ? 'promotion' : 'transfer'));
    var fromClassKey = text(item.fromClassKey);
    var toClassKey = text(item.toClassKey || destinationClassKey);
    var studentKey = text(item.studentKey || destinationStudentKey);
    var sourceStudentKey = text(item.sourceStudentKey || studentKey);
    var effectiveDateKey = Lifecycle && typeof Lifecycle.parseDateKey === 'function'
      ? Lifecycle.parseDateKey(item.effectiveDate, {})
      : 0;
    if (!context || !Array.isArray(context.edges) || !destinationClassKey || !destinationStudentKey ||
        toClassKey !== destinationClassKey || studentKey !== destinationStudentKey ||
        !fromClassKey || !sourceStudentKey || !effectiveDateKey) {
      return false;
    }
    return context.edges.some(function(edge) {
      if (edge.transitionKind !== transitionKind || edge.fromClassKey !== fromClassKey ||
          edge.toClassKey !== toClassKey || edge.effectiveDateKey !== effectiveDateKey ||
          edge.sourceStudentKey !== sourceStudentKey || edge.studentKey !== studentKey) {
        return false;
      }
      if (transitionKind === 'promotion' && text(item.promotionId) && edge.promotionId !== text(item.promotionId)) {
        return false;
      }
      return true;
    });
  }

  function buildPriorityLifecycleChain(explicitRecords, context, currentClassKey, options) {
    if (!Lifecycle || typeof Lifecycle.listActiveTransfers !== 'function') {
      throw new Error('promotion-lifecycle-helper-unavailable');
    }
    var opts = options || {};
    var maxDepth = Number.isInteger(opts.maxDepth) && opts.maxDepth > 0 ? opts.maxDepth : MAX_PROMOTION_EDGES;
    var cursorClassKey = text(currentClassKey);
    var cursorStudentKey = text(opts.currentStudentKey);
    var upperBound = Infinity;
    var publicExplicit = Lifecycle.listActiveTransfers(explicitRecords || {}).filter(function(item) {
      var raw = item.raw || {};
      return text(raw.transitionKind) !== 'promotion' && !text(raw.promotionId);
    }).map(function(item) {
      return Object.assign({}, item, { recordKind: 'transfer', priority: 30 });
    });
    var signedExplicit = context && Array.isArray(context.edges)
      ? context.edges.filter(function(item) { return item.recordKind === 'transfer'; })
      : [];
    var explicitByIdentity = Object.create(null);
    publicExplicit.concat(signedExplicit).forEach(function(item) {
      var identity = [item.fromClassKey, item.toClassKey, item.effectiveDateKey, item.sourceStudentKey, item.studentKey].join('|');
      if (!explicitByIdentity[identity] || item.raw && item.raw.transitionId) explicitByIdentity[identity] = item;
    });
    var explicit = Object.keys(explicitByIdentity).map(function(identity) { return explicitByIdentity[identity]; });
    var promotions = context && context.status === 'ready' ? context.promotionEdges.slice() : [];
    var chain = [];
    var ambiguities = [];
    var seen = Object.create(null);

    function choose(candidates, kind) {
      var eligible = candidates.filter(function(item) {
        return item.toClassKey === cursorClassKey && item.effectiveDateKey < upperBound &&
          (!cursorStudentKey || !item.studentKey || item.studentKey === cursorStudentKey);
      }).sort(function(a, b) {
        var dateDiff = b.effectiveDateKey - a.effectiveDateKey;
        if (dateDiff) return dateDiff;
        var createdDiff = text(b.createdAt).localeCompare(text(a.createdAt));
        if (createdDiff) return createdDiff;
        return text(b.id).localeCompare(text(a.id));
      });
      if (!eligible.length) return null;
      var selected = eligible[0];
      var sameMoment = eligible.filter(function(item) {
        return item.effectiveDateKey === selected.effectiveDateKey;
      });
      var sources = uniqueStrings(sameMoment.map(function(item) {
        return item.fromClassKey + '|' + (item.sourceStudentKey || item.studentKey || '');
      }));
      if (sources.length > 1) {
        ambiguities.push({
          recordKind: kind,
          toClassKey: cursorClassKey,
          effectiveDateKey: selected.effectiveDateKey,
          candidateIds: sameMoment.map(function(item) { return item.id; }),
          sourceIdentities: sources
        });
      }
      return selected;
    }

    for (var depth = 0; cursorClassKey && depth < maxDepth; depth++) {
      var selected = choose(explicit, 'transfer') || choose(promotions, 'promotion');
      if (!selected) break;
      var edgeIdentity = [selected.recordKind, selected.id, selected.fromClassKey, selected.toClassKey, selected.effectiveDateKey].join('|');
      if (seen[edgeIdentity]) break;
      seen[edgeIdentity] = true;
      selected = Object.assign({}, selected, { depth: depth });
      chain.push(selected);
      upperBound = selected.effectiveDateKey;
      cursorClassKey = selected.fromClassKey;
      cursorStudentKey = selected.sourceStudentKey || cursorStudentKey;
    }

    var hasMore = explicit.concat(promotions).some(function(item) {
      return item.toClassKey === cursorClassKey && item.effectiveDateKey < upperBound &&
        (!cursorStudentKey || !item.studentKey || item.studentKey === cursorStudentKey);
    });
    return {
      currentClassKey: text(currentClassKey),
      chain: chain,
      ambiguities: ambiguities,
      truncated: chain.length >= maxDepth && hasMore,
      oldestClassKey: cursorClassKey || text(currentClassKey),
      oldestStudentKey: cursorStudentKey || text(opts.currentStudentKey)
    };
  }

  function getTrackedGradeDataClassKeys(currentClassKey, chainResult) {
    var keys = [text(currentClassKey)];
    var chain = (chainResult && chainResult.chain || []).slice();
    var promotionEdges = chain.filter(function(edge) {
      return edge.recordKind === 'promotion' && edge.dataPolicies && edge.dataPolicies.grades;
    }).sort(function(a, b) {
      return a.effectiveDateKey - b.effectiveDateKey;
    });
    chain.forEach(function(edge) {
      if (edge.recordKind === 'promotion' && edge.dataPolicies && edge.dataPolicies.grades) {
        var dataClassKey = edge.dataPolicies.grades.beforeDataClassKey;
        promotionEdges.forEach(function(later) {
          if (later.effectiveDateKey > edge.effectiveDateKey && later.storageMode === 'same_grid_renamed' && dataClassKey === later.fromClassKey) {
            dataClassKey = later.toClassKey;
          }
        });
        keys.push(dataClassKey);
      } else {
        keys.push(edge.toClassKey, edge.fromClassKey);
      }
    });
    return uniqueStrings(keys);
  }

  function getStudentKeyForClass(context, classKey) {
    var values = [];
    (context && context.edges || []).forEach(function(edge) {
      if (edge.fromClassKey === classKey) values.push(edge.sourceStudentKey);
      if (edge.toClassKey === classKey) values.push(edge.studentKey);
    });
    values = uniqueStrings(values);
    return values.length === 1 ? values[0] : '';
  }

  function resolvePromotionScopeAtDate(context, dateValue, domain) {
    var dateKey = parseDateKeyWithAnchors(
      dateValue,
      context && context.edges ? context.edges.map(function(edge) { return edge.effectiveDateKey; }) : []
    );
    var requestedDomain = domain === 'dailyPosts' || domain === 'bulletins' ? domain : 'grades';
    if (!context || context.status !== 'ready') return { matched: false, reason: 'promotion-context-absent' };
    if (!dateKey) return { matched: false, reason: 'promotion-date-invalid' };

    var edges = context.edges;
    var futureIndex = -1;
    for (var i = 0; i < edges.length; i++) {
      if (dateKey < edges[i].effectiveDateKey) {
        futureIndex = i;
        break;
      }
    }

    var edge = futureIndex >= 0 ? edges[futureIndex] : edges[edges.length - 1];
    if (edge.recordKind !== 'promotion') {
      return { matched: false, reason: 'promotion-scope-owned-by-explicit-transfer' };
    }
    var policy = edge.dataPolicies[requestedDomain];
    var isBefore = futureIndex >= 0;
    if (requestedDomain === 'bulletins' && isBefore && policy.policy === 'current_only') {
      return { matched: false, reason: 'promotion-bulletin-current-only' };
    }
    var logicalClassKey = requestedDomain === 'grades'
      ? (isBefore ? policy.beforeDisplayClassKey : policy.afterDisplayClassKey)
      : (isBefore ? edge.fromClassKey : edge.toClassKey);
    var dataClassKey = isBefore ? policy.beforeDataClassKey : policy.afterDataClassKey;
    var dataStudentKey = getStudentKeyForClass(context, dataClassKey);

    if (requestedDomain === 'grades' && isBefore) {
      for (var j = futureIndex + 1; j < edges.length; j++) {
        var later = edges[j];
        if (later.recordKind === 'promotion' && later.storageMode === 'same_grid_renamed' && dataClassKey === later.fromClassKey) {
          dataClassKey = later.toClassKey;
          dataStudentKey = later.studentKey;
        }
      }
    }
    if (!dataStudentKey) {
      if (dataClassKey === edge.toClassKey) dataStudentKey = edge.studentKey;
      else if (dataClassKey === edge.fromClassKey) dataStudentKey = edge.sourceStudentKey;
    }
    if (!dataClassKey || !logicalClassKey || !dataStudentKey) {
      return { matched: false, reason: 'promotion-scope-ambiguous' };
    }
    return {
      matched: true,
      dateKey: dateKey,
      domain: requestedDomain,
      logicalClassKey: logicalClassKey,
      logicalClassName: context.classNameByKey[logicalClassKey] || logicalClassKey,
      dataClassKey: dataClassKey,
      dataStudentKey: dataStudentKey,
      promotionId: edge.promotionId,
      effectiveDate: edge.effectiveDate,
      isFormerClass: logicalClassKey !== context.currentClassKey
    };
  }

  function getFormerBulletinScopes(context, chainResult) {
    if (!context || context.status !== 'ready') return [];
    var scopes = [];
    var seen = Object.create(null);
    var chronologicalEdges = chainResult && Array.isArray(chainResult.chain)
      ? chainResult.chain.slice().reverse()
      : context.edges.slice();
    for (var edgeIndex = chronologicalEdges.length - 1; edgeIndex >= 0; edgeIndex--) {
      var edge = chronologicalEdges[edgeIndex];
      if (edge.recordKind !== 'promotion') continue;
      if (edge.dataPolicies.bulletins.policy !== 'boundary_history') continue;
      var classKey = edge.dataPolicies.bulletins.beforeDataClassKey;
      var startDate = edgeIndex > 0 ? chronologicalEdges[edgeIndex - 1].effectiveDate : '';
      var scopeIdentity = [classKey, startDate, edge.effectiveDate].join('|');
      if (!classKey || seen[scopeIdentity]) continue;
      seen[scopeIdentity] = true;
      scopes.push({
        classKey: classKey,
        className: context.classNameByKey[classKey] || edge.fromClassName || classKey,
        promotionId: edge.promotionId,
        effectiveDate: edge.effectiveDate,
        startDate: startDate,
        endDate: edge.effectiveDate
      });
    }
    return scopes;
  }

  function getCurrentBulletinStartDate(context, chainResult) {
    if (!context || context.status !== 'ready' || !context.edges.length) return '';
    if (chainResult && Array.isArray(chainResult.chain)) {
      var hasSelectedPromotion = chainResult.chain.some(function(edge) { return edge.recordKind === 'promotion'; });
      if (!hasSelectedPromotion) return '';
      return chainResult.chain.length ? chainResult.chain[0].effectiveDate : '';
    }
    return context.edges[context.edges.length - 1].effectiveDate;
  }

  return {
    MAX_PROMOTION_EDGES: MAX_PROMOTION_EDGES,
    dateKeyFromCanonical: dateKeyFromCanonical,
    parseDateKeyWithAnchors: parseDateKeyWithAnchors,
    normalizePromotionContext: normalizePromotionContext,
    contextHasClass: contextHasClass,
    getLineageKey: getLineageKey,
    getPromotionTransferRecords: getPromotionTransferRecords,
    getVerifiedLifecycleIndexReadScopes: getVerifiedLifecycleIndexReadScopes,
    matchesVerifiedLifecycleTransition: matchesVerifiedLifecycleTransition,
    buildPriorityLifecycleChain: buildPriorityLifecycleChain,
    getTrackedGradeDataClassKeys: getTrackedGradeDataClassKeys,
    resolvePromotionScopeAtDate: resolvePromotionScopeAtDate,
    getFormerBulletinScopes: getFormerBulletinScopes,
    getCurrentBulletinStartDate: getCurrentBulletinStartDate
  };
});
