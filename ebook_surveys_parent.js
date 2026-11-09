(function(root){
    'use strict';
    const C=root.EbookSurveyContract,V=root.EbookSurveyView,E=C.esc;
    let deps=null,generation=0,rows=[],dialog=null,reminded=false,hasMore=false;
    function reset(){generation++;deps=null;rows=[];reminded=false;hasMore=false;if(dialog){dialog.close(true);dialog=null;}const host=document.getElementById('ebookSurveyEntry');if(host){host.hidden=true;host.innerHTML='';}}
    function render(){const host=document.getElementById('ebookSurveyEntry');if(!host)return;host.classList.add('es','es-entry');host.hidden=!rows.length;
        host.innerHTML=rows.map(r=>'<button type="button" class="es-entry-button" data-survey="'+E(r.id)+'"><span><strong>'+E(r.title)+'</strong><small>'+(r.answered?'✓ 已填寫'+(r.closed?'・已結束':''):r.closed?'已截止':'待填寫')+' · '+(r.endsAt?C.date(r.endsAt)+' 截止':'期限待設定')+'</small></span><span class="es-entry-arrow">'+(r.answered?'查看回答':r.closed?'查看':'填寫調查')+' →</span></button>').join('')+(hasMore?'<small>顯示最近 100 份調查；較早資料可請老師查詢。</small>':'');
        host.querySelectorAll('[data-survey]').forEach(b=>b.onclick=()=>open(b.dataset.survey));
    }
    async function load(){if(!deps)return;const token=generation,request=deps.request;try{const r=await request({action:'list'});if(token!==generation)return;rows=r.surveys||[];hasMore=!!r.hasMore;render();maybeRemind();}catch(e){if(token!==generation)return;const h=document.getElementById('ebookSurveyEntry');if(h){h.hidden=false;h.classList.add('es');h.innerHTML='<button class="es-entry-button" type="button">調查暫時無法載入，點此重試</button>';h.firstChild.onclick=load;}}}
    function maybeRemind(){
        if(!deps||reminded||document.querySelector('.es-survey-page')||!rows.some(r=>!r.answered&&!r.closed&&r.remind)||!deps.canRemind||!deps.canRemind())return;
        // 每次進入只提醒一次；稍後再填不再保存當日暫停，下次進入仍提醒未填調查。
        reminded=true;
        const list=rows.filter(r=>!r.answered&&!r.closed&&r.remind);
        const d=V.modal(list.length===1?'有一份調查待填寫':'有 '+list.length+' 份調查待填寫','<p>'+E(list[0].title)+(list.length>1?'等 '+list.length+' 份調查':'')+'</p><p class="es-muted" style="margin-top:8px">點下方按鈕前往填寫。</p>','<button type="button" data-snooze>稍後再填</button><button type="button" class="es-primary" data-open>前往調查</button>');
        dialog=d;
        d.querySelector('[data-snooze]').onclick=()=>d.close();
        d.querySelector('[data-open]').onclick=()=>{d.close();open(list[0].id);};
    }
    async function open(id){if(!deps)return;if(dialog&&dialog.isConnected)dialog.close(true);const token=generation,request=deps.request;const d=V.page('調查','<p role="status">正在載入…</p>');dialog=d;try{const result=await request({action:'get',id});if(token!==generation||!d.isConnected)return;draw(d,result,!!result.response,false,request,token);}catch(e){if(d.isConnected)d.querySelector('.es-dialog-body').textContent=e.message;}}
    function draw(d,r,showReview,preview,request,token){
        const f=r.survey.form,response=r.response;d.querySelector('h2').textContent=f.title;
        const identity='<p class="es-student-line">'+E(r.student.name)+' · '+E(r.student.className)+'</p>';
        const deadline='<span class="es-pill">'+(f.endsAt?C.date(f.endsAt)+' 截止':'截止時間待設定')+'</span>';
        if(showReview&&response){d.querySelector('.es-dialog-body').innerHTML='<div class="es-success"><div class="es-success-icon">✓</div><h3>已收到你的回答</h3><p class="es-muted">'+E(r.student.name)+'，謝謝你的協助！</p></div>'+V.review(f,response)+'<p class="es-muted">最後回覆：'+C.date(response.updatedAt)+(response.actor.role==='admin'?' · 老師代填':'')+'</p><div class="es-help" style="margin-top:15px">'+(r.canEdit?'截止前都可以修改，以最後一次成功送出的回答為準。':'調查已結束；如需更正，請聯絡老師。')+'</div><div class="es-status" role="status"></div>';
            d.querySelector('.es-dialog-footer').innerHTML=(r.canEdit?'<button type="button" data-edit>修改回答</button>':'')+'<button type="button" class="es-primary" data-close>完成</button>';
            const edit=d.querySelector('[data-edit]');if(edit)edit.onclick=()=>draw(d,r,false,preview,request,token);root.EbookSurveyAttachments.bind(d,f,response.answers,{request,scope:{id:r.survey.id},readOnly:true});return;
        }
        d.querySelector('.es-dialog-body').innerHTML=identity+deadline+(preview?'<div class="es-warning" style="margin-top:12px">家長端預覽，這裡的操作不會送出回答。</div>':'')+'<p class="es-description">'+E(f.description)+'</p>'+V.book(f)+'<form>'+V.fields(f,response?response.answers:{})+'</form><div class="es-status" role="status" aria-live="polite"></div>';
        d.querySelector('.es-dialog-footer').innerHTML='<button type="button" data-close>'+(response?'取消修改':'稍後填寫')+'</button><button type="button" class="es-primary" data-submit '+(preview||!r.canEdit?'disabled':'')+'>'+(response?'儲存修改':'送出回答')+'</button>';
        root.EbookSurveyAttachments.bind(d,f,response?response.answers:{},{request,scope:{id:r.survey.id,formRevision:r.survey.formRevision},preview,readOnly:!r.canEdit});
        let pending=null,busy=false;
        d.querySelector('[data-submit]').onclick=async()=>{
            if(busy||preview)return;
            let answers;try{answers=V.collect(f,d);}catch(e){V.status(d,e.message,true);return;}
            const fingerprint=JSON.stringify(answers);if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,id:V.uid()};
            const button=d.querySelector('[data-submit]');busy=true;button.disabled=true;V.status(d,'正在儲存，請稍候…');
            try{const saved=await request({action:'submit',id:r.survey.id,requestId:pending.id,formRevision:r.survey.formRevision,expectedRevision:response?response.revision:0,answers});if(token!==generation)return;r.response=saved.response;r.canEdit=f.endsAt>saved.serverNow;if(d.isConnected)draw(d,r,true,false,request,token);load();}
            catch(e){if(d.isConnected){V.status(d,e.message,true);if(String(e.code||'').replace(/^functions\//,'')==='aborted'){const reload=document.createElement('button');reload.type='button';reload.textContent='重新讀取最新回答';reload.onclick=()=>{d.close(true);open(r.survey.id);};d.querySelector('.es-status').appendChild(reload);}}}
            finally{busy=false;if(button.isConnected)button.disabled=false;}
        };
        d.querySelector('form').onsubmit=e=>{e.preventDefault();d.querySelector('[data-submit]').click();};
    }
    function preview(form){const d=V.page(form.title,'');draw(d,{survey:{form},student:{name:'學生姓名',className:'目前班級'},response:null,canEdit:false},false,true,null,generation);return d;}
    function mount(config){reset();deps=config;load();}
    document.addEventListener('ebook:popup-idle',maybeRemind);
    root.EbookSurveyParent={mount,reset,refresh:load,open,preview,maybeRemind};
})(window);
