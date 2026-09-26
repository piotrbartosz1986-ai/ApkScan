(function(){
  'use strict';

  window.bricoCompactListMode=true;

  var STYLE_ID='bricoCompactListV40Style';
  var DB_NAME='BricoScannerProductsV1';
  var PRODUCT_STORE='products';
  var scheduled=false;
  var dbPromise=null;

  function clean(v){return String(v==null?'':v).trim()}
  function money(v){var n=Number(v);return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—'}
  function intLike(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:3}):'—'}

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
      #bricoDbBadgeV40{margin-left:auto;flex:0 0 auto;font-size:9px;font-weight:900;padding:4px 7px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:var(--panel2)}\
      #bricoDbBadgeV40.ok{color:#36d27f;border-color:#285d42;background:rgba(54,210,127,.08)}\
      #bricoDbBadgeV40.warn{color:#ffd166;border-color:#66552c;background:rgba(255,209,102,.08)}\
      #bricoDbBadgeV40.err{color:#ff6969;border-color:#673434;background:rgba(255,105,105,.08)}\
      html[data-brico-theme="light"] #bricoDbBadgeV40{background:rgba(0,0,0,.50)}\
    ';
    document.head.appendChild(style);
  }

  function ensureHeaderBits(){
    var qty=document.getElementById('qtyTotal');
    if(qty&&!document.getElementById('bricoPositionStatsV40')){
      var span=document.createElement('span');
      span.id='bricoPositionStatsV40';
      span.className='bricoPositionStatsV40';
      qty.insertAdjacentElement('afterend',span);
    }
    var head=document.querySelector('.listHead');
    if(head&&!document.getElementById('bricoDbBadgeV40')){
      var badge=document.createElement('div');
      badge.id='bricoDbBadgeV40';
      badge.textContent='BAZA: START';
      head.appendChild(badge);
    }
  }

  function positionWord(n){
    if(n===1)return 'pozycja';
    var last=n%10,last2=n%100;
    if(last>=2&&last<=4&&!(last2>=12&&last2<=14))return 'pozycje';
    return 'pozycji';
  }

  function sourceBadge(){return document.getElementById('bricoDbBadge')}
  function databaseReady(){
    var src=sourceBadge();
    if(!src)return false;
    var t=clean(src.textContent).toUpperCase();
    if(!t||t.indexOf('BAZA:')!==0)return false;
    return !/(START|SPRAWDZAM|POBIERAM|ANALIZA|BŁĄD|BRAK KLUCZA)/.test(t);
  }

  function syncBadge(){
    ensureHeaderBits();
    var src=sourceBadge(),dst=document.getElementById('bricoDbBadgeV40');
    if(!dst)return;
    if(!src){dst.textContent='BAZA: START';dst.className='warn';return}
    var raw=clean(src.textContent),upper=raw.toUpperCase();
    var cls='';
    if(upper.indexOf('BŁĄD')>=0||upper.indexOf('BRAK')>=0)cls='err';
    else if(upper.indexOf('OFFLINE')>=0||upper.indexOf('SPRAWDZAM')>=0||upper.indexOf('POBIERAM')>=0||upper.indexOf('ANALIZA')>=0||upper.indexOf('START')>=0)cls='warn';
    else cls='ok';
    if(cls==='ok')dst.textContent='BAZA: ONLINE';
    else if(upper.indexOf('OFFLINE')>=0)dst.textContent='BAZA: OFFLINE';
    else if(upper.indexOf('BŁĄD')>=0)dst.textContent='BAZA: BŁĄD';
    else dst.textContent=raw||'BAZA: START';
    dst.className=cls;
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(function(resolve){
      try{
        var req=indexedDB.open(DB_NAME);
        req.onsuccess=function(){
          var db=req.result;
          if(!db.objectStoreNames.contains(PRODUCT_STORE)){try{db.close()}catch(e){};resolve(null);return}
          resolve(db);
        };
        req.onerror=function(){resolve(null)};
        req.onupgradeneeded=function(){try{req.transaction.abort()}catch(e){}};
      }catch(e){resolve(null)}
    });
    return dbPromise;
  }

  async function getProduct(ean){
    var db=await openDb();
    if(!db)return null;
    return await new Promise(function(resolve){
      try{
        var tx=db.transaction(PRODUCT_STORE,'readonly');
        var r=tx.objectStore(PRODUCT_STORE).get(ean);
        r.onsuccess=function(){resolve(r.result||null)};
        r.onerror=function(){resolve(null)};
      }catch(e){resolve(null)}
    });
  }

  function latestCode(){
    var last=document.getElementById('lastCode');
    var value=last?clean(last.textContent):'';
    return /^(\d{8}|\d{13})$/.test(value)?value:'';
  }

  function baseMeta(meta){
    var saved=meta.getAttribute('data-brico-base-meta-v40');
    if(saved!=null)return saved;
    var current=clean(meta.textContent).replace(/\s*•\s*(Stan .*|Brak w bazie).*$/,'');
    meta.setAttribute('data-brico-base-meta-v40',current);
    return current;
  }

  function productText(p){
    if(!p)return ' • Brak w bazie';
    var stock=intLike(p.stock);
    if(stock!=='—')stock+=' szt';
    return ' • Stan '+stock+' • Cena N. '+money(p.purchasePrice)+' • Cena Sp. '+money(p.salePrice);
  }

  async function decorateRow(row){
    if(!databaseReady())return;
    var codeEl=row.querySelector('.code'),meta=row.querySelector('.itemmeta');
    if(!codeEl||!meta)return;
    var ean=clean(codeEl.textContent).replace(/\D/g,'');
    if(!/^(\d{8}|\d{13})$/.test(ean))return;
    if(row.getAttribute('data-brico-product-ean-v40')===ean)return;
    row.setAttribute('data-brico-product-ean-v40',ean);
    var p=await getProduct(ean);
    if(!row.isConnected)return;
    var currentCode=clean((row.querySelector('.code')||{}).textContent).replace(/\D/g,'');
    if(currentCode!==ean)return;
    var m=row.querySelector('.itemmeta');if(!m)return;
    m.textContent=baseMeta(m)+productText(p);
  }

  function update(){
    scheduled=false;
    ensureStyle();
    ensureHeaderBits();
    syncBadge();

    var list=document.getElementById('scanList');
    if(!list)return;
    var rows=[].slice.call(list.querySelectorAll('.item'));
    var pos=document.getElementById('bricoPositionStatsV40');
    if(pos)pos.textContent='• '+rows.length+' '+positionWord(rows.length);

    var latest=latestCode();
    rows.forEach(function(row,idx){
      var codeEl=row.querySelector('.code');
      if(!codeEl)return;
      var code=clean(codeEl.textContent);
      row.classList.toggle('bricoLatestItem',latest?code===latest:idx===0);
      decorateRow(row);
    });
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(update,0);
  }

  function boot(){
    ensureStyle();
    ensureHeaderBits();
    update();

    var list=document.getElementById('scanList');
    if(list&&'MutationObserver' in window)new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
    var last=document.getElementById('lastCode');
    if(last&&'MutationObserver' in window)new MutationObserver(schedule).observe(last,{childList:true,subtree:true,characterData:true});
    var src=sourceBadge();
    if(src&&'MutationObserver' in window)new MutationObserver(function(){dbPromise=null;schedule()}).observe(src,{childList:true,subtree:true,characterData:true,attributes:true});

    setInterval(function(){syncBadge();if(databaseReady())schedule()},1200);
    setTimeout(update,150);
    setTimeout(update,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
