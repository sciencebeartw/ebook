async page => {
 const checks=[], check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8898/tests/report_correction_fixture.html');await page.waitForFunction(()=>window.__fixture?.ready);
  const card=page.locator('article').first();await card.locator('.rp-correction summary').click();
  await card.getByRole('spinbutton').fill('92');
  if(width===390)await page.screenshot({path:'output/playwright/report-correction-mobile.png',fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+width);
  await card.getByRole('button',{name:'儲存更正'}).click();await page.waitForFunction(()=>document.querySelector('#rp-message').textContent.includes('已收到更正'));
  check(await card.locator('.rp-correction').count()===0,'pending locks correction '+width);
  const sent=await page.evaluate(()=>window.__fixture.calls.filter(c=>c.data.action==='submit').at(-1).data);
  check(sent.expectedScore===85&&sent.correction===true&&sent.submissionRevision===1,'exact previous score and revision '+width);
  await page.evaluate(()=>window.__fixture.complete());await page.getByRole('button',{name:'重新整理',exact:true}).click();await card.locator('.rp-correction summary').waitFor();
  check(await card.innerText().then(t=>t.includes('92')&&t.includes('準時回報')&&t.includes('最後更正時間')),'score and original timing '+width);
  if(width===390)await page.screenshot({path:'output/playwright/report-correction-completed-mobile.png',fullPage:true});
  await card.locator('.rp-correction summary').click();await card.getByRole('spinbutton').fill('0');
  await page.evaluate(()=>window.__fixture.mode='lost');await card.getByRole('button',{name:'儲存更正'}).click();await page.getByRole('button',{name:'再次確認送出'}).waitFor();
  await page.getByRole('button',{name:'重新整理',exact:true}).click();await card.getByRole('spinbutton').waitFor();check(await card.getByRole('spinbutton').inputValue()==='0','failed correction draft survives reload '+width);
  await card.getByRole('button',{name:'儲存更正'}).click();await page.waitForFunction(()=>document.querySelector('#rp-message').textContent.includes('已收到更正'));
  await page.evaluate(()=>window.__fixture.complete());await page.getByRole('button',{name:'重新整理',exact:true}).click();await card.locator('.rp-correction summary').waitFor();
  check(await card.locator('.rp-result').innerText().then(t=>t.includes('0')&&t.includes('準時回報')),'zero correction succeeds '+width);
 }
 check(errors.length===0,'no page errors');return {passed:checks.length,checks};
}