(function(root){
  'use strict';
  // Presentation only: never insert markup into stored questions, answers or reviews.
  const characters=['Super羊','冠冠河馬','可可豆','大尾狼','小彥雀','小華貓','巧易狐','放電蛙','無尾東','爆破熊','羊駝','葉葉兔','藍鷹博士','西米鹿','詩蟻獸','霹靂喵','鹽水鵝','黛比虎','暴走狐','卡吉兔','小焰雀'];
  const people=['心儀','列文虎克','虎克','孟德爾','達爾文','林奈','牛頓','伽利略','法拉第','哈雷','哥白尼','愛因斯坦','愛迪生','阿基米德','拉馬克','波以耳','奧斯特','厄斯特','伽伐尼','勒朗社','馬克士威','阿瑞尼士','伏特','安培','SvanteAugustArrhenius'];
  const names=[...characters,...people].sort((a,b)=>b.length-a.length);
  const pattern=names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function isName(text,at,name,context){
    const before=text.slice(0,at),after=text.slice(at+name.length);
    if(name==='心儀'&&after.startsWith('的'))return false;
    if(name==='羊駝'&&/^[豚脈]/.test(after))return false;
    if(['牛頓','伏特','安培'].includes(name)){
      if(/(?:[\d.０-９]|幾|多少|若干|數|當成)\s*$/.test(before)||/^(?:計|數)/.test(after))return false;
      if(/單位[是為「『：:\s]*$/.test(before))return false;
      // An isolated choice in a unit question is a unit, not the scientist.
      if(!before.replace(/^[（(]?[A-D][）).、]?\s*/,'').trim()&&!after.trim()&&/單位|電壓為多少/.test(context||''))return false;
    }
    return true;
  }
  function parts(value,context=''){
    const text=String(value??''),out=[];let at=0;
    for(const m of text.matchAll(new RegExp(pattern,'g'))){
      if(!isName(text,m.index,m[0],context))continue;
      if(m.index>at)out.push({text:text.slice(at,m.index),name:false});
      out.push({text:m[0],name:true});at=m.index+m[0].length;
    }
    if(at<text.length)out.push({text:text.slice(at),name:false});return out;
  }
  function html(value,context){return parts(value,context).map(p=>p.name?'<u class="gifted-proper-name">'+escape(p.text)+'</u>':escape(p.text)).join('');}
  function decorate(container,context=''){
    if(!container)return 0;
    const doc=container.ownerDocument,walker=doc.createTreeWalker(container,4),nodes=[];let node,count=0;
    while((node=walker.nextNode()))if(!node.parentElement.closest('u,script,style,textarea,input,select,code,pre,[data-no-proper-names]'))nodes.push(node);
    for(const textNode of nodes){
      const tokens=parts(textNode.nodeValue,context);if(!tokens.some(p=>p.name))continue;
      const fragment=doc.createDocumentFragment();
      for(const p of tokens){if(p.name){const mark=doc.createElement('u');mark.className='gifted-proper-name';mark.textContent=p.text;fragment.append(mark);count++;}else fragment.append(doc.createTextNode(p.text));}
      textNode.replaceWith(fragment);
    }
    return count;
  }
  const api={characters,people,parts,html,decorate};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GiftedProperNames=api;
})(typeof window==='undefined'?globalThis:window);
