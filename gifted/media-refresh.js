(function (root) {
  'use strict';
  // 更新短效圖片網址時，不採用伺服器草稿／版本／收件狀態，保留當頁尚未送出的答案。
  function refreshUrls(current, fresh) {
    for (const key of ['planId', 'segmentId', 'scopeRevision']) {
      if (current[key] !== fresh[key]) throw Error('ASSIGNMENT_VERSION_CHANGED');
    }
    const shape = value => JSON.stringify(value, (key, item) => key === 'url' ? undefined : item);
    if (shape(current.questions) !== shape(fresh.questions)) throw Error('QUESTION_CONTENT_MISMATCH');
    return { ...current, questions: fresh.questions };
  }
  // 圖片恢復不重畫題面，也不取得答案；同時失效的題圖合併成有限的小批次。
  function create({ getTask, request, delay = 50 }) {
    const scopes = new WeakMap();
    function refreshImage(image) {
      const task = getTask(), questionId = image.closest('[data-media-question-id]')?.dataset.mediaQuestionId;
      const sha256 = image.dataset.mediaSha;
      if (!task || !task.questions.some(q => q.id === questionId) || !/^[a-f0-9]{64}$/.test(sha256)) return Promise.reject(Error('INVALID_MEDIA_REQUEST'));
      const first = task.firstImage;
      if (image.hasAttribute?.('data-media-deferred') && first?.questionId === questionId && first.sha256 === sha256) {
        return first.load().then(url => {
          if (getTask() !== task) return null;
          return typeof url === 'string' && url.startsWith('blob:') ? url : refreshInScope(task, questionId, sha256);
        });
      }
      return refreshInScope(task, questionId, sha256);
    }
    function refreshInScope(task, questionId, sha256) {
      let scope = scopes.get(task);
      if (!scope) { scope = { pending: new Map(), queue: [], timer: null }; scopes.set(task, scope); }
      const key = JSON.stringify([questionId, sha256]);
      if (scope.pending.has(key)) return scope.pending.get(key);
      const promise = new Promise((resolve, reject) => { scope.queue.push({ questionId, sha256, key, resolve, reject }); });
      scope.pending.set(key, promise);
      if (scope.timer === null) scope.timer = setTimeout(() => flush(task, scope), delay);
      return promise;
    }
    async function flush(task, scope) {
      scope.timer = null;
      const queued = scope.queue.splice(0);
      for (let offset = 0; offset < queued.length; offset += 16) {
        const batch = queued.slice(offset, offset + 16);
        try {
          if (getTask() !== task) { batch.forEach(item => item.resolve(null)); continue; }
          const response = await request({ planId: task.planId, segmentId: task.segmentId, scopeRevision: task.scopeRevision,
            items: batch.map(({ questionId, sha256 }) => ({ questionId, sha256 })) });
          if (getTask() !== task) { batch.forEach(item => item.resolve(null)); continue; }
          const urls = new Map((response.items || []).map(item => [JSON.stringify([item.questionId, item.sha256]), item.url]));
          for (const item of batch) {
            const url = urls.get(item.key);
            if (typeof url !== 'string' || !url.startsWith('https://')) { item.reject(Error('QUESTION_MEDIA_UNAVAILABLE')); continue; }
            const q = task.questions.find(q => q.id === item.questionId);
            for (const media of [...(q.media || []), ...(q.options || []).flatMap(o => o.media || [])]) {
              if (media.sha256 === item.sha256) media.url = url;
            }
            item.resolve(url);
          }
        } catch (error) { batch.forEach(item => item.reject(error)); }
        finally { batch.forEach(item => scope.pending.delete(item.key)); }
      }
    }
    return { refreshImage };
  }
  const api = { refreshUrls, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GiftedMediaRefresh = api;
})(typeof window !== 'undefined' ? window : globalThis);
