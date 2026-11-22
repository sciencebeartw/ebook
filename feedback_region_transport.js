(function(root){
    'use strict';
    const targets = {runEbookStudentAction:'runEbookStudentFeedback',runEbookGodAdminAction:'runEbookGodFeedback',runEbookGasAdminAction:'runEbookAdminFeedback'};
    const ops = new Set(['prepare','read','watch','renew','commit','receipt','mirror','history','legacyReference','head']);
    function isFeedbackRequest(input) {
        if (!input || typeof input !== 'object') return false;
        if (['feedbackRevisionV2','fastWriteMessageViewV1'].includes(input.action)) return true;
        return input.action === 'fastWriteV1' && /^chat_[a-f0-9]{40}$/.test(input.data?.entityId || '') && ops.has(input.data?.operation);
    }
    function createCallable(app, name, options) {
        const original = app.functions().httpsCallable(name, options);
        if (!targets[name]) return original;
        const feedback = app.functions('asia-southeast1').httpsCallable(targets[name], options);
        // 不自動跨區重送。結果不明時，既有 transport 保留原 request 並查核同一收據。
        return input => (isFeedbackRequest(input) ? feedback : original)(input);
    }
    root.FeedbackRegionTransport = {createCallable,isFeedbackRequest};
    if (typeof module !== 'undefined') module.exports = root.FeedbackRegionTransport;
})(typeof window === 'undefined' ? globalThis : window);
