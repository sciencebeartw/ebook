(function(root){
'use strict';

const entries = {
    runEbookGasAdminAction: {
        target: 'runEbookAdminLearning',
        actions: new Set([
            'fastWriteGradeViewV1', 'fastWriteGradeBatchV1', 'fastWritePublicationV1',
            'fastWriteBulletinV1', 'getClassSessionPlan', 'dashboardBackgroundTasksV1',
        ]),
    },
    runEbookGodAdminAction: {target: 'runEbookGodLearning', actions: new Set()},
    runEbookStudentAction: {
        target: 'runEbookStudentLearning',
        actions: new Set([
            'getHomeworkAnswers', 'getHolidayPracticeAnswer', 'getHolidayPracticeContext',
            'submitHomeworkDone', 'reportHomeworkPaper', 'unlockHolidayPractice', 'reportHolidayPractice',
        ]),
    },
};
const gradeReads = new Set(['read', 'receipt', 'mirror', 'history']);
const legacyHomework = new Set(['submitHomeworkDone', 'reportHomeworkPaper', 'unlockHolidayPractice', 'reportHolidayPractice']);
const fallbackReason = 'learning-legacy-authority-v1';

function targetFor(entry, input) {
    if (!Object.hasOwn(entries, entry) || !input || typeof input !== 'object') return '';
    const { target, actions } = entries[entry];
    if (actions.has(input.action)) return target;
    const p = input.data;
    if (input.action !== 'fastWriteV1' || !/^grade_[a-f0-9]{40}$/.test(p?.entityId || '') || p.messageSource) return '';
    if (gradeReads.has(p.operation) || (entry !== 'runEbookStudentAction' &&
        p.operation === 'commit' && p.command?.action === 'set_score' &&
        !Object.hasOwn(p.command.data || {}, 'examResult'))) return target;
    return '';
}

function mayUseLegacy(entry, input) {
    return (entry === 'runEbookStudentAction' && legacyHomework.has(input.action)) ||
        (entry === 'runEbookGasAdminAction' && input.action === 'fastWriteGradeViewV1' && input.data?.firebaseOnly !== true);
}

function createCallable(app, entry, options, original = app.functions().httpsCallable(entry, options)) {
    if (!Object.hasOwn(entries, entry)) return original;
    const nearby = app.functions('asia-southeast1').httpsCallable(entries[entry].target, options);
    return async input => {
        if (!targetFor(entry, input)) return original(input);
        const uid = app.auth().currentUser?.uid;
        try {
            return await nearby(input);
        } catch (error) {
            // This marker is returned only before the first legacy write or grade provisioning.
            if (error?.code !== 'functions/failed-precondition' || error.details?.reason !== fallbackReason ||
                !mayUseLegacy(entry, input) || !uid || app.auth().currentUser?.uid !== uid) throw error;
            return original(input);
        }
    };
}
root.LearningRegionTransport = {createCallable, targetFor};
if (typeof module !== 'undefined') module.exports = root.LearningRegionTransport;
})(typeof window === 'undefined' ? globalThis : window);
