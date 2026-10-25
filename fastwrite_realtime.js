(function(root){'use strict';
 // 同時至多四個可見項目；切頁、隱藏與登出由 owning UI 清理。
 function create({database,getIdentity,limit=4,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
  if(!database?.ref||typeof getIdentity!=='function'||!Number.isSafeInteger(limit)||limit<1||limit>4)throw Error('invalid-realtime-client');
  const active=new Map();
  function open(id,{transport,onValue,onState=()=>{},prefix}){
   if(active.has(id))return active.get(id).stop;if(active.size>=limit)throw Error('realtime-visible-limit');
   if(!/^ebook_fast_write_v1\/(?:segments|business_entities)\/[\w-]+\/[\w-]+\//.test(prefix)||!transport?.watch||!transport?.renew||typeof onValue!=='function')throw Error('invalid-realtime-target');
   const identity=getIdentity();let stopped=false,timer,bindings=[],headBinding,headSegment,fetching=false,queued=false,expiresAt=0,lastSignature='';
   const live=()=>!stopped&&getIdentity()===identity;
   function detach(){for(const [ref,cb]of bindings)ref.off('value',cb);bindings=[];if(headBinding){headBinding[0].off('value',headBinding[1]);headBinding=null;}clearTimer(timer);}
   function stop(){if(stopped)return;stopped=true;detach();active.delete(id);}
   async function failed(error){if(!live()){stop();return;}stop();onState('blocked',error);}
   function emit(value){if(!live()){stop();return;}const signature=JSON.stringify(value);if(signature===lastSignature)return;lastSignature=signature;onValue(value);}
   function bind(grant,view){
    if(!grant||typeof grant.path!=='string'||!grant.path.startsWith(prefix)||!Number.isSafeInteger(grant.expiresAt)||grant.expiresAt<=now()||grant.expiresAt>now()+70000)throw Error('invalid-realtime-grant');
    const suffix=grant.path.slice(prefix.length);if(!/^(?:public\/(?:student|teacher)|p\d{12}\/public)$/.test(suffix))throw Error('invalid-realtime-grant');
    if(grant.headPath&&grant.headPath!==prefix.replace('/segments/','/conversations/')+'head')throw Error('invalid-realtime-head');
    expiresAt=grant.expiresAt;clearTimer(timer);
    const same=bindings[0]?.[2]===grant.path;
    if(!same){for(const [ref,cb]of bindings)ref.off('value',cb);bindings=[];lastSignature='';headSegment=view?.segment||suffix.split('/')[0];
     const ref=database.ref(grant.path),cb=snap=>{if(!live()){stop();return;}const value=snap.val();if(value===null){failed(Error('realtime-projection-missing'));return;}emit({...value,...(grant.headPath?{segment:headSegment}:{})});};bindings.push([ref,cb,grant.path]);ref.on('value',cb,failed);
    }
    if(grant.headPath&&!headBinding){const ref=database.ref(grant.headPath),cb=snap=>{if(!live()){stop();return;}const next=snap.val()?.segment;if(!/^p\d{12}$/.test(next||'')){failed(Error('invalid-realtime-head'));return;}if(next!==headSegment)refresh(true);};headBinding=[ref,cb];ref.on('value',cb,failed);}
    if(!live()){detach();return;}timer=setTimer(()=>refresh(false),Math.max(1000,expiresAt-now()-15000));onState('connected');
   }
   async function refresh(full){
    if(!live()){stop();return;}if(fetching){queued=queued||full;return;}fetching=true;
    try{const view=await(full?transport.watch():transport.renew());if(!live()){stop();return;}if(view.authority==='legacy'){stop();onState('legacy',view);return;}bind(view.realtime,view);}
    catch(e){await failed(e);}finally{fetching=false;if(queued&&live()){queued=false;refresh(true);}}
   }
   active.set(id,{stop});refresh(true);return stop;
  }
  function keepOnly(ids){const allowed=new Set(ids);for(const [id,item]of active)if(!allowed.has(id))item.stop();}
  function clear(){keepOnly([]);}
  return{open,keepOnly,clear,size:()=>active.size};
 }
 root.ProductionFastWriteRealtime={create};if(typeof module!=='undefined')module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
