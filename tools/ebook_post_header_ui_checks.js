// Playwright CLI run-code --filename tools/ebook_post_header_ui_checks.js
// 在完整學生聯絡簿隔離頁驗證日期、堂數與班級的響應式標題；不送出任何表單。
async (page) => {
  await page.waitForFunction(() => window.gData && Array.isArray(gData.dailyPost) && gData.dailyPost.length > 0);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const results = [];

  for (const width of [1280, 820, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.evaluate((width) => {
      const sourcePost = gData.dailyPost[0];
      const history = gData.feedbackHistory || [];
      const post = Object.assign({}, sourcePost, {
        date: '2026/09/19',
        title: '第21堂｜小六資優自然週六上午班',
        className: '115小六資優自然週六上午班',
        sourceClassName: '115小六資優自然週六上午班',
        isTransferFormerClass: false,
      });
      renderDailyPosts([post], history);

      const header = document.querySelector('.post-header');
      const dateGroup = header && header.querySelector('.post-header-date-group');
      const calendar = dateGroup && dateGroup.querySelector('svg');
      const date = dateGroup && dateGroup.querySelector('.post-header-date');
      const meta = header && header.querySelector('.post-header-meta');
      const lesson = meta && meta.querySelector('.post-lesson-badge');
      const className = meta && meta.querySelector('.post-header-class-name');
      if (!header || !calendar || !date || !meta || !lesson || !className) {
        throw new Error('標題缺少日期、日曆、堂數或班級結構');
      }
      if (date.textContent.trim() !== '2026/09/19') throw new Error('日期文字錯誤');
      if (lesson.textContent.trim() !== '第2期第9堂') throw new Error('堂數文字錯誤');
      if (className.textContent.trim() !== '小六資優自然週六上午班') throw new Error('班級文字錯誤');

      const dateRect = dateGroup.getBoundingClientRect();
      const metaRect = meta.getBoundingClientRect();
      const lessonRect = lesson.getBoundingClientRect();
      const classRect = className.getBoundingClientRect();
      const lessonTextRange = document.createRange();
      lessonTextRange.selectNodeContents(lesson);
      const lessonTextWidth = lessonTextRange.getBoundingClientRect().width;
      const dateFontSize = parseFloat(getComputedStyle(dateGroup).fontSize);
      const classFontSize = parseFloat(getComputedStyle(className).fontSize);
      const minimumDateFontSize = width <= 600 ? 20 : 21;
      if (dateFontSize < minimumDateFontSize) throw new Error('日期字級不夠醒目：' + dateFontSize);
      if (Math.abs(classFontSize - dateFontSize) > 0.2) {
        throw new Error('班級與日期字級不一致');
      }

      if (width <= 600) {
        if (lessonRect.width > lessonTextWidth + 24) {
          throw new Error('手機版堂數標籤被網格拉寬');
        }
        const dateCenter = dateRect.top + dateRect.height / 2;
        const lessonCenter = lessonRect.top + lessonRect.height / 2;
        if (lessonRect.left < dateRect.right - 1 || Math.abs(dateCenter - lessonCenter) > 8) {
          throw new Error('手機版第一行不是日曆日期接堂數標籤');
        }
        if (classRect.top < Math.max(dateRect.bottom, lessonRect.bottom) + 2) {
          throw new Error('手機版完整班級沒有獨立顯示於第二行');
        }
        if (Math.abs(classRect.left - dateRect.left) > 2) {
          throw new Error('手機版班級與日期沒有共用左緣');
        }
      } else {
        const dateCenter = dateRect.top + dateRect.height / 2;
        const lessonCenter = lessonRect.top + lessonRect.height / 2;
        const classCenter = classRect.top + classRect.height / 2;
        if (Math.abs(dateCenter - lessonCenter) > 8 || Math.abs(dateCenter - classCenter) > 8) {
          throw new Error('iPad／桌機有空間時沒有維持單行');
        }
      }

      const overflow = document.documentElement.scrollWidth > innerWidth;
      if (overflow) throw new Error('頁面出現橫向溢位');

      const customPost = Object.assign({}, post, { title: '第21堂｜中秋前一週' });
      renderDailyPosts([customPost], history);
      const customTitle = document.querySelector('.post-header-custom-title');
      if (!customTitle || !customTitle.textContent.includes('中秋前一週')) {
        throw new Error('自訂聯絡簿標題遺失');
      }

      const transferPost = Object.assign({}, post, { isTransferFormerClass: true });
      renderDailyPosts([transferPost], history);
      const transferBadge = document.querySelector('.post-transfer-badge');
      if (!transferBadge || !transferBadge.textContent.includes('轉班前紀錄')) {
        throw new Error('轉班前紀錄標示遺失');
      }
      if (document.documentElement.scrollWidth > innerWidth) {
        throw new Error('轉班前紀錄使標題產生橫向溢位');
      }

      [
        { title: '國一數學超前', className: '115國一數學超前班', expected: '國一數學超前班' },
        { title: '小六資優數學', className: '115小六資優數學', expected: '小六資優數學' },
      ].forEach(mathCase => {
        const mathPost = Object.assign({}, post, {
          title: mathCase.title,
          className: mathCase.className,
          sourceClassName: mathCase.className,
          isTransferFormerClass: false,
        });
        renderDailyPosts([mathPost], history);
        const mathHeader = document.querySelector('.post-header');
        const mathDateRect = mathHeader.querySelector('.post-header-date-group').getBoundingClientRect();
        const mathClass = mathHeader.querySelector('.post-header-class-name');
        const mathClassRect = mathClass.getBoundingClientRect();
        if (mathClass.textContent.trim() !== mathCase.expected) {
          throw new Error('數學班級名稱錯誤：' + mathClass.textContent.trim());
        }
        if (mathHeader.querySelector('.post-lesson-badge')) {
          throw new Error('沒有堂數的數學聯絡簿仍顯示堂數標籤');
        }
        if (width <= 600 && Math.abs(mathDateRect.top - mathClassRect.top) > 3) {
          throw new Error('沒有堂數的數學聯絡簿未與日期同列');
        }
        if (document.documentElement.scrollWidth > innerWidth) {
          throw new Error('沒有堂數的數學聯絡簿使標題產生橫向溢位');
        }
      });

      ['國一', '國二'].forEach(grade => {
        const advancedPost = Object.assign({}, post, {
          title: `第21堂｜${grade}自然超前`,
          className: `115${grade}自然超前班`,
          sourceClassName: `115${grade}自然超前班`,
          isTransferFormerClass: false,
        });
        renderDailyPosts([advancedPost], history);
        const headerText = document.querySelector('.post-header').textContent;
        if (document.querySelector('.post-header-custom-title') ||
            headerText.split(`${grade}自然超前`).length !== 2) {
          throw new Error(`${grade}自然超前班標題重複`);
        }
      });
      renderDailyPosts([post], history);

      return {
        width,
        dateFontSize,
        classFontSize,
        mobileClassSecondRow: width <= 600 ? classRect.top >= Math.max(dateRect.bottom, lessonRect.bottom) + 2 : null,
        desktopSingleRow: width > 600 ? true : null,
        overflow,
      };
    }, width);
    await page.locator('.post-header').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `output/playwright/post-header-${width}.png` });
    results.push(result);
  }

  if (pageErrors.length) throw new Error('頁面錯誤：' + JSON.stringify(pageErrors));
  return { results, pageErrors };
}
