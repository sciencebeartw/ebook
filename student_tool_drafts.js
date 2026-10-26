(function(root){'use strict';
    // Only preserve the current student's unsent form state during a live redraw.
    // Files remain in the existing attachment draft store; nothing is persisted.
    function capture(host, identity) {
        if (!identity || host.dataset.studentToolDraftIdentity !== identity) return null;
        const active = host.ownerDocument.activeElement;
        const tools = Array.from(host.querySelectorAll('.student-learning-report details.compact-student-tool')).map(tool => ({
            id: tool.querySelector('[id]')?.id,
            open: tool.open,
            fields: Array.from(tool.querySelectorAll('input[id],select[id],textarea[id]')).filter(el => el.type !== 'file').map(el => ({
                id: el.id, value: el.value, display: el.style.display,
                focus: el === active, start: el.selectionStart, end: el.selectionEnd
            }))
        }));
        return {identity, tools};
    }
    function restore(host, state, identity) {
        host.dataset.studentToolDraftIdentity = identity;
        if (!state || state.identity !== identity) return;
        const byId = new Map(Array.from(host.querySelectorAll('.student-learning-report [id]')).map(el => [el.id, el]));
        for (const tool of state.tools) {
            const details = byId.get(tool.id)?.closest('details.compact-student-tool');
            if (!details) continue;
            details.open = tool.open;
            for (const field of tool.fields) {
                const el = byId.get(field.id);
                if (!el || el.type === 'file' || !details.contains(el)) continue;
                if (el.tagName === 'SELECT' && !Array.from(el.options).some(option => option.value === field.value)) continue;
                el.value = field.value;
                el.style.display = field.display;
                if (field.focus && !host.ownerDocument.hidden) {
                    el.focus({preventScroll:true});
                    if (typeof field.start === 'number') el.setSelectionRange(field.start, field.end);
                }
            }
        }
    }
    root.StudentToolDrafts = {capture, restore};
    if (typeof module !== 'undefined') module.exports = root.StudentToolDrafts;
})(typeof window !== 'undefined' ? window : globalThis);
