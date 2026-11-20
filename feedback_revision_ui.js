(function(root) {
    'use strict';

    async function showHistory(dialog, fetchPage) {
        let beforeVersion = 0;
        do {
            const page = await fetchPage({ operation: 'history', beforeVersion });
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
                    const text = value.trim();
                    if (text === initial.text) return {};
                    if (text !== previousText) id = requestId();
                    previousText = text;
                    return await submit({ operation: 'edit', version: initial.version, requestId: id, text });
                } catch (error) {
                    dialog.showValidationMessage(error.message || '留言儲存失敗，請再試一次。');
                    return false;
                }
            }
        });
        return result.isConfirmed ? result.value?.revision : null;
    }

    root.FeedbackRevisionUI = { edit, showHistory };
})(window);
