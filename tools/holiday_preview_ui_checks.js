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
  await page.setViewportSize({ width: 390, height: 900 });
  const gradeStates = await page.evaluate(async () => {
    const source = '115小六資優自然週六上午班';
    const assignmentId = 'holiday_preview_score';
    const examId = 'holiday-score-exam';
    const exam = {
      date: '2026/09/19', exam: '20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章',
      examId, sourceExamId: examId, colIndex: 6, score: '', scoreNum: null, average: '-',
      sourceClassKey: source, assessmentKind: 'holiday_self_marked', sourceAssignmentId: assignmentId,
      dueAt: Date.now() + 86400000
    };
    const post = {
      date: '2026/09/19', id: 'holiday_score_post', dailyPostId: 'holiday_score_post', sourceClassKey: source,
      title: '第21堂｜小六資優自然', progress: '理化（下）課本作業第十章 概念一',
      hw1: '', hw2: '', quiz: '', makeup: '', note: '', range: '', examData: { exams: [{ main: exam, others: [] }] },
      displayOptions: { holidayPractice: { assignmentId, title: exam.exam, dueAt: exam.dueAt } }
    };
    gData.grades = [exam];
    gData.dailyPost = [post];
    renderDailyPosts([post], []);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const pendingNode = document.querySelector('.main-score');
    const pending = {
      text: pendingNode && pendingNode.textContent.trim(),
      className: pendingNode && pendingNode.querySelector('span') && pendingNode.querySelector('span').className,
      width: pendingNode && pendingNode.getBoundingClientRect().width,
      scrollWidth: pendingNode && pendingNode.scrollWidth
    };
    const feedback = [{
      type: '假期練習回報', targetExamId: examId, targetDate: '2026/09/19', sourceClassKey: source,
      time: '2026-09-21T08:00:00+08:00', content: '假期練習卷已回報：150 分', reportedScore: 150
    }];
    renderDailyPosts([post], feedback);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      pending,
      reported: document.querySelector('.main-score') && document.querySelector('.main-score').textContent.trim(),
      review: document.querySelector('.reviewing-tag') && document.querySelector('.reviewing-tag').textContent.trim(),
      pageWidth: document.documentElement.scrollWidth,
      viewport: innerWidth
    };
  });
  if (gradeStates.pending.text !== '待回報' || !String(gradeStates.pending.className).includes('text-grey-status')) throw new Error('Pending holiday grade state is invalid: ' + JSON.stringify(gradeStates));
  if (gradeStates.pending.scrollWidth > gradeStates.pending.width || gradeStates.reported !== '150分' || gradeStates.review !== '(待審核)') throw new Error('Holiday review state or mobile layout is invalid: ' + JSON.stringify(gradeStates));
  if (gradeStates.pageWidth > gradeStates.viewport) throw new Error('Holiday score card overflows mobile viewport: ' + JSON.stringify(gradeStates));
  checks.push({ width: 390, gradeStates });
  await page.locator('.grade-section').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/holiday-score-review-390.png', fullPage: true });
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { cases: checks.length, checks, pageErrors: errors };
}
