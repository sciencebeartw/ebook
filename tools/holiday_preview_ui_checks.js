// Playwright CLI run-code --filename tools/holiday_preview_ui_checks.js
// 只在 dashboard-draft 隔離預覽注入假資料，不送出回報、讀取學生資料或取得答案網址。
async (page) => {
  if (!page.url().includes('preview=dashboard-draft')) throw new Error('Requires isolated draft preview');
  await page.waitForLoadState('load');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.evaluate(async () => {
      const source = '115小六資優自然週六上午班';
      const assignmentId = 'holiday_preview_visual';
      const post = {
        date: '2026/09/19', id: 'holiday_preview_post', dailyPostId: 'holiday_preview_post',
        className: source, sourceClassKey: source, title: '第21堂｜小六資優自然',
        progress: '理化（下）課本作業第十章 概念一', hw1: '課本作業', hw2: '完成假期練習卷', quiz: '', makeup: '', note: '', range: '',
        displayOptions: {
          homework: { doneMode: 'show' }, links: { holidayColor: 'orange' },
          holidayPractice: {
            assignmentId, title: '20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章',
            questionUrl: 'https://example.test/holiday-question.pdf', dueDate: '2026-10-03', dueTime: '09:00', dueAt: Date.now() + 86400000
          }
        }
      };
      enterDashboardDraftPreview({ className: source, studentName: '測試學生', dailyPosts: [post], bulletins: [] });
      switchTab(0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const card = document.querySelector('[data-holiday-card]');
      const previewButton = card && card.querySelector('.holiday-preview-btn');
      const questionLink = card && card.querySelector('.btn-link.post-button-orange');
      const generalButton = document.querySelector('.homework-done-box .homework-done-btn:not(.holiday-unlock-btn)');
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        questionText: questionLink && questionLink.textContent.trim(),
        previewText: previewButton && previewButton.textContent.trim(),
        previewDisabled: !!(previewButton && previewButton.disabled),
        previewHeight: previewButton && previewButton.getBoundingClientRect().height,
        generalText: generalButton && generalButton.textContent.trim(),
        generalIsHoliday: !!(generalButton && generalButton.classList.contains('holiday-unlock-btn')),
        privateAnswerExposed: document.documentElement.innerHTML.includes('holiday-answer.pdf')
      };
    });
    if (!result.questionText || !result.questionText.includes('20260926-27 小六資優自然')) throw new Error('Holiday filename/title is missing: ' + JSON.stringify(result));
    if (result.previewText !== '我已完成，顯示答案' || !result.previewDisabled || result.previewHeight < 44) throw new Error('Holiday preview button is invalid: ' + JSON.stringify(result));
    if (result.generalText !== '我已完成本次一般作業' || result.generalIsHoliday) throw new Error('General and holiday completion controls are not distinct: ' + JSON.stringify(result));
    if (result.privateAnswerExposed || result.pageWidth > result.viewport) throw new Error('Privacy or layout check failed: ' + JSON.stringify(result));
    checks.push({ width, ...result });
    await page.locator('[data-holiday-card]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/playwright/holiday-preview-${width}.png`, fullPage: true });
  }
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { cases: checks.length, checks, pageErrors: errors };
}
