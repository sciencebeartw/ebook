(function(root) {
    'use strict';

    const confirmed = new Map();
    let activeSession = '';
    let busy = false;

    function identity() {
        return canUseAdminModeReply() && !isStudentPreviewMode && !isDashboardDraftPreviewMode
            ? ebookGodSessionId : '';
    }

    function binding(item) {
        if (!identity() || !item || item.actorRole !== 'teacher' ||
            !['dashboard_admin', 'ebook_god_teacher'].includes(item.source) ||
            !item.replyToFeedbackKey || !item.clientRequestId || !item.storedStudentKey) return null;
        return {
            className: item.storedClassName || gData.className,
            classKey: item.storedClassKey || safeKey(gData.className),
            studentKey: item.storedStudentKey,
            feedbackKey: item.fbKey,
        };
    }

    function cacheKey(item) {
        return JSON.stringify([item.storedClassKey || safeKey(gData.className), item.storedStudentKey, item.clientRequestId]);
    }

    function overlay(item) {
        const session = identity();
        if (session !== activeSession) {
            confirmed.clear();
            activeSession = session;
        }
        const key = cacheKey(item);
        const revision = session && confirmed.get(key);
        if (!revision) return item;
        if (Date.now() - revision.at > 30000 || (revision.operation === 'withdraw'
            ? item.replyWithdrawn : item.content === revision.content)) {
            confirmed.delete(key);
            return item;
        }
        return { ...item, content: revision.operation === 'withdraw' ? '此回覆已撤回' : revision.content,
            replyWithdrawn: item.replyWithdrawn || revision.operation === 'withdraw' };
    }

    function render(item) {
        const target = binding(item);
        if (!target) return '';
        const actions = item.replyWithdrawn ? '' :
            "<button type='button' data-feedback-operation='edit' onclick='EbookTeacherFeedbackActions.open(this)'>編輯</button>" +
            "<button type='button' data-feedback-operation='withdraw' onclick='EbookTeacherFeedbackActions.open(this)'>撤回</button>";
        return "<details class='ebook-feedback-revision-actions' data-teacher-feedback-actions='1' data-feedback-id='" +
            escapeHtmlAttr(target.feedbackKey) + "' data-feedback-class='" + escapeHtmlAttr(target.classKey) +
            "' data-feedback-student='" + escapeHtmlAttr(target.studentKey) + "'>" +
            "<summary class='ebook-feedback-revision-trigger' aria-label='老師回覆選項'>⋯</summary>" +
            "<div class='ebook-feedback-revision-options'>" + actions +
            "<button type='button' data-feedback-operation='history' onclick='EbookTeacherFeedbackActions.open(this)'>修改紀錄</button>" +
            "</div></details>";
    }

    async function open(button) {
        if (busy) return;
        const menu = button.closest('[data-teacher-feedback-actions]');
        const item = (gData?.feedbackHistory || []).find(row => row.fbKey === menu?.dataset.feedbackId &&
            (row.storedClassKey || safeKey(gData.className)) === menu.dataset.feedbackClass &&
            row.storedStudentKey === menu.dataset.feedbackStudent);
        const target = binding(item);
        if (!target) return;
        const sessionId = identity();
        const active = () => sessionId && identity() === sessionId;
        const callable = getGodSessionCallable('runEbookGodAdminAction');
        const submit = async fields => {
            if (!active()) throw Error('老師視角已切換，請重新開啟回覆。');
            const response = await callable({ sessionId, action: 'feedbackRevisionV2', data: { ...target, ...fields } });
            if (!active()) throw Error('老師視角已切換，請重新開啟回覆。');
            if (response.data.expiresAt) ebookGodSessionInfo.expiresAt = response.data.expiresAt;
            return response.data.result;
        };
        const remember = revision => {
            if (!revision || !active()) return;
            overlay(item);
            confirmed.set(cacheKey(item), { ...revision, at: Date.now() });
            while (confirmed.size > 64) confirmed.delete(confirmed.keys().next().value);
        };
        busy = true;
        menu.open = false;
        button.disabled = true;
        menu.setAttribute('aria-busy', 'true');
        try {
            if (/^p\d{12}_/.test(target.feedbackKey)) {
                target.feedbackKey = await getProductionMessageBridge().nativeReference({
                    subject: BEAR_SUBJECT.replace(/^\//, ''), className: target.className,
                    studentKey: target.studentKey, targetDate: productionMessageDate(item.targetDate),
                }, target.feedbackKey, 'god');
            }
            if (button.dataset.feedbackOperation === 'history') {
                await root.FeedbackRevisionUI.showHistory(Swal, page => submit(page));
                return;
            }
            const initial = await submit({ operation: 'read' });
            if (initial.withdrawn) {
                remember({ operation: 'withdraw', version: initial.version });
                return;
            }
            if (button.dataset.feedbackOperation === 'withdraw') {
                if (await swalConfirm('確定撤回這則回覆？', '撤回後，老師和家長在聯絡簿會看到「此回覆已撤回」。')) {
                    const saved = await submit({ operation: 'withdraw', version: initial.version,
                        requestId: createClientRequestId('god_reply_withdraw') });
                    remember(saved.revision);
                }
            } else {
                remember(await root.FeedbackRevisionUI.edit(Swal, initial, submit,
                    () => createClientRequestId('god_reply_edit')));
            }
        } catch (error) {
            const message = error.code === 'functions/internal' || error.message === 'INTERNAL'
                ? '暫時無法核對這則回覆，請稍後再試。已送出的留言仍保留，不必重新送出。'
                : error.message || '請稍後再試。';
            await swalAlert('無法處理回覆', message, 'warning');
        } finally {
            busy = false;
            button.disabled = false;
            menu.removeAttribute('aria-busy');
            if (active()) root.refreshProductionFeedbackView();
        }
    }

    root.EbookTeacherFeedbackActions = { render, overlay, open, get busy() { return busy; } };
})(window);
