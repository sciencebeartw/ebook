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
  const api = { refreshUrls };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GiftedMediaRefresh = api;
})(typeof window !== 'undefined' ? window : globalThis);
