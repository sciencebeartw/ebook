(function(root, factory) {
    var api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.EbookFeedbackThreads = api;
})(typeof window !== "undefined" ? window : globalThis, function() {
    "use strict";

    var STUDENT_CONVERSATION_TYPES = {
        "學生留言": true,
        "家長留言": true,
        "家長/學生": true,
        "作業上傳": true
    };
    var OPERATIONAL_TYPES = {
        "棒卡申請": true,
        "缺考回報": true,
        "補考回報": true,
        "補考結果回報": true
    };
    var TRUSTED_TEACHER_SOURCES = {
        "dashboard_direct": true,
        "dashboard_admin": true,
        "ebook_god_teacher": true,
        "spreadsheet_sidebar": true
    };

    function text(value) {
        return value === undefined || value === null ? "" : String(value);
    }

    function normalizedKey(value) {
        return text(value).trim();
    }

    function normalizedWhitespace(value) {
        return text(value).replace(/\s+/g, " ").trim();
    }

    function normalizedScopeKey(value) {
        return normalizedKey(value).replace(/[.#$[\]]/g, "-");
    }

    function canonicalDateKey(value) {
        var match = normalizedKey(value).match(/^(\d{4})([\/-])(\d{1,2})\2(\d{1,2})$/);
        if (!match) return "";
        var year = Number(match[1]);
        var month = Number(match[3]);
        var day = Number(match[4]);
        var probe = new Date(Date.UTC(year, month - 1, day));
        if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return "";
        return String(year).padStart(4, "0") + "/" + String(month).padStart(2, "0") + "/" + String(day).padStart(2, "0");
    }

    function isTeacherFeedback(item) {
        item = item || {};
        var actorRole = normalizedKey(item.actorRole).toLowerCase();
        var source = normalizedKey(item.source).toLowerCase();
        var type = normalizedKey(item.type);
        if (actorRole === "teacher" || actorRole === "admin") return true;
        if (TRUSTED_TEACHER_SOURCES[source] || source.indexOf("teacher") > -1) return true;
        return /老師(?:留言|回覆)$/.test(type);
    }

    function isConversationFeedback(item) {
        item = item || {};
        var type = normalizedKey(item.type);
        if (OPERATIONAL_TYPES[type]) return false;
        if (STUDENT_CONVERSATION_TYPES[type]) return true;
        return isTeacherFeedback(item);
    }

    function isStudentFeedback(item) {
        return isConversationFeedback(item) && !isTeacherFeedback(item);
    }

    // Keep parent eligibility aligned with the backend validator. Legacy teacher
    // rows may still look like teacher messages, but only these strongly
    // identified records are safe as a new student reply target.
    function isReplyableFeedback(item) {
        item = item || {};
        var type = normalizedKey(item.type);
        if (STUDENT_CONVERSATION_TYPES[type]) return true;
        var actorRole = normalizedKey(item.actorRole).toLowerCase();
        var source = normalizedKey(item.source).toLowerCase();
        return actorRole === "teacher" && !!TRUSTED_TEACHER_SOURCES[source] && /老師(?:留言|回覆)/.test(type);
    }

    function parseLeadingQuote(value) {
        var source = text(value);
        var match = source.match(/^\s*\[quote(?::([^\]]+))?\]([\s\S]*?)\[\/quote\]\s*/i);
        if (!match) return null;
        return {
            type: normalizedWhitespace(match[1] || ""),
            quotedContent: normalizedWhitespace(match[2]),
            rest: source.slice(match[0].length),
            raw: match[0]
        };
    }

    function typesMatch(quotedType, candidate) {
        var quote = normalizedWhitespace(quotedType);
        var candidateType = normalizedWhitespace(candidate && candidate.type);
        if (!quote || !candidateType) return true;
        if (quote === candidateType) return true;
        if (quote === "學生留言" && STUDENT_CONVERSATION_TYPES[candidateType]) return true;
        return false;
    }

    function quoteMatchesContent(quotedContent, candidateContent) {
        var quote = normalizedWhitespace(quotedContent);
        var candidate = normalizedWhitespace(candidateContent);
        if (!quote || !candidate) return false;
        if (quote === candidate) return true;
        if (/\.\.\.$/.test(quote)) {
            var prefix = quote.slice(0, -3).trim();
            return prefix.length >= 8 && candidate.indexOf(prefix) === 0;
        }
        return false;
    }

    function getComparableTime(item, fallbackIndex) {
        var value = new Date(item && item.time).getTime();
        return Number.isFinite(value) ? value : fallbackIndex;
    }

    function sameScope(parent, child) {
        var parentDate = canonicalDateKey(parent && parent.targetDate);
        var childDate = canonicalDateKey(child && child.targetDate);
        if (!parentDate || !childDate || parentDate !== childDate) return false;

        // The feedback key lives under the stored class node. Prefer that exact
        // identity when a transferred/renamed class also carries a display source.
        var parentClass = normalizedScopeKey(parent && (parent.storedClassKey || parent.sourceClassKey));
        var childClass = normalizedScopeKey(child && (child.storedClassKey || child.sourceClassKey));
        if (parentClass && childClass && parentClass !== childClass) return false;

        var parentStudent = normalizedScopeKey(parent && parent.storedStudentKey);
        var childStudent = normalizedScopeKey(child && child.storedStudentKey);
        if (parentStudent && childStudent && parentStudent !== childStudent) return false;
        return true;
    }

    function stableLegacyId(item, index) {
        var value = [item && item.targetDate, item && item.time, item && item.type, item && item.content, index]
            .map(text)
            .join("\u001f");
        var hash = 2166136261;
        for (var i = 0; i < value.length; i++) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return "legacy_" + (hash >>> 0).toString(36) + "_" + index;
    }

    function buildFeedbackThreads(items, options) {
        options = options || {};
        var maxDepth = Math.max(2, Math.min(50, Number(options.maxDepth) || 12));
        var source = Array.isArray(items) ? items : [];
        var conversations = [];
        var operational = [];

        source.forEach(function(item, sourceIndex) {
            var record = { item: item || {}, sourceIndex: sourceIndex };
            if (isConversationFeedback(record.item)) conversations.push(record);
            else operational.push(record);
        });

        var keyBuckets = {};
        conversations.forEach(function(record, index) {
            record.index = index;
            record.key = normalizedKey(record.item.fbKey || record.item.feedbackKey || record.item.id);
            record.threadItemId = record.key || stableLegacyId(record.item, record.sourceIndex);
            record.leadingQuote = parseLeadingQuote(record.item.content);
            if (record.key) {
                if (!keyBuckets[record.key]) keyBuckets[record.key] = [];
                keyBuckets[record.key].push(record);
            }
        });

        var rawExplicitParentByIndex = {};
        conversations.forEach(function(record) {
            var explicitParentKey = normalizedKey(record.item.replyToFeedbackKey);
            record.requestedParentKey = explicitParentKey;
            record.relation = "root";
            if (explicitParentKey) {
                var explicitCandidates = (keyBuckets[explicitParentKey] || []).filter(function(candidate) {
                    return sameScope(candidate.item, record.item);
                });
                if (explicitCandidates.length === 1) {
                    rawExplicitParentByIndex[record.index] = explicitCandidates[0].index;
                }
            }
        });

        var invalidExplicit = {};
        conversations.forEach(function(record) {
            var cursor = record.index;
            var path = [];
            var seenAt = {};
            while (Object.prototype.hasOwnProperty.call(rawExplicitParentByIndex, cursor)) {
                if (Object.prototype.hasOwnProperty.call(seenAt, cursor)) {
                    path.slice(seenAt[cursor]).forEach(function(index) { invalidExplicit[index] = "cycle"; });
                    break;
                }
                if (path.length >= maxDepth) {
                    path.forEach(function(index) { invalidExplicit[index] = "max_depth"; });
                    break;
                }
                seenAt[cursor] = path.length;
                path.push(cursor);
                cursor = rawExplicitParentByIndex[cursor];
            }
        });

        var parentByIndex = {};
        conversations.forEach(function(record) {
            var explicitParentKey = record.requestedParentKey;
            if (explicitParentKey) {
                var rawParentIndex = rawExplicitParentByIndex[record.index];
                var rawParent = rawParentIndex === undefined ? null : conversations[rawParentIndex];
                if (invalidExplicit[record.index]) {
                    record.relation = invalidExplicit[record.index];
                } else if (rawParent && rawParent !== record) {
                    parentByIndex[record.index] = rawParent.index;
                    record.relation = "explicit";
                    record.parentKey = explicitParentKey;
                } else {
                    record.relation = "orphan";
                }
                return;
            }

            if (!record.leadingQuote || !isTeacherFeedback(record.item)) return;
            var inferred = conversations.filter(function(candidate) {
                return candidate !== record && candidate.sourceIndex < record.sourceIndex &&
                    sameScope(candidate.item, record.item) &&
                    typesMatch(record.leadingQuote.type, candidate.item) &&
                    quoteMatchesContent(record.leadingQuote.quotedContent, candidate.item.content);
            });
            if (inferred.length === 1) {
                parentByIndex[record.index] = inferred[0].index;
                record.relation = "legacy_quote";
                record.parentKey = inferred[0].key;
            }
        });

        // Any cycle or over-deep chain is invalidated as a whole. This deliberately
        // leaves the affected messages as independent roots instead of guessing.
        conversations.forEach(function(record) {
            var cursor = record.index;
            var path = [];
            var seen = {};
            while (Object.prototype.hasOwnProperty.call(parentByIndex, cursor)) {
                if (seen[cursor] || path.length >= maxDepth) {
                    path.forEach(function(index) {
                        delete parentByIndex[index];
                        conversations[index].relation = path.length >= maxDepth ? "max_depth" : "cycle";
                    });
                    break;
                }
                seen[cursor] = true;
                path.push(cursor);
                cursor = parentByIndex[cursor];
            }
        });

        function resolveRootIndex(index) {
            var cursor = index;
            var steps = 0;
            while (Object.prototype.hasOwnProperty.call(parentByIndex, cursor) && steps < maxDepth) {
                cursor = parentByIndex[cursor];
                steps += 1;
            }
            return cursor;
        }

        function resolveDepth(index) {
            var cursor = index;
            var depth = 0;
            while (Object.prototype.hasOwnProperty.call(parentByIndex, cursor) && depth < maxDepth) {
                cursor = parentByIndex[cursor];
                depth += 1;
            }
            return depth;
        }

        var threadByRootIndex = {};
        conversations.forEach(function(record) {
            var rootIndex = resolveRootIndex(record.index);
            if (!threadByRootIndex[rootIndex]) {
                var rootRecord = conversations[rootIndex];
                threadByRootIndex[rootIndex] = {
                    id: rootRecord.threadItemId,
                    root: null,
                    messages: [],
                    sourceIndex: rootRecord.sourceIndex
                };
            }
            var displayContent = text(record.item.content);
            if (Object.prototype.hasOwnProperty.call(parentByIndex, record.index) && record.leadingQuote) {
                displayContent = record.leadingQuote.rest.replace(/^\s+/, "");
            }
            var wrapped = {
                item: record.item,
                key: record.key,
                parentKey: record.parentKey || "",
                relation: record.relation,
                displayContent: displayContent,
                sourceIndex: record.sourceIndex,
                depth: resolveDepth(record.index),
                threadItemId: record.threadItemId
            };
            threadByRootIndex[rootIndex].messages.push(wrapped);
            if (record.index === rootIndex) threadByRootIndex[rootIndex].root = wrapped;
        });

        var threads = Object.keys(threadByRootIndex).map(function(rootIndex) {
            var thread = threadByRootIndex[rootIndex];
            thread.messages.sort(function(left, right) {
                return getComparableTime(left.item, left.sourceIndex) - getComparableTime(right.item, right.sourceIndex) ||
                    left.depth - right.depth ||
                    left.sourceIndex - right.sourceIndex;
            });
            thread.root = thread.root || thread.messages[0];
            thread.replies = thread.messages.filter(function(message) { return message !== thread.root; });
            return thread;
        }).sort(function(left, right) {
            return left.sourceIndex - right.sourceIndex;
        });

        var blocks = operational.map(function(record) {
            return { kind: "operational", item: record.item, sourceIndex: record.sourceIndex };
        }).concat(threads.map(function(thread) {
            return { kind: "thread", thread: thread, sourceIndex: thread.sourceIndex };
        })).sort(function(left, right) {
            return left.sourceIndex - right.sourceIndex;
        });

        return { threads: threads, operational: operational.map(function(record) { return record.item; }), blocks: blocks };
    }

    function getLatestKeyedMessage(thread) {
        var messages = thread && Array.isArray(thread.messages) ? thread.messages : [];
        for (var i = messages.length - 1; i >= 0; i--) {
            if (normalizedKey(messages[i].key)) return messages[i];
        }
        return null;
    }

    function getLatestReplyableKeyedMessage(thread) {
        var messages = thread && Array.isArray(thread.messages) ? thread.messages : [];
        for (var i = messages.length - 1; i >= 0; i--) {
            if (normalizedKey(messages[i].key) && isReplyableFeedback(messages[i].item)) return messages[i];
        }
        return null;
    }

    function getLatestStudentMessage(thread) {
        var messages = thread && Array.isArray(thread.messages) ? thread.messages : [];
        for (var i = messages.length - 1; i >= 0; i--) {
            if (normalizedKey(messages[i].key) && isStudentFeedback(messages[i].item)) return messages[i];
        }
        return null;
    }

    return {
        buildFeedbackThreads: buildFeedbackThreads,
        canonicalDateKey: canonicalDateKey,
        getLatestKeyedMessage: getLatestKeyedMessage,
        getLatestReplyableKeyedMessage: getLatestReplyableKeyedMessage,
        getLatestStudentMessage: getLatestStudentMessage,
        isConversationFeedback: isConversationFeedback,
        isReplyableFeedback: isReplyableFeedback,
        isStudentFeedback: isStudentFeedback,
        isTeacherFeedback: isTeacherFeedback,
        parseLeadingQuote: parseLeadingQuote,
        quoteMatchesContent: quoteMatchesContent
    };
});
