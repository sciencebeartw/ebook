/* 聯絡簿提前建欄：只依目前已公開的精準貼文顯示，不從日期猜配。 */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GiftedAssignmentVisibility=api;})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 function visible(grade,posts,className,now){
  if(!grade)return true;
  var postId=grade.giftedPostId || grade.sourcePostId;
  if(!postId)return true;
  var rows=Array.isArray(posts)?posts:Object.keys(posts||{}).map(function(id){return Object.assign({id:id},posts[id]);});
  var matches=rows.filter(function(p){return p&&(p._rowKey||p.id)===postId&&(p.sourceClassKey||p.className)===className;});
  if(matches.length!==1)return false;
  var post=matches[0],options=post.displayOptions||{};
  if(typeof options==='string'){try{options=JSON.parse(options);}catch(_){return false;}}
  if(['cancelled','supplemental'].indexOf(options.session&&options.session.status)>=0)return false;
  var reserve=String(post.reserveTime||'').trim();
  if(reserve){var m=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(reserve);if(!m)return false;var time=Date.parse(m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0')+'T'+m[4].padStart(2,'0')+':'+m[5]+':'+(m[6]||'00')+'+08:00');if(!Number.isFinite(time)||time>(now===undefined?Date.now():now))return false;}
  if(!grade.giftedPostId)return true;
  var url='https://www.sciencebear.com.tw/ebook/?gifted='+grade.giftedPlanId+'&segment='+grade.giftedSegmentId;
  return String(post.hw1||'').split('\n').some(function(line){return /^\[課本作業｜[^\]]+\]/.test(line)&&line.trim().split(']').slice(1).join(']')===url;});
 }
 return {visible:visible};
});
