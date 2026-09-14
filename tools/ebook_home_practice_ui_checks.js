// Playwright CLI run-code --filename tools/ebook_home_practice_ui_checks.js
// 只在 dashboard-draft 隔離預覽注入假資料，不送出回報或讀取學生資料。
async (page) => {
  if (!page.url().includes('preview=dashboard-draft')) throw new Error('Requires isolated draft preview');
  await page.waitForLoadState('load');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const attached of [false, true]) {
      for (const pending of [false, true]) {
        const result = await page.evaluate(async ({ attached, pending }) => {
          const source = '115小六資優自然週六上午班';
          const practice = { date: '2026/09/19', exam: '回家練習卷：理化第1-8章', examId: 'exam_qa_practice', colIndex: 6, score: '假', scoreNum: null, average: 85, sourceClassKey: source };
          const quiz = { ...practice, exam: '小考：理化第9章', examId: 'exam_qa_quiz', colIndex: 7 };
          const previous = { ...practice, date: '2026/09/12', exam: '小考：理化第8章', examId: 'exam_qa_previous', colIndex: 8, score: '60', scoreNum: 60, makeupThreshold: 85 };
          const post = { date: '2026/09/19', id: 'qa_post', dailyPostId: 'qa_post', sourceClassKey: source, title: '隔離測試', progress: '理化第10章', quiz: '', makeup: attached ? '[補考卷]https://example.test/paper.pdf\n[補考解答]https://example.test/answer.pdf' : '', hw1: '', hw2: '', note: '', range: '', examData: { exams: [{ main: practice, others: [] }, { main: quiz, others: [] }] } };
          enterDashboardDraftPreview({ className: source, studentName: '測試學生', dailyPosts: [post], bulletins: [] });
          // 預覽仍阻擋寫入，只啟用學生畫面的回報元件。
          isAdminMode = false;
          gData.grades = pending ? [practice, quiz, previous] : [practice, quiz];
          gData.dailyPost = [post];
          renderDailyPosts([post], []);
          switchTab(0);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const labels = [...document.querySelectorAll('.info-label')].map(el => el.textContent);
          return {
            labels,
            scores: [...document.querySelectorAll('.main-score')].map(el => el.textContent.trim()),
            reportText: [...document.querySelectorAll('.score-report-section')].map(el => el.textContent),
            resultWidgets: document.querySelectorAll('.makeup-wrong-count-widget').length,
            paperLinks: [...document.querySelectorAll('.info-kind-makeup a')].map(el => el.href),
            pageWidth: document.documentElement.scrollWidth,
            viewport: innerWidth,
            minButtonHeight: Math.min(...[...document.querySelectorAll('.score-btn')].map(el => el.getBoundingClientRect().height))
          };
        }, { attached, pending });
        if (result.scores[0] !== '缺繳' || result.scores[1] !== '缺考') throw new Error(JSON.stringify(result));
        if (!result.reportText[0].includes('缺繳分數') || !result.reportText[1].includes('缺考分數')) throw new Error('Wrong report labels');
        if (result.labels.includes('今日補考考卷') !== attached) throw new Error('Phantom or missing paper block');
        if (result.labels.some(label => /今日.*(?:小考|考卷)/.test(label) && !label.includes('補考'))) throw new Error('Phantom quiz paper');
        if (result.resultWidgets !== (pending ? 1 : 0)) throw new Error('Pending report was hidden or invented');
        if (result.paperLinks.length !== (attached ? 2 : 0)) throw new Error('Paper links changed');
        if (result.pageWidth > result.viewport || result.minButtonHeight < 44) throw new Error('Mobile layout failed: ' + JSON.stringify(result));
        checks.push({ width, attached, pending, ...result });
        if (!attached && pending) {
          await page.locator('.grade-section').first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: `output/playwright/home-practice-${width}.png`, fullPage: true });
        }
      }
    }
  }
  const pendingLabel = await page.evaluate(() => {
    gData.pendingPreviewTasks = [{ taskId: 'qa_absence', kind: 'absence', itemType: 'makeup', title: '回家練習卷：理化第1-8章', neutralLabel: '請假考試待補', date: '2026/09/19' }];
    renderPendingTasks();
    return document.querySelector('.pending-card-label').textContent;
  });
  if (pendingLabel !== '缺繳練習卷待回報') throw new Error('Wrong pending label: ' + pendingLabel);
  const noExams = await page.evaluate(() => {
    const post = { date: '2026/09/19', sourceClassKey: gData.className, progress: '本週只有上課，沒有小考', quiz: '  \n ', makeup: '  \n ' };
    gData.grades = [];
    renderDailyPosts([post], []);
    return { labels: [...document.querySelectorAll('.info-label')].map(el => el.textContent), gradeCards: document.querySelectorAll('.grade-section').length, answerNotes: document.querySelectorAll('.quiz-answer-note').length };
  });
  if (noExams.labels.some(label => /考卷|小考/.test(label)) || noExams.gradeCards || noExams.answerNotes) throw new Error('No-exam week has phantom exams');
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { cases: checks.length, checks, pendingLabel, noExams, pageErrors: errors };
}
