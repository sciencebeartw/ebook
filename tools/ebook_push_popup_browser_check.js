// Playwright CLI run-code：真實公告佇列與推播 adapter，合成資料，不接 Firebase。
async (page) => {
    const base = await page.evaluate(() => new URL('./', location.href).href);
    const html = await (await page.request.get(base + 'index.html')).text();
    const part = (start, end) => html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start)));
    const adapters = part('        function getEbookPushNavigationContext()', '        function switchTab(idx)');
    const popups = part('        function resetPopupQueueForEntry()', '        var currentMakeupExamData');
    const reminder = part('        function maybeShowPendingEntryReminder()', '        // ★★★ 即時監聽生命週期管理');
    const results = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
    for (const width of [390, 768]) {
        await page.goto(base + 'ebook_push.css');
        await page.setViewportSize({width, height: 850});
        await page.setContent(`<style>body{margin:0}.sticky-wrapper{height:50px;position:sticky;top:0;background:white}.gap{height:900px}.item{padding:18px;min-height:70px}#emergencyModal{display:none;position:fixed;inset:0;background:white;z-index:5}</style><nav class="sticky-wrapper">聯絡簿</nav><main id="tab-content-0"><div class="gap"></div><article data-post-id="post1" data-post-date="2026/10/11" data-source-class-key="115小六資優自然週六上午班"><section data-feedback-thread-id="msg1"><div class="item" data-feedback-key="msg1" data-feedback-role="teacher">老師留言</div></section><details><summary>棒卡申請</summary><div class="item sticker-apply-box">尚無審核紀錄</div></details></article></main><main id="tab-content-1"></main><main id="tab-content-2"></main><main id="tab-content-3"><div class="pending-page-summary item">待完成</div></main><div id="emergencyModal"><div id="emergencyTitle"></div><div class="item" id="emergencyContent"></div><div id="emergencyExpiryNotice"></div><span id="emergencyExpiresAt"></span><button id="popupCloseButton"></button><button id="popupDismissButton"></button></div>`);
        await page.evaluate(() => {
            window.gData = {className:'115小六資優自然週六上午班',studentName:'系統測試生',bulletins:[{id:'popup1',title:'課表公告',content:'公告正文',className:'115小六資優自然週六上午班',time:'2026-10-14'}]};
            Object.assign(window,{isStudentPreviewMode:false,isDashboardDraftPreviewMode:false,ebookGodSessionInfo:null,isAdminMode:false,pendingTasksState:{status:'ready'},pendingEntryNoticeReady:true,pendingEntryReminderHandled:false,pushTargetEntryActive:false,popupAnnouncementQueue:[],popupShownIdentitiesForCurrentEntry:{},activeEmergencyAnnouncement:null,__reminders:0,__closed:0});
            window.safeKey = v => v; window.isBulletinEffective = () => true;
            window.buildEmergencyIdentity = b => b.id; window.getBulletinDisplayChannels = () => ({popup:true,popupTone:'notice'});
            window.isPopupDismissedOnThisDevice = () => false; window.isPopupDismissibleNow = () => true;
            window.getPopupTitleIcon = () => ''; window.escapeHtml = v => v; window.parseBtn = v => v; window.formatEmergencyExpiryText = () => '';
            window.EbookPendingTasks = {getEntryReminderItems:() => {__reminders++;return [];}};
            window.Swal = {getPopup:() => ({classList:{contains:() => true}}),close:() => {__closed++;}};
            window.switchTab = i => {for(let j=0;j<4;j++)document.getElementById('tab-content-'+j).style.display=i===j?'block':'none';};
            window.toggleCard = n => n.classList.add('active');
        });
        await page.addScriptTag({content: await (await page.request.get(base+'ebook_push_navigation.js')).text()});
        await page.addScriptTag({content:adapters + popups + reminder});
        check(await page.evaluate(() => {resetPopupQueueForEntry();return checkEmergency(gData.bulletins)&&!!activeEmergencyAnnouncement;}),width+'：普通進入仍顯示公告');
        const navigated = await page.evaluate(async () => {
            setTimeout(() => checkEmergency(gData.bulletins),80);
            const result=await openEbookPushTarget({kind:'message',id:'msg1',date:'2026/10/11',classKey:gData.className});
            await new Promise(r=>setTimeout(r,220));
            return result && !activeEmergencyAnnouncement && document.getElementById('emergencyModal').style.display==='none' && __closed===1;
        });
        check(navigated,width+'：留言跳轉後晚到公告不遮擋，待完成彈窗已關閉');
        check(await page.evaluate(() => {const n=__reminders;maybeShowPendingEntryReminder();return __reminders===n&&popupAnnouncementQueue.length===1;}),width+'：待完成不搶畫面，公告留在佇列');
        check(await page.evaluate(() => openEbookPushTarget({kind:'bulletin',id:'popup1',classKey:gData.className})),width+'：直接點公告仍開啟指定彈窗');
        check(await page.evaluate(() => {closeEmergencyModal();return !activeEmergencyAnnouncement;}),width+'：關閉指定公告後不續跳其他彈窗');
        check(await page.evaluate(() => openEbookPushTarget({kind:'sticker',id:'post1',testSection:true,classKey:gData.className})),width+'：測試棒卡定位展開申請區，不建立紀錄');
        check(await page.evaluate(() => {gData.studentName='一般學生';return !EbookPushNavigation.find({kind:'sticker',id:'post1',testSection:true,classKey:gData.className},getEbookPushNavigationContext());}),width+'：一般學生不能使用測試棒卡捷徑');
        check(await page.evaluate(() => {resetPopupQueueForEntry();return checkEmergency(gData.bulletins)&&!!activeEmergencyAnnouncement;}),width+'：下一次一般進入恢復公告');
    }
    check(errors.length===0,'無頁面例外');
    return {engine:page.context().browser().browserType().name(),passed:results.length,checks:results};
}
