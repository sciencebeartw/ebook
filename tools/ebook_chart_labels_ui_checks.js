// Playwright CLI run-code --filename tools/ebook_chart_labels_ui_checks.js
// 只在隔離草稿預覽注入假資料，不操作正式成績。
async (page) => {
  if (!page.url().includes('preview=dashboard-draft')) throw new Error('Requires isolated draft preview');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const results = [];
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    for (const fixture of [
      { score:107, distMin:107,distMax:107,lastOnly:true,dist:[1,0,0,0,0], labels:['107 ~ 107','107 ~ 107','107 ~ 108','108 ~ 108','108 ~ 108'] },
      { score:80,distMin:60,distMax:80,dist:[1,0,1,0,0],labels:['60 ~ 68','68 ~ 76','76 ~ 84','84 ~ 92','92 ~ 100'] },
      { score:107,distMin:87,distMax:107,dist:[1,0,0,0,1],labels:['87 ~ 91','91 ~ 95','95 ~ 99','99 ~ 103','103 ~ 107'] },
      { score:100,distMin:100,distMax:100,lastOnly:true,dist:[1,0,0,0,0],labels:['100 ~ 100','100 ~ 100','100 ~ 101','101 ~ 101','101 ~ 101'] },
      { score:107,distMin:107,distMax:107,lastOnly:true,dist:[3,0,0,0,0],labels:['107 ~ 107','107 ~ 107','107 ~ 108','108 ~ 108','108 ~ 108'] },
      { score:'',distMin:107,distMax:107,lastOnly:true,dist:[1,0,0,0,0],labels:['107 ~ 107','107 ~ 107','107 ~ 108','108 ~ 108','108 ~ 108'] },
      { score:200,distMin:100,distMax:200,dist:[3,1,0,100,8], labels:['100 ~ 120','120 ~ 140','140 ~ 160','160 ~ 180','180 ~ 200'] }
    ]) {
      await page.evaluate(({score,dist,labels,distMin,distMax}) => {
        const className='115國二自然超前班';
        const raw={ date:'2026/09/19',examName:'三位數排版測試',score:String(score),average:distMax,dist,labels,distMin,distMax,myBucket:score===''?-1:0,total:dist.reduce((a,b)=>a+b,0),assessmentKind:'holiday_self_marked' };
        const original=JSON.stringify(raw);
        const grade=buildGradeListFromExams({col_5:raw},{classKey:className,currentClassKey:className,className,currentClassName:className,dateAnchorKeys:['2026-09-19']})[0];
        if(!grade || grade.distMin!==distMin || grade.distMax!==distMax)throw new Error('Distribution metadata lost during grade hydration');
        if(JSON.stringify(raw)!==original)throw new Error('Raw grade was mutated');
        const post={date:grade.date,id:'qa_chart',dailyPostId:'qa_chart',sourceClassKey:className,title:'隔離測試',progress:'測試進度',quiz:'',makeup:'',hw1:'',hw2:'',note:'',examData:{exams:[{main:grade,others:[]}]}};
        enterDashboardDraftPreview({className,studentName:'排版測試',dailyPosts:[post],bulletins:[]});
        gData.grades=[grade];gData.dailyPost=[post];
        renderDailyPosts([post],[]);renderOldGradeCards([grade]);
      }, fixture);
      for (const tab of [0,1]) {
        await page.evaluate(tab=>{
          switchTab(tab);
          // 草稿模式平常隱藏近期成績；只在假資料測試中打開該容器。
          document.getElementById('tab-content-1').style.setProperty('display',tab===1?'block':'none','important');
          if(tab===1)document.querySelector('#tab-content-1 .score-card').classList.add('active');
        },tab);
        // 等待既有柱狀圖動畫完成，再量測標籤和人數。
        await page.waitForTimeout(1100);
        const result=await page.evaluate(fixture => {
          const charts=[...document.querySelectorAll('.v2-bar-chart-container')].filter(e=>e.getBoundingClientRect().width>0);
          if (!charts.length) throw new Error('No rendered chart');
          const cases=charts.map(chart=>{
            const labels=[...chart.querySelectorAll('.v2-bar-label')];
            const counts=[...chart.querySelectorAll('.v2-bar-fill')].map(e=>Number(e.dataset.val));
            const total=fixture.dist.reduce((a,b)=>a+b,0);
            const expected=fixture.lastOnly?[0,0,0,0,total]:fixture.dist;
            if(JSON.stringify(counts)!==JSON.stringify(expected))throw new Error('Incorrect bucket counts');
            const wantedLabels=fixture.lastOnly?['0–'+Math.round(fixture.distMax/5),null,null,null,Math.round(fixture.distMax*4/5)+'–'+fixture.distMax]:fixture.labels.map(s=>s.replace(/\s*~\s*/g,'–'));
            wantedLabels.forEach((text,i)=>{if(text && labels[i].textContent!==text)throw new Error('Incorrect interval');});
            if(fixture.lastOnly){
              const fills=[...chart.querySelectorAll('.v2-bar-fill')];
              fills.forEach((el,i)=>{
                const highlighted=getComputedStyle(el).backgroundImage!=='none';
                if(highlighted!==(fixture.score!=='' && i===4))throw new Error('Incorrect personal highlight');
              });
            }
            const rects=labels.map(el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect();});
            labels.forEach((el,i)=>{
              const r=rects[i],style=getComputedStyle(el),fill=el.parentElement.querySelector('.v2-bar-fill'),bar=fill.getBoundingClientRect(),count=getComputedStyle(fill,'::after');
              if (el.getBoundingClientRect().height>parseFloat(style.lineHeight)+1) throw new Error('Label wraps');
              if (i && rects[i-1].right+2>r.left) throw new Error('Adjacent labels overlap');
              if (bar.top+parseFloat(count.top)+parseFloat(count.lineHeight)+4>r.top) throw new Error('Count overlaps label');
              if (r.left<chart.getBoundingClientRect().left-1 || r.right>chart.getBoundingClientRect().right+1) throw new Error('Label escapes chart');
            });
            return labels.map(el=>el.textContent);
          });
          if(document.documentElement.scrollWidth>innerWidth)throw new Error('Page overflow');
          return {cases};
        },fixture);
        results.push({width,score:fixture.score,tab,...result});
        if ([390,1280].includes(width) && fixture.score===107) {
          await page.locator('.v2-bar-chart-container:visible').first().scrollIntoViewIfNeeded();
          await page.screenshot({path:`output/playwright/chart-equal-${width}-${fixture.distMin}-${fixture.dist.reduce((a,b)=>a+b,0)}-tab${tab}.png`});
        }
      }
    }
  }
  if(errors.length)throw new Error(JSON.stringify(errors));
  return {cases:results.length,results,pageErrors:errors};
}
