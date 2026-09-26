(function(){
  'use strict';

  var STYLE_ID='bricoCompactListV40Style';
  var scheduled=false;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\
      #hero{display:none!important}\
      #bricoProductCard{display:none!important}\
      #scanList .bricoProdMini{display:none!important}\
      #scanList .code{color:var(--text)!important;text-decoration:none!important;cursor:default!important}\
      #scanList .itemmeta{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.28!important}\
      #scanList .item.bricoLatestItem .code{font-size:17px!important;font-weight:950!important;line-height:1.08!important;letter-spacing:-.01em}\
      #scanList .item.bricoLatestItem .itemmeta{font-size:9px!important;font-weight:750}\
      .bricoPositionStatsV40{font-size:9px;color:var(--muted);margin-left:5px}\
    ';
    document.head.appendChild(style);
  }

  function ensurePositionCounter(){
    var qty=document.getElementById('qtyTotal');
    if(!qty||document.getElementById('bricoPositionStatsV40'))return;
    var span=document.createElement('span');
    span.id='bricoPositionStatsV40';
    span.className='bricoPositionStatsV40';
    qty.insertAdjacentElement('afterend',span);
  }

  function clean(v){return String(v==null?'':v).trim()}

  function productSuffix(row){
    var mini=row.querySelector('.bricoProdMini');
    if(!mini)return '';
    if(mini.classList.contains('bricoMissing'))return ' • Brak w bazie';
    var pvals=mini.querySelector('.pvals');
    if(!pvals)return '';
    var text=clean(pvals.textContent);
    var m=/^Stan:\s*(.*?)\s*•\s*Zakup:\s*(.*?)\s*•\s*Sprzedaż:\s*(.*?)\s*$/.exec(text);
    if(!m)return '';
    var stock=clean(m[1])||'—';
    var buy=clean(m[2])||'—';
    var sell=clean(m[3])||'—';
    if(stock!=='—'&&!/\bszt\.?$/i.test(stock))stock+=' szt';
    return ' • Stan '+stock+' • Cena N. '+buy+' • Cena Sp. '+sell;
  }

  function baseMeta(meta){
    var saved=meta.getAttribute('data-brico-base-meta-v40');
    if(saved!=null)return saved;
    var current=clean(meta.textContent);
    meta.setAttribute('data-brico-base-meta-v40',current);
    return current;
  }

  function latestCode(){
    var last=document.getElementById('lastCode');
    var value=last?clean(last.textContent):'';
    return /^(\d{8}|\d{13})$/.test(value)?value:'';
  }

  function update(){
    scheduled=false;
    ensureStyle();
    ensurePositionCounter();

    var list=document.getElementById('scanList');
    if(!list)return;
    var rows=[].slice.call(list.querySelectorAll('.item'));
    var pos=document.getElementById('bricoPositionStatsV40');
    if(pos)pos.textContent=rows.length+' '+(rows.length===1?'pozycja':(rows.length>=2&&rows.length<=4?'pozycje':'pozycji'));

    var latest=latestCode();
    rows.forEach(function(row,idx){
      var codeEl=row.querySelector('.code');
      var meta=row.querySelector('.itemmeta');
      if(!codeEl||!meta)return;
      var code=clean(codeEl.textContent);
      row.classList.toggle('bricoLatestItem',latest?code===latest:idx===0);
      var next=baseMeta(meta)+productSuffix(row);
      if(meta.textContent!==next)meta.textContent=next;
    });
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(update,0);
  }

  function boot(){
    ensureStyle();
    ensurePositionCounter();
    update();
    var list=document.getElementById('scanList');
    if(list&&'MutationObserver' in window){
      new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
    }
    var last=document.getElementById('lastCode');
    if(last&&'MutationObserver' in window){
      new MutationObserver(schedule).observe(last,{childList:true,subtree:true,characterData:true});
    }
    setTimeout(update,150);
    setTimeout(update,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
