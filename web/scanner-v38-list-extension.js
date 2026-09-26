(function(){
  'use strict';

  var LIST_NAME_KEY='brico.list.name';
  var TOKEN_KEY='brico.upload.token';
  var LOOKUP_URL='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_product_lookup.php';
  var SHOP='08042';
  var pendingClickedEan='';
  var lookupTimer=null;
  var wrappedUploadResult=false;

  function clean(v){ return String(v==null?'':v).trim(); }
  function cleanEan(v){ return String(v==null?'':v).replace(/\D/g,''); }
  function money(v){ var n=Number(String(v==null?'':v).replace(',','.')); return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—'; }
  function qty(v){ var n=Number(String(v==null?'':v).replace(',','.')); return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:3}):(clean(v)||'—'); }
  function token(){ try{return clean(localStorage.getItem(TOKEN_KEY));}catch(e){return '';} }
  function hasNativeUpload(){ return !!(window.BricoUpload&&typeof window.BricoUpload.uploadJson==='function'); }

  function ensureStyle(){
    if(document.getElementById('bricoListV38Style')) return;
    var style=document.createElement('style');
    style.id='bricoListV38Style';
    style.textContent='\
      .bricoListNameV38{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:7px;margin:2px 0 7px}\
      .bricoListNameV38 label{font-size:8px;font-weight:900;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;white-space:nowrap}\
      .bricoListNameV38 input{width:100%;height:31px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);padding:4px 8px;font-size:11px;font-weight:750;outline:none}\
      .bricoListNameV38 input:focus{border-color:var(--green)}\
      #scanList .code.bricoProductLinkV38{cursor:pointer;color:var(--blue);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}\
      #scanList .code.bricoProductLinkV38:active{opacity:.65}\
      html[data-brico-theme="light"] .bricoListNameV38 input{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}\
    ';
    document.head.appendChild(style);
  }

  function ensureListName(){
    if(document.getElementById('bricoListNameV38')) return;
    var list=document.getElementById('scanList');
    if(!list) return;
    var panel=list.closest('.panel');
    var head=panel&&panel.querySelector('.listHead');
    if(!panel||!head) return;
    var row=document.createElement('div');
    row.className='bricoListNameV38';
    row.innerHTML='<label for="bricoListNameV38">Nazwa listy</label><input id="bricoListNameV38" type="text" maxlength="80" placeholder="Lista" autocomplete="off">';
    head.insertAdjacentElement('afterend',row);
    var input=row.querySelector('input');
    try{ input.value=localStorage.getItem(LIST_NAME_KEY)||''; }catch(e){}
    input.addEventListener('input',function(){ try{ localStorage.setItem(LIST_NAME_KEY,this.value.slice(0,80)); }catch(e){} });
  }

  function markCodesClickable(){
    var list=document.getElementById('scanList');
    if(!list) return;
    [].forEach.call(list.querySelectorAll('.code'),function(el){
      if(/^(\d{8}|\d{13})$/.test(cleanEan(el.textContent))) el.classList.add('bricoProductLinkV38');
    });
  }

  function setBadge(text,kind){ var el=document.getElementById('bricoDbBadge'); if(el){el.textContent=text;el.className='bricoDbBadge'+(kind?' '+kind:'');} }
  function setFoot(text){ var el=document.getElementById('bricoProductFoot'); if(el)el.textContent=text||''; }
  function setText(id,value){ var el=document.getElementById(id); if(el)el.textContent=value; }

  function showLookupStart(ean){
    var name=document.getElementById('bricoProductName');
    if(name){ name.textContent='Szukam produktu…'; name.classList.remove('bricoMissing'); }
    setText('bricoProductEan',ean);setText('bricoProductStock','—');setText('bricoProductBuy','—');setText('bricoProductSell','—');
    setBadge('BAZA: SZUKAM','warn');setFoot('Szukam '+ean+'…');
  }
  function showLookupMissing(ean){
    var name=document.getElementById('bricoProductName');
    if(name){ name.textContent='Brak produktu w bazie.'; name.classList.add('bricoMissing'); }
    setText('bricoProductEan',ean||'—');setText('bricoProductStock','—');setText('bricoProductBuy','—');setText('bricoProductSell','—');
    setBadge('BAZA: ONLINE','ok');setFoot('Kod nie występuje w bazie sklepu '+SHOP+'.');
  }
  function showLookupProduct(p){
    p=p||{};
    var name=document.getElementById('bricoProductName');
    if(name){ name.textContent=p.name||'Produkt bez nazwy'; name.classList.toggle('bricoMissing',p.active===false); }
    setText('bricoProductEan',p.ean||pendingClickedEan||'—');setText('bricoProductStock',qty(p.stock));setText('bricoProductBuy',money(p.purchasePrice));setText('bricoProductSell',money(p.salePrice));
    setBadge('BAZA: ONLINE','ok');
    var bits=[];if(p.brand)bits.push(p.brand);if(p.active===false)bits.push('NIEAKTYWNY');setFoot(bits.join(' • ')||'Dane z bazy sklepu '+SHOP+'.');
  }

  function lookupFromList(ean){
    ean=cleanEan(ean);if(!/^(\d{8}|\d{13})$/.test(ean))return;
    pendingClickedEan=ean;showLookupStart(ean);
    var card=document.getElementById('bricoProductCard');if(card)setTimeout(function(){card.scrollIntoView({behavior:'smooth',block:'start'});},20);
    if(!hasNativeUpload()){setBadge('BAZA: BRAK JAVA','err');setFoot('Brak natywnego modułu połączeń.');return;}
    var t=token();if(!t){setBadge('BAZA: BRAK KLUCZA','err');setFoot('Ustaw klucz wysyłania w ustawieniach.');return;}
    clearTimeout(lookupTimer);
    lookupTimer=setTimeout(function(){if(pendingClickedEan===ean){setBadge('BAZA: TIMEOUT','err');setFoot('Brak odpowiedzi bazy po 15 s.');}},15000);
    try{window.BricoUpload.uploadJson(LOOKUP_URL,t,JSON.stringify({type:'PRODUCT_LOOKUP',shop:SHOP,ean:ean,requestId:Date.now(),source:'LIST_CLICK'}));}
    catch(err){clearTimeout(lookupTimer);setBadge('BAZA: BŁĄD','err');setFoot('JAVA: '+(err&&err.message?err.message:String(err)));}
  }

  function wrapUploadResult(){
    if(wrappedUploadResult)return;wrappedUploadResult=true;
    var previous=window.onNativeUploadResult;
    window.onNativeUploadResult=function(result){
      if(typeof previous==='function'){try{previous(result);}catch(e){}}
      var server=result&&result.server?result.server:null;
      if(!server||server.kind!=='PRODUCT_LOOKUP'||!pendingClickedEan)return;
      var ean=cleanEan(server.ean||'');if(ean&&ean!==pendingClickedEan)return;
      clearTimeout(lookupTimer);
      if(!result.ok||!server.ok){setBadge('BAZA: BŁĄD','err');setFoot('Lookup: '+((server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'))));pendingClickedEan='';return;}
      if(!server.found)showLookupMissing(ean||pendingClickedEan);else showLookupProduct(server.product||{});
      pendingClickedEan='';
    };
  }

  function prepare(){ensureStyle();ensureListName();markCodesClickable();wrapUploadResult();}

  document.addEventListener('click',function(e){
    var code=e.target&&e.target.closest?e.target.closest('#scanList .code'):null;
    if(!code)return;e.preventDefault();lookupFromList(code.textContent);
  },true);

  var observer=new MutationObserver(markCodesClickable);
  function boot(){prepare();setTimeout(prepare,120);setTimeout(prepare,500);var list=document.getElementById('scanList');if(list)observer.observe(list,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
