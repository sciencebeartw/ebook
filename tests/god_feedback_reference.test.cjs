'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { create } = require('../fastwrite_message_bridge');
test('God-view native reference preserves its session and role; Dashboard keeps its default', async () => {
    for (const mode of ['teacher', 'god']) {
        const calls = [], eventId = 'p000000000001_' + 'a'.repeat(64);
        const bridge = create({ scopes: [{ enabled: true, subject: 'science', className: '測試班', classKey: '測試班', scopeId: 'class_test', epoch: 1 }],
            storage: {}, getUid: () => 'test-user', getSessionId: () => 'test-god-session', hash: async () => 'b'.repeat(64),
            callableFor: value => value, transport: { create(options) { calls.push(options); return {
                legacyReference: async messageId => ({ messageId, feedbackKey: 'original-reply-123', authority: 'firebase', verified: true })
            }; } } });
        const payload = { subject: 'science', className: '測試班', studentKey: '測試學生', targetDate: '2026/11/21' };
        assert.equal(await bridge.nativeReference(payload, eventId, mode === 'god' ? mode : undefined), 'original-reply-123');
        assert.equal(calls[0].callable, mode);
        assert.equal(calls[0].sessionId, mode === 'god' ? 'test-god-session' : undefined);
        await assert.rejects(bridge.nativeReference(payload, eventId, 'student'), /invalid-message-reference/);
        assert.equal(calls.length, 1);
    }
});
