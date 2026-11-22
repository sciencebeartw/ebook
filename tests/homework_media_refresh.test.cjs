'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { create } = require('../gifted/media-refresh');
const sha = n => n.toString(16).padStart(64, '0');
const image = (questionId = 'q1', n = 1) => ({ dataset: { mediaSha: sha(n) }, closest: () => ({ dataset: { mediaQuestionId: questionId } }) });
const fixture = () => ({ planId: 'plan', segmentId: 'week-1', scopeRevision: 'r1', revision: 4, answers: { q1: 'B' }, submission: null,
  questions: [{ id: 'q1', prompt: '保留題文', media: [{ sha256: sha(1), url: 'https://old.example/1' }],
    options: [{ id: 'A', media: [{ sha256: sha(2), url: 'https://old.example/2' }] }] }] });
const reply = body => ({ items: body.items.map(item => ({ ...item, url: 'https://new.example/' + item.sha256 })) });
test('refresh replaces only URLs and keeps task, answer and question objects', async () => {
  const task = fixture(), before = structuredClone(task), answers = task.answers, q = task.questions[0]; let sent;
  const controller = create({ getTask: () => task, delay: 0, request: async body => { sent = body; return reply(body); } });
  const url = await controller.refreshImage(image());
  assert.equal(task.questions[0], q); assert.equal(task.answers, answers); assert.equal(q.media[0].url, url);
  assert.deepEqual(JSON.parse(JSON.stringify(task, (key, v) => key === 'url' ? undefined : v)), JSON.parse(JSON.stringify(before, (key, v) => key === 'url' ? undefined : v)));
  assert.deepEqual(Object.keys(sent).sort(), ['items', 'planId', 'scopeRevision', 'segmentId']);
});
test('simultaneous question and correction image failures share one request', async () => {
  const task = fixture(), calls = [];
  const controller = create({ getTask: () => task, delay: 0, request: async body => { calls.push(body); return reply(body); } });
  const first = controller.refreshImage(image()), duplicate = controller.refreshImage(image());
  assert.equal(first, duplicate);
  await Promise.all([first, duplicate, controller.refreshImage(image('q1', 2))]);
  assert.equal(calls.length, 1); assert.equal(calls[0].items.length, 2);
  assert.equal(task.questions[0].options[0].media[0].url, 'https://new.example/' + sha(2));
});
test('more than sixteen images are split into bounded batches', async () => {
  const task = fixture(), calls = [];
  task.questions[0].media = Array.from({ length: 35 }, (_, n) => ({ sha256: sha(n + 1), url: 'https://old.example/' + n }));
  const controller = create({ getTask: () => task, delay: 0, request: async body => { calls.push(body.items.length); return reply(body); } });
  await Promise.all(task.questions[0].media.map((_, n) => controller.refreshImage(image('q1', n + 1))));
  assert.deepEqual(calls, [16, 16, 3]);
});
test('an old task response cannot replace a newly opened task', async () => {
  const old = fixture(); let task = old, started, finish;
  const ready = new Promise(resolve => { started = resolve; });
  const controller = create({ getTask: () => task, delay: 0, request: body => { started(); return new Promise(resolve => { finish = () => resolve(reply(body)); }); } });
  const pending = controller.refreshImage(image()); await ready; task = fixture(); finish();
  assert.equal(await pending, null); assert.equal(old.questions[0].media[0].url, 'https://old.example/1');
  assert.equal(task.questions[0].media[0].url, 'https://old.example/1');
});
test('failed recovery can be retried without retaining a rejected promise', async () => {
  const task = fixture(); let calls = 0;
  const controller = create({ getTask: () => task, delay: 0, request: async body => { if (++calls === 1) throw Error('offline'); return reply(body); } });
  await assert.rejects(controller.refreshImage(image()), /offline/);
  assert.match(await controller.refreshImage(image()), /^https:/); assert.equal(calls, 2);
});
test('invalid fingerprints and missing images do not change the task', async () => {
  const task = fixture(); let calls = 0;
  const controller = create({ getTask: () => task, delay: 0, request: async () => { calls++; return { items: [] }; } });
  await assert.rejects(controller.refreshImage(image('other')), /INVALID_MEDIA_REQUEST/); assert.equal(calls, 0);
  const bad = image(); bad.dataset.mediaSha = 'bad';
  await assert.rejects(controller.refreshImage(bad), /INVALID_MEDIA_REQUEST/); assert.equal(calls, 0);
  await assert.rejects(controller.refreshImage(image()), /QUESTION_MEDIA_UNAVAILABLE/);
  assert.equal(task.questions[0].media[0].url, 'https://old.example/1');
});
