// Playwright CLI run-code --filename tools/ebook_section_hierarchy_ui_checks.js
// 在既有完整學生聯絡簿隔離頁驗證視覺層級，不送出任何表單。
async (page) => {
  await page.waitForFunction(() => window.gData && Array.isArray(gData.dailyPost) && gData.dailyPost.length > 0);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const results = [];

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.evaluate((width) => {
      const sourcePost = gData.dailyPost[0];
      const history = gData.feedbackHistory || [];
      const render = note => {
        const post = Object.assign({}, sourcePost, { note });
        renderDailyPosts([post], history);
        return post;
      };

      render('<p><br></p>');
      const emptyTitles = Array.from(document.querySelectorAll('.section-title')).map(node => node.textContent.trim());
      if (emptyTitles.includes('補充資訊')) throw new Error('空白補充資訊仍顯示大標');
      if (!emptyTitles.includes('學習回報') || !emptyTitles.includes('留言內容')) throw new Error('學生回報或留言大標遺失');

      render('[補充講義]https://example.test/handout.pdf');
      const titles = Array.from(document.querySelectorAll('.section-title')).map(node => node.textContent.trim());
      const expected = ['聯絡事項', '補充資訊', '學習回報', '留言內容'];
      const order = expected.map(label => titles.indexOf(label));
      if (order.some(index => index < 0) || order.some((index, i) => i > 0 && index <= order[i - 1])) {
        throw new Error('大標順序錯誤：' + JSON.stringify(titles));
      }
      if (Array.from(document.querySelectorAll('.info-label')).some(node => node.textContent.trim() === '補充資訊')) {
        throw new Error('補充資訊同時出現大標與小標');
      }
      const supplementalLink = document.querySelector('.supplemental-info-section a.btn-link');
      if (!supplementalLink) throw new Error('補充附件沒有沿用按鈕樣式');
      const learning = document.querySelector('.student-learning-report');
      const tools = learning ? learning.querySelectorAll('.compact-student-tool').length : 0;
      if (tools !== 3) throw new Error('最新聯絡簿的三個學習回報工具不完整：' + tools);
      const firstTool = learning.querySelector('details');
      const firstSummary = firstTool && firstTool.querySelector('summary');
      if (!firstSummary) throw new Error('學習回報工具缺少可操作的展開控制');
      firstSummary.click();
      if (!firstTool.open) throw new Error('學習回報工具無法展開');
      firstSummary.click();
      if (firstTool.open) throw new Error('學習回報工具無法收合');
      const overflow = document.documentElement.scrollWidth > innerWidth;
      if (overflow) throw new Error('頁面出現橫向溢位');

      const transferPost = Object.assign({}, sourcePost, { note: '', isTransferFormerClass: true });
      renderDailyPosts([transferPost], history);
      const transferTitles = Array.from(document.querySelectorAll('.section-title')).map(node => node.textContent.trim());
      if (transferTitles.includes('學習回報')) throw new Error('只讀的轉班前紀錄不應顯示空的學習回報大標');

      render('[補充講義]https://example.test/handout.pdf');
      return { width, titles, emptyTitles, tools, supplementalLink: true, overflow };
    }, width);
    await page.locator('.supplemental-info-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/playwright/section-hierarchy-${width}.png` });
    results.push(result);
  }

  if (pageErrors.length) throw new Error('頁面錯誤：' + JSON.stringify(pageErrors));
  return { results, pageErrors };
}
