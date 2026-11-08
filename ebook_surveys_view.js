(function(root){
    'use strict';
    const C=root.EbookSurveyContract,E=C.esc;
    const uid=()=>crypto.randomUUID().replace(/-/g,'');
    function book(f){return f.bookTitle?'<div class="es-book">'+(f.imageUrl?'<img src="'+E(f.imageUrl)+'" alt="指定課本封面" loading="lazy">':'')+'<div><strong>'+E(f.bookTitle)+'</strong><p>'+E(f.bookEdition||'')+(f.bookIsbn?'<br>ISBN：'+E(f.bookIsbn):'')+'</p>'+(f.bookUrl?'<a href="'+E(f.bookUrl)+'" target="_blank" rel="noopener noreferrer">查看書籍資訊 ↗</a>':'')+'</div></div>':'';}
    function fields(f,a={}){return f.questions.map((q,i)=>'<fieldset class="es-form-question"><legend>'+(i+1)+'. '+E(q.title)+(q.required?'<span class="es-required">必填</span>':'<small>（選填）</small>')+'</legend>'+(q.type==='text'?'<textarea name="'+q.id+'" maxlength="1000" placeholder="有需要老師協助的地方，可以在這裡告訴我們。">'+E(a[q.id]||'')+'</textarea>':q.options.map(o=>'<label class="es-answer-option"><input type="'+(q.type==='multiple'?'checkbox':'radio')+'" name="'+q.id+'" value="'+o.id+'" '+((Array.isArray(a[q.id])?a[q.id].includes(o.id):a[q.id]===o.id)?'checked':'')+'><span>'+E(o.label)+'</span></label>').join(''))+'</fieldset>').join('');}
    function collect(f,node){const out={};for(const q of f.questions){if(q.type==='text')out[q.id]=node.querySelector('[name="'+q.id+'"]').value;else{const checked=Array.from(node.querySelectorAll('[name="'+q.id+'"]:checked')).map(x=>x.value);out[q.id]=q.type==='single'?(checked[0]||''):checked;}}return C.answers(f,out);}
    function review(f,response){return f.questions.map(q=>'<div class="es-answer-review"><small>'+E(q.title)+'</small><strong>'+E(C.answerLabel(q,response.answers[q.id]))+'</strong></div>').join('');}
    function modal(title,body,footer){
        const d=document.createElement('dialog');d.className='es es-dialog';const titleId='survey-title-'+uid();d.setAttribute('aria-labelledby',titleId);d.innerHTML='<div class="es-dialog-head"><h2 id="'+titleId+'">'+E(title)+'</h2><button type="button" data-close aria-label="關閉視窗">×</button></div><div class="es-dialog-body">'+body+'</div><div class="es-dialog-footer">'+(footer||'<button type="button" data-close>關閉</button>')+'</div>';
        const focus=document.activeElement;document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target.closest('[data-close]'))d.close();});d.addEventListener('close',()=>{d.remove();if(focus&&focus.isConnected)focus.focus();},{once:true});d.showModal();return d;
    }
    async function confirm(title,message){return new Promise(resolve=>{const d=modal(title,'<p>'+E(message)+'</p>','<button type="button" data-close>取消</button><button type="button" class="es-primary" data-confirm>確認</button>');let yes=false;d.querySelector('[data-confirm]').onclick=()=>{yes=true;d.close();};d.addEventListener('close',()=>resolve(yes));});}
    function page(title,body){
        const d=document.createElement('section'),focus=document.activeElement,previousState=history.state;
        const marker=uid(),siblings=Array.from(document.body.children).map(el=>({el,inert:el.inert}));
        d.className='es es-survey-page';d.setAttribute('aria-label','調查填答');
        d.innerHTML='<div class="es-page-wrap"><header class="es-page-head"><button type="button" data-close>← 返回聯絡簿</button><small>山熊科學 · 調查</small></header><div class="es-page-card"><div class="es-dialog-head"><h2 tabindex="-1">'+E(title)+'</h2></div><div class="es-dialog-body">'+body+'</div><div class="es-dialog-footer"></div></div></div>';
        siblings.forEach(x=>{x.el.inert=true;});document.body.appendChild(d);
        history.pushState({ebookSurveyPage:marker},'');
        function remove(){if(!d.isConnected)return;d.remove();siblings.forEach(x=>{if(x.el.isConnected)x.el.inert=x.inert;});window.removeEventListener('popstate',back);if(focus&&focus.isConnected)focus.focus();}
        function back(){if(!history.state||history.state.ebookSurveyPage!==marker)remove();}
        d.close=function(reset){remove();if(history.state&&history.state.ebookSurveyPage===marker){if(reset)history.replaceState(previousState,'');else history.back();}};
        d.addEventListener('click',e=>{if(e.target.closest('[data-close]'))d.close();});window.addEventListener('popstate',back);d.querySelector('h2').focus();return d;
    }
    function status(node,message,error){const s=node.querySelector('.es-status');if(s){s.textContent=message;s.classList.toggle('error',!!error);}}
    function download(name,text){const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    root.EbookSurveyView={uid,book,fields,collect,review,modal,page,confirm,status,download};
})(window);
