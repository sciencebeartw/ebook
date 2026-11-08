(function(root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.EbookSurveyContract = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';
    const classes = ['115小六資優自然週六上午班', '115小六資優自然週日下午班', '115小六資優自然週日晚上班'];
    const fail = (message, code = 'invalid-argument') => { const e = new Error(message); e.code = code; throw e; };
    const text = (x, max, required) => { x = typeof x === 'string' ? x.trim() : ''; if (x.length > max || (required && !x)) fail('請完整填寫內容，並確認字數限制。'); return x; };
    const key = x => { if (!/^[A-Za-z0-9_-]{1,100}$/.test(x || '') || ['__proto__','constructor','prototype'].includes(x)) fail('資料識別碼不正確。'); return x; };
    const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const date = x => x ? new Intl.DateTimeFormat('zh-TW', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(x)) : '尚未設定';
    const localDate = x => x ? new Date(Number(x)+28800000).toISOString().slice(0,16) : '';
    function stamp(x) { if (!x) return 0; const n = typeof x === 'number' ? x : Date.parse(x + (/[Z+]\d*:?\d*$/.test(x) ? '' : ':00+08:00')); if (!Number.isFinite(n) || n < 0) fail('日期時間不正確。'); return n; }
    function https(x) { if (!x) return ''; try { const u = new URL(x); if (u.protocol === 'https:' && !u.username && !u.password) return u.href; } catch (_) {} fail('圖片及書籍連結須使用 HTTPS 網址。'); }
    function normalize(raw) {
        const classNames = [...new Set(raw.classNames || [])].map(x => text(x,100,true));
        if (!classNames.length || classNames.length > 12) fail('請選擇 1 至 12 個班級。');
        if (!['science','math'].includes(raw.subjectKey)) fail('請選擇科目。');
        if (!Array.isArray(raw.questions) || !raw.questions.length || raw.questions.length > 12) fail('每份調查需有 1 至 12 題。');
        const ids = new Set();
        const questions = raw.questions.map(q => {
            const id = key(q.id); if (ids.has(id)) fail('題目識別碼重複。'); ids.add(id);
            if (!['single','multiple','text'].includes(q.type)) fail('題型不正確。');
            const options = q.type === 'text' ? [] : (q.options || []).map(o => ({id:key(o.id),label:text(o.label,160,true)}));
            if (q.type !== 'text' && (options.length < 2 || options.length > 16 || new Set(options.map(o=>o.id)).size !== options.length)) fail('選擇題需有 2 至 16 個不同選項。');
            return {id,type:q.type,title:text(q.title,300,true),required:q.required !== false,options};
        });
        const startsAt = stamp(raw.startsAt), endsAt = stamp(raw.endsAt);
        if (endsAt && endsAt <= startsAt) fail('截止時間須晚於開始時間。');
        const selection = {};
        for (const name of classNames) if (Array.isArray((raw.selection || {})[name])) selection[name] = [...new Set(raw.selection[name].map(x=>text(x,180,true)))];
        const result = {title:text(raw.title,100,true),description:text(raw.description,2500,false),subjectKey:raw.subjectKey,classNames,selection,questions,startsAt,endsAt,remind:raw.remind !== false,bookTitle:text(raw.bookTitle,200,false),bookUrl:https(raw.bookUrl),imageUrl:https(raw.imageUrl),bookIsbn:text(raw.bookIsbn,32,false),bookEdition:text(raw.bookEdition,100,false)};
        if (JSON.stringify(result).length > 32000) fail('問卷內容太多，請拆成兩份調查。');
        return result;
    }
    function answers(form, raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('回答格式不正確。');
        if (Object.keys(raw).some(k => !form.questions.some(q=>q.id===k))) fail('題目已更新，請重新載入。','failed-precondition');
        const out = {};
        for (const q of form.questions) {
            const v = raw[q.id];
            if (q.type === 'text') { out[q.id] = text(v,1000,q.required); continue; }
            const a = q.type === 'single' ? (v ? [v] : []) : (Array.isArray(v) ? v : []);
            if (a.some(x=>typeof x!=='string') || new Set(a).size !== a.length || a.some(x=>!q.options.some(o=>o.id===x))) fail('選項不正確，請重新選擇。');
            if (q.required && !a.length) fail('請完成所有必填題。');
            out[q.id] = q.type === 'single' ? (a[0] || '') : a;
        }
        return out;
    }
    function answerLabel(q, value) { if (q.type === 'text') return value || '未填寫'; const a=Array.isArray(value)?value:[value]; return a.filter(Boolean).map(id=>(q.options.find(o=>o.id===id)||{}).label||'未知選項').join('、') || '未填寫'; }
    function summary(form, members, responses) {
        const rows = members.map(m=>({...m,response:responses[m.participantId] || null}));
        const submitted = rows.filter(r=>r.response).length;
        return {total:rows.length,submitted,pending:rows.length-submitted,rows,questions:form.questions.map(q=>({...q,answered:rows.filter(r=>r.response && (Array.isArray(r.response.answers[q.id]) ? r.response.answers[q.id].length : !!r.response.answers[q.id])).length,counts:q.options.map(o=>({...o,count:rows.filter(r=>r.response && (Array.isArray(r.response.answers[q.id]) ? r.response.answers[q.id].includes(o.id) : r.response.answers[q.id]===o.id)).length}))}))};
    }
    function bookDraft() { return {title:'大滿貫自然教材調查',description:'大滿貫是額外的國小自然基礎練習，會搭配山熊自編複習題本使用。已有或曾寫過這本書，都不必再買一本。請協助確認是否需要老師準備；不確定版本可在備註說明。',subjectKey:'science',classNames:classes.slice(),selection:{},startsAt:0,endsAt:0,remind:true,bookTitle:'翰林｜大滿貫國小升私中．資優班自然入學攻略（高年級總複習）',bookUrl:'https://books.hanlin.com.tw/product/6740601',imageUrl:'https://books.hanlin.com.tw/Images/Covers/993094.jpg',bookIsbn:'9786263655645',bookEdition:'2025／2026 版皆可',questions:[{id:'book_owned',type:'single',title:'這本大滿貫是否需要老師準備？',required:true,options:[{id:'owned',label:'已有這本書，不需要再準備'},{id:'done',label:'已經寫過，不需要再買一本'},{id:'order',label:'還沒有，需要老師準備'},{id:'self',label:'自行準備，不需要老師代訂'}]},{id:'note',type:'text',title:'備註',required:false,options:[]}]}; }
    function makeupDraft() { return {...bookDraft(),title:'單次補課參加意願調查',description:'請老師填入原上課日期、加開補課日期、時間與地點，再發布調查。',bookTitle:'',bookUrl:'',imageUrl:'',bookIsbn:'',bookEdition:'',questions:[{id:'attend',type:'single',title:'孩子能否參加本次加開補課？',required:true,options:[{id:'yes',label:'可以參加'},{id:'no',label:'無法參加'}]},{id:'note',type:'text',title:'備註',required:false,options:[]}]}; }
    function csv(form, rows) { const cell = x => { let s=String(x==null?'':x); if (/^[\s]*[=+@-]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; }; const data=[['班級','學生','填答狀態',...form.questions.map(q=>q.title),'最後回覆時間','來源'],...rows.map(r=>[r.className,r.name,r.response?'已填':'未填',...form.questions.map(q=>r.response?answerLabel(q,r.response.answers[q.id]):''),r.response?date(r.response.updatedAt):'',r.response?(r.response.actor.role==='admin'?'老師代填':'學生／家長'):''])];return '\ufeff'+data.map(r=>r.map(cell).join(',')).join('\r\n'); }
    return {classes,fail,key,esc,date,localDate,stamp,normalize,answers,answerLabel,summary,bookDraft,makeupDraft,csv};
});
