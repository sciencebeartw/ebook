// Playwright CLI run-code --filename tools/ebook_chart_height_ui_checks.js
// 僅限隔離草稿預覽；驗證觀察器延遲、切換頁籤與重繪不會讓柱體歸零。
async (page) => {
  if (!page.url().includes('preview=dashboard-draft')) throw new Error('Requires isolated draft preview');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const results = [];
  for (const width of [320, 390, 820, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    const checks = await page.evaluate(() => {
      const className = '115國一自然超前班';
      const grade = { date: '2026/10/31', exam: '熱量與比熱', score: '85', scoreNum: 85, unit: '分', isMissing: false, average: '88.33', dist: [1, 3, 1, 16, 12], labels: ['60 ~ 68', '68 ~ 76', '76 ~ 84', '84 ~ 92', '92 ~ 100'], total: 33, myBucket: 3, colIndex: 5, className };
      const post = { date: grade.date, id: 'qa_chart_height', dailyPostId: 'qa_chart_height', sourceClassKey: className, title: '隔離測試', progress: '', quiz: '', makeup: '', hw1: '', hw2: '', note: '', examData: { exams: [{ main: grade, others: [] }] } };
      enterDashboardDraftPreview({ className, studentName: '圖表測試', dailyPosts: [post], bulletins: [] });
      gData.grades = [grade];
      gData.dailyPost = [post];
      // 模擬 Safari 尚未通知觀察器，顯示不能依賴動畫才有高度。
      const OriginalObserver = window.IntersectionObserver;
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      const out = [];
      try {
        function measure(tab, stage) {
          switchTab(tab);
          const container = document.getElementById('tab-content-' + tab);
          container.style.setProperty('display', 'block', 'important');
          if (tab === 1) container.querySelector('.score-card').classList.add('active');
          const chart = container.querySelector('.v2-bar-chart-container');
          if (!chart) throw new Error('Missing chart: ' + stage);
          const bars = [...chart.querySelectorAll('.v2-bar-fill')];
          const heights = bars.map(bar => bar.getBoundingClientRect().height);
          const counts = bars.map(bar => Number(bar.dataset.val));
          if (JSON.stringify(counts) !== '[1,3,1,16,12]') throw new Error('Wrong distribution');
          if (heights.some(height => height <= 0)) throw new Error('Invisible bar: ' + stage);
          heights.forEach((height, index) => {
            if (Math.abs(height / heights[3] - counts[index] / 16) > 0.02) throw new Error('Incorrect bar proportion');
          });
          const bounds = chart.getBoundingClientRect();
          if (bounds.right > innerWidth + 1 || bounds.left < -1) throw new Error('Chart overflow');
          out.push({ tab, stage, heights, counts });
        }
        renderDailyPosts([post], []);
        renderOldGradeCards([grade]);
        measure(0, 'observer-delayed');
        measure(1, 'history-expanded');
        // 其他頁籤重繪會清除全頁動畫，已顯示柱體仍須存在。
        renderDailyPosts([post], []);
        measure(1, 'other-chart-rerendered');
        measure(0, 'returned-to-post');
      } finally { window.IntersectionObserver = OriginalObserver; }
      return out;
    });
    results.push({ width, checks });
    if (width === 390 || width === 1280) await page.screenshot({ path: '/private/tmp/g7-grade-verification-20261031/chart-' + width + '.png' });
  }
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { cases: results.reduce((count, item) => count + item.checks.length, 0), results, pageErrors: errors };
}
