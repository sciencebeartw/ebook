// Playwright CLI run-code --filename tools/holiday_score_card_ui_checks.js
// 隔離假資料：驗證假期卷回報框位於成績卡，且待完成提供回報與考卷兩個精準入口。
async (page) => {
  await page.reload({ waitUntil: 'load' });
  await page.setViewportSize({ width: 390, height: 900 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const result = await page.evaluate(async () => {
    const source = '115小六資優自然週六上午班';
    const assignmentId = 'holiday_pending_nav';
    const examId = 'holiday-pending-nav-exam';
    const assignment = {
      assignmentId,
      title: '20260926-27 小六資優自然 回家複習卷 理化（上）第1～8章',
      questionUrl: 'https://example.test/holiday-question.pdf',
      dueDate: '2026-10-03',
      dueTime: '09:00',
      dueAt: Date.now() + 86400000,
      revision: 1
    };
    const exam = {
      date: '2026/09/19', exam: assignment.title, examId, sourceExamId: examId, colIndex: 6,
      score: '', scoreNum: null, average: '-', sourceClassKey: source,
      assessmentKind: 'holiday_self_marked', sourceAssignmentId: assignmentId, dueAt: assignment.dueAt
    };
    const post = {
      date: '2026/09/19', id: 'holiday_pending_nav_post', dailyPostId: 'holiday_pending_nav_post',
      className: source, sourceClassKey: source, title: '第21堂｜小六資優自然', progress: '',
      hw1: '', hw2: '', quiz: '', makeup: '', note: '', range: '',
      examData: { exams: [{ main: exam, others: [] }] },
      displayOptions: { holidayPractice: assignment }
    };

    enterDashboardDraftPreview({ className: source, studentName: '測試學生', dailyPosts: [post], bulletins: [] });
    isDashboardDraftPreviewMode = false;
    isStudentPreviewMode = false;
    isAdminMode = false;
    const originalDoPostAction = doPostAction;
    doPostAction = function(action, payload, ok, fail) {
      if (action === 'getHolidayPracticeContext') {
        ok({ success: true, assignments: { [assignmentId]: assignment }, progress: { [assignmentId]: { unlockedAt: 1 } } });
        return;
      }
      fail(new Error('Unexpected isolated action: ' + action));
    };
    gData.grades = [exam];
    gData.dailyPost = [post];
    renderDailyPosts([post], []);
    await new Promise(resolve => setTimeout(resolve, 80));
    renderPendingTasks();

    const holidayCard = document.getElementById('holiday-card-' + assignmentId);
    const gradeCard = document.querySelector('[data-pending-exam-anchor][data-assignment-id="' + assignmentId + '"]');
    const reportBox = gradeCard && gradeCard.querySelector('[data-holiday-score-report]');
    const reportInput = reportBox && reportBox.querySelector('.score-input');
    switchTab(3);
    const pendingCard = document.querySelector('[data-pending-task-card]');
    const buttons = pendingCard ? Array.from(pendingCard.querySelectorAll('.pending-action-btn')) : [];
    const reportButton = buttons.find(button => button.textContent.trim() === '前往回報分數');
    const paperButton = buttons.find(button => button.textContent.trim() === '查看假期練習卷');

    if (reportButton) reportButton.click();
    await new Promise(resolve => setTimeout(resolve, 140));
    const reportTargeted = !!(reportBox && reportBox.classList.contains('pending-anchor-highlight'));
    const reportFocused = document.activeElement === reportInput;

    switchTab(3);
    if (paperButton) paperButton.click();
    await new Promise(resolve => setTimeout(resolve, 140));
    const paperTargeted = !!(holidayCard && holidayCard.classList.contains('pending-anchor-highlight'));
    const result = {
      reportInGradeCard: !!reportBox,
      reportInPaperCard: !!(holidayCard && holidayCard.querySelector('[data-holiday-score-report]')),
      buttonLabels: buttons.map(button => button.textContent.trim()),
      reportTargeted,
      reportFocused,
      paperTargeted,
      statusFontSize: gradeCard && getComputedStyle(gradeCard.querySelector('.main-score span')).fontSize,
      pageWidth: document.documentElement.scrollWidth,
      viewport: innerWidth
    };
    doPostAction = originalDoPostAction;
    return result;
  });

  if (!result.reportInGradeCard || result.reportInPaperCard) throw new Error('Holiday score form placement is invalid: ' + JSON.stringify(result));
  if (!result.buttonLabels.includes('前往回報分數') || !result.buttonLabels.includes('查看假期練習卷')) throw new Error('Holiday pending actions are incomplete: ' + JSON.stringify(result));
  if (!result.reportTargeted || !result.paperTargeted) throw new Error('Holiday pending navigation is invalid: ' + JSON.stringify(result));
  if (result.statusFontSize !== '51.2px' || result.pageWidth > result.viewport) throw new Error('Holiday mobile typography/layout is invalid: ' + JSON.stringify(result));
  if (pageErrors.length) throw new Error('Page errors: ' + JSON.stringify(pageErrors));
  await page.screenshot({ path: 'output/playwright/holiday-score-card-form-390.png', fullPage: true });
  return { result, pageErrors };
}
