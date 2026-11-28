(function(root){
  'use strict';
  // 只統一輸入法的全半形；上標、下標、單位大小寫和正負號有科學意義。
  const width = s => s.trim().replace(/[！-～]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/　/g,' ');
  const aliases = [
    ['鏈條','鍊條'], ['傳導','熱傳導'], ['滯留鋒','滯留鋒面'], ['冷鋒','冷鋒面'],
    ['衛星雲圖','氣象衛星雲圖'], ['硬幣','硬币'],
    ['北方','北','正北方'], ['東方','東','正東方'], ['南方','南','正南方'], ['西方','西','正西方'],
    ['東南方','東南'], ['西北方','西北'], ['一樣','相同'], ['不能','不可以'], ['中午 12 點','中午12點','正午','中午十二點']
  ];
  const decimal=/^([+-]?)(\d+)(?:\.(\d+))?$/;
  function decimalText(s){
    const m=decimal.exec(s.replace(/^−/,'-'));
    if(!m)return null;
    const digits=m[2].replace(/^0+(?=\d)/,''), fraction=(m[3]||'').replace(/0+$/,'');
    return (m[1]==='-'&&(digits!=='0'||fraction)?'-':'')+digits+(fraction?'.'+fraction:'');
  }
  function state(value,reference,questionId,label=''){
    const unordered=questionId==='grb_chapter_05_fill_001'||questionId==='grb_chapter_05_fill_005';
    const a=width(value), b=width(reference);
    if(!a)return 'blank';
    if(a===b)return 'correct';
    if(!b)return 'pending';
    if(aliases.some(group=>group.includes(b)&&group.includes(a)))return 'correct';
    if(questionId==='grb_chapter_08_fill_005' && (['酸','中','鹼'].includes(b)&&a===b+'性' || b==='紅'&&a==='紅色'))return 'correct';
    if(questionId==='grb_chapter_11_fill_004' && (b==='N'&&['N極','北極'].includes(a)||b==='S'&&['S極','南極'].includes(a)))return 'correct';
    if(questionId==='grb_chapter_12_fill_006' && (b==='1月'&&a==='一月'||b==='7月'&&a==='七月'))return 'correct';
    const number=decimalText(b);
    if(number!==null){
      let numericAnswer=a;
      if(label.includes('（公分）'))numericAnswer=a.replace(/\s*(?:公分|厘米|cm)$/,'');
      if(label.includes('（克重）'))numericAnswer=a.replace(/\s*(?:公克重|克重|gf|gw)$/,'');
      if(number===decimalText(numericAnswer))return 'correct';
    }
    if(/^[①②③④]$/.test(b)&&a===String('①②③④'.indexOf(b)+1))return 'correct';
    if(/^[A-F](?:[、, ]+[A-F])*$/.test(b)&&/^[A-F](?:[、, ]*[A-F])*$/i.test(a)){
      const aa=a.toUpperCase().replace(/[、, ]/g,''), bb=b.replace(/[、, ]/g,'');
      if(aa===bb||(unordered&&[...aa].sort().join('')===[...bb].sort().join('')))return 'correct';
    }
    if(/^[甲乙丙丁戊己庚辛壬癸](?:[、, ]*[甲乙丙丁戊己庚辛壬癸])+$/.test(b)){
      const groups=b.split(/[、, ]+/);
      // 例如「乙丙、戊己」分成兩組輪軸；單一代號清單才可省略分隔符號。
      if(groups.length>1&&groups.some(g=>g.length>1)){
        return a.split(/[、, ]+/).join('|')===groups.join('|')?'correct':'pending';
      }
      if(!/^[甲乙丙丁戊己庚辛壬癸](?:[、,\s]*(?:和|及|與)?[、,\s]*[甲乙丙丁戊己庚辛壬癸])*$/.test(a))return 'pending';
      const items=a.split(/[、,\s和及與]+/u).join('');
      if(!/^[甲乙丙丁戊己庚辛壬癸]+$/.test(items))return 'pending';
      const ref=groups.join('');
      if(items===ref)return 'correct';
      return [...items].sort().join('')===[...ref].sort().join('')?(unordered?'correct':'pending'):'wrong';
    }
    return 'pending';
  }
  root.GiftedLibraryFillState=state;
})(window);
