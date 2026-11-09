(function(root){
    'use strict';
    const C=root.EbookSurveyContract,V=root.EbookSurveyView,E=C.esc;
    let storageFactory=null;const states=new WeakMap();
    function configure(config){storageFactory=config.storage;}
    function files(node,q){const state=states.get(node);if(state&&state.answers[q.id])return state.answers[q.id].files.slice();const el=node.querySelector('[data-photo-question="'+q.id+'"]');try{return JSON.parse(el&&el.dataset.initialFiles||'[]');}catch(_){return [];}}
    function pending(node){return !!(states.get(node)||{}).busy;}
    async function shrink(file){
        if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)||file.size>20*1024*1024)throw new Error('請選擇 20MB 內的 JPG、PNG、WebP 或 HEIC 照片。');
        const url=URL.createObjectURL(file);let img;
        try{
            img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
            const scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
            canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
            const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));canvas.width=canvas.height=1;
            if(blob&&blob.size<=5*1024*1024&&blob.size<file.size)return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
        }catch(e){/* HEIC 無法在此瀏覽器解碼時保留原檔，老師可下載檢視。 */}
        finally{URL.revokeObjectURL(url);if(img)img.src='';}
        if(file.size>5*1024*1024)throw new Error('這張照片無法縮小至 5MB，請改用 JPG 或較小的照片。');
        return file;
    }
    function bind(node,form,initial,config){
        const previous=states.get(node);if(previous)previous.dispose();
        const state={answers:{},busy:0,disposed:false,task:null,dispose:()=>{state.disposed=true;if(state.task&&state.task.cancel)state.task.cancel();}};
        states.set(node,state);node.addEventListener('close',state.dispose,{once:true});node.addEventListener('survey:close',state.dispose,{once:true});
        for(const q of form.questions.filter(C.isAttachment))state.answers[q.id]={files:JSON.parse(JSON.stringify((initial[q.id]||{}).files||[]))};
        function active(){return !state.disposed&&node.isConnected&&states.get(node)===state;}
        function lock(){node.querySelectorAll('[data-submit],[data-delegate]').forEach(b=>{b.disabled=!!state.busy||!!config.preview||!!config.readOnly;});}
        function render(q){const host=node.querySelector('[data-photo-question="'+q.id+'"]');if(!host)return;host.querySelector('[data-photo-list]').innerHTML=state.answers[q.id].files.map(f=>'<div class="es-photo-row"><button type="button" data-file-open="'+E(f.id)+'" data-file-question="'+E(q.id)+'">查看照片：'+E(f.name)+'</button><button type="button" data-photo-remove="'+E(f.id)+'" '+(state.busy||config.preview||config.readOnly?'disabled':'')+'>移除</button></div>').join('');}
        node.querySelectorAll('[data-photo-input]').forEach(input=>{
            const q=form.questions.find(x=>x.id===input.dataset.photoInput);render(q);input.disabled=!!config.preview||!!config.readOnly;
            input.onchange=async()=>{
                if(!active()||state.busy||config.preview||config.readOnly)return;
                const picked=Array.from(input.files||[]);input.value='';if(!picked.length)return;
                if(state.answers[q.id].files.length+picked.length>5){V.status(node,'每題最多上傳 5 張照片。',true);return;}
                const total=Object.values(state.answers).reduce((n,a)=>n+a.files.length,0);
                if(total+picked.length>10){V.status(node,'每份回答最多附上 10 張照片。',true);return;}
                state.busy++;lock();node.querySelectorAll('[data-photo-input]').forEach(x=>x.disabled=true);
                try{for(let i=0;i<picked.length;i++){
                    V.status(node,'正在處理照片 '+(i+1)+'／'+picked.length+'，請稍候…');
                    const file=await shrink(picked[i]);if(!active())return;
                    const uploadId=V.uid(),payload={...config.scope,questionId:q.id,uploadId};
                    const ticket=await config.request({...payload,action:'prepareUpload',name:file.name,contentType:file.type,size:file.size});if(!active())return;
                    if(!ticket.ready){
                        if(config.upload)await config.upload(ticket,file);
                        else{if(!storageFactory)throw new Error('照片上傳尚未就緒，請重新整理。');state.task=storageFactory().ref(ticket.path).put(file,ticket.metadata);await state.task;state.task=null;}
                    }
                    if(!active())return;const result=await config.request({...payload,action:'completeUpload'});if(!active())return;
                    state.answers[q.id].files.push(result.file);render(q);
                }V.status(node,'照片已上傳，請記得按「送出回答」或「儲存修改」。');}
                catch(error){if(active())V.status(node,error.message||'照片上傳失敗，已上傳的照片會保留，請重新選擇未完成的照片。',true);}
                finally{state.busy--;if(active()){lock();node.querySelectorAll('[data-photo-input]').forEach(x=>x.disabled=false);form.questions.filter(C.isAttachment).forEach(render);}}
            };
        });
        const oldClick=node._surveyAttachmentClick;if(oldClick)node.removeEventListener('click',oldClick);
        node._surveyAttachmentClick=async event=>{
            const remove=event.target.closest('[data-photo-remove]');
            if(remove&&!state.busy&&!config.preview&&!config.readOnly){const q=remove.closest('[data-photo-question]').dataset.photoQuestion;state.answers[q].files=state.answers[q].files.filter(f=>f.id!==remove.dataset.photoRemove);render(form.questions.find(x=>x.id===q));return;}
            const button=event.target.closest('[data-file-open]');if(!button||config.preview||!config.request)return;
            button.disabled=true;const dialog=V.modal('查看照片','<p role="status">正在載入照片…</p>');
            try{const result=await config.request({...config.scope,action:'attachment',questionId:button.dataset.fileQuestion,attachmentId:button.dataset.fileOpen});if(!active()||!dialog.isConnected){if(dialog.isConnected)dialog.close();return;}
                const url=new URL(result.url);if(url.protocol!=='https:'&&!(config.upload&&url.protocol==='blob:'))throw new Error('照片連結無效。');
                dialog.querySelector('.es-dialog-body').innerHTML='<p>'+E(result.name)+'</p><img class="es-photo-preview" src="'+E(url.href)+'" alt="上傳的照片"><p class="es-muted">若照片格式無法顯示，可下載檢視。</p><a class="es-button" href="'+E(url.href)+'" target="_blank" rel="noopener noreferrer">開啟／下載照片</a>';
            }catch(error){if(dialog.isConnected)dialog.querySelector('.es-dialog-body').textContent=error.message||'照片無法載入，請稍後重試。';}
            finally{if(button.isConnected)button.disabled=false;}
        };node.addEventListener('click',node._surveyAttachmentClick);
    }
    root.EbookSurveyAttachments={configure,bind,files,pending,shrink};
})(window);
