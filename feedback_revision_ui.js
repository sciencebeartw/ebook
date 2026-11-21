(function(root) {
    'use strict';

    async function showHistory(dialog, fetchPage) {
        let beforeVersion = 0;
        do {
            let page;
            let failure;
            let loadingPopup;
            const loading = dialog.fire({ title: '修改紀錄', text: '讀取中…', showConfirmButton: false,
                showCancelButton: true, cancelButtonText: '關閉', didOpen: popup => { loadingPopup = popup; dialog.showLoading(); } });
            page = await fetchPage({ operation: 'history', beforeVersion }).catch(error => { failure = error; });
            if (!loadingPopup || dialog.getPopup() !== loadingPopup || !dialog.isVisible()) return;
            dialog.close();
            await loading;
            if (failure) throw failure;
            const list = document.createElement('div');
            list.className = 'feedback-revision-history';
            for (const entry of page.entries || []) {
                const section = document.createElement('section');
                const time = document.createElement('strong');
                time.textContent = new Date(entry.at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) +
                    (entry.operation === 'withdraw' ? ' 撤回前' : ' 修改前');
                const text = document.createElement('div');
                text.textContent = entry.text || '（只有附件）';
                section.append(time, text);
                list.append(section);
            }
            if (!list.childElementCount) list.textContent = '目前沒有修改紀錄。';
            const result = await dialog.fire({
                title: '修改紀錄',
                html: list,
                showCancelButton: !!page.beforeVersion,
                confirmButtonText: page.beforeVersion ? '更早的紀錄' : '關閉',
                cancelButtonText: '關閉'
            });
            if (!result.isConfirmed) return;
            beforeVersion = page.beforeVersion;
        } while (beforeVersion);
    }

    async function edit(dialog, initial, submit, requestId) {
        let verified;
        let verificationError;
        const verification = Promise.resolve(initial.verified || initial).then(value => { verified = value; },
            error => { verificationError = error; });
        let previousText;
        let id;
        const result = await dialog.fire({
            title: '編輯留言',
            input: 'textarea',
            inputValue: initial.text,
            inputLabel: initial.hasAttachments ? '內容（保留原附件）' : '內容',
            inputAttributes: { maxlength: '5000', rows: '5' },
            showCancelButton: true,
            showLoaderOnConfirm: true,
            confirmButtonText: '儲存',
            cancelButtonText: '取消',
            allowOutsideClick: () => !dialog.isLoading(),
            preConfirm: async value => {
                try {
                    await verification;
                    if (verificationError) throw verificationError;
                    if (verified.withdrawn) throw Error('這則留言已撤回，請關閉視窗。');
                    if (verified.text !== initial.text) throw Error('這則留言已有更新，請關閉後重新開啟。');
                    const text = value.trim();
                    if (text === initial.text) return {};
                    if (text !== previousText) id = requestId();
                    previousText = text;
                    return await submit({ operation: 'edit', version: verified.version, requestId: id, text });
                } catch (error) {
                    dialog.showValidationMessage(error.message || '留言儲存失敗，請再試一次。');
                    return false;
                }
            }
        });
        return result.isConfirmed ? result.value?.revision : null;
    }

    function preview(content, verified) {
        const body = String(content || '').replace(/^\[quote(?::[^\]\r\n]+)?\][\s\S]*?\[\/quote\]\s*/i, '');
        const attachment = body.match(/(?:^|\r?\n)((?:📎 [^\r\n]+\r?\n)?\[附件\]https?:\/\/[^\s]+(?:\r?\n(?:📎 [^\r\n]+\r?\n)?\[附件\]https?:\/\/[^\s]+)*)\s*$/i);
        // Handle rejection immediately even while the person is choosing an action.
        const safe = Promise.resolve(verified).then(value => ({ value }), error => ({ error }));
        const ready = safe.then(result => { if (result.error) throw result.error; return result.value; });
        ready.catch(() => {});
        return { text: (attachment ? body.slice(0, attachment.index) : body).trim(), hasAttachments: !!attachment,
            verified: ready };
    }
    root.FeedbackRevisionUI = { edit, showHistory, preview };
})(window);
