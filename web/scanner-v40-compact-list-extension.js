(function(){
  'use strict';

  window.bricoCompactListMode=true;

  var STYLE_ID='bricoCompactListV40Style';
  var DB_NAME='BricoScannerProductsV1';
  var PRODUCT_STORE='products';
  var META_STORE='meta';
  var META_KEY='current';
  var scheduled=false;
  var dbPromise=null;
  var dbStatus={ready:false,stale:false,reportDate:'',source:'START'};

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

  function parseReportDate(value){
    var s=clean(value);if(!s)return null;
    var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    m=/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(s);
    if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
    var d=new Date(s);return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
  }

  function isStaleDate(value){
    var d=parseReportDate(value);if(!d)return true;
    var now=new Date();
    return d.getFullYear()!==now.getFullYear()||d.getMonth()!==now.getMonth()||d.getDate()!==now.getDate();
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

  async function getMeta(){
    var db=await openDb();
    if(!db||!db.objectStoreNames.contains(META_STORE))return null;
    return await new Promise(function(resolve){
      try{
        var tx=db.transaction(META_STORE,'readonly');
        var r=tx.objectStore(META_STORE).get(META_KEY);
        r.onsuccess=function(){resolve(r.result||null)};
        r.onerror=function(){resolve(null)};
      }catch(e){resolve(null)}
    });
  }

  async function refreshDbStatus(){
    var src=sourceBadge();
    var sourceText=src?clean(src.textContent).toUpperCase():'START';
    var meta=await getMeta();
    dbStatus.ready=!!meta;
    dbStatus.reportDate=meta&&meta.reportDate?clean(meta.reportDate):'';
    dbStatus.stale=dbStatus.ready&&isStaleDate(dbStatus.reportDate);
    dbStatus.source=sourceText;

    ensureHeaderBits();
    var dst=document.getElementById('bricoDbBadgeV40');if(!dst)return;
    dst.title=dbStatus.reportDate?'Raport: '+dbStatus.reportDate:'';

    if(dbStatus.ready&&dbStatus.stale){dst.textContent='BAZA: NIEAKTUALNA';dst.className='warn';return}
    if(dbStatus.ready&&sourceText.indexOf('OFFLINE')>=0){dst.textContent='BAZA: OFFLINE';dst.className='warn';return}
    if(dbStatus.ready&&!/(BŁĄD|BRAK KLUCZA|START|SPRAWDZAM|POBIERAM|ANALIZA)/.test(sourceText)){dst.textContent='BAZA: AKTUALNA';dst.className='ok';return}
    if(sourceText.indexOf('BŁĄD')>=0||sourceText.indexOf('BRAK KLUCZA')>=0){dst.textContent='BAZA: BŁĄD';dst.className='err';return}
    dst.textContent='BAZA: START';dst.className='warn';
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
    var current=clean(meta.textContent).replace(/\s*•\s*(Stan .*|Brak w bazie|Brak w nieaktualnej bazie).*$/,'');
    meta.setAttribute('data-brico-base-meta-v40',current);
    return current;
  }

  function productText(p){
    if(!p)return dbStatus.stale?' • Brak w nieaktualnej bazie':' • Brak w bazie';
    var stock=intLike(p.stock);
    if(stock!=='—')stock+=' szt';
    return ' • Stan '+stock+' • Cena N. '+money(p.purchasePrice)+' • Cena Sp. '+money(p.salePrice);
  }

  async function decorateRow(row){
    if(!dbStatus.ready)return;
    var codeEl=row.querySelector('.code'),meta=row.querySelector('.itemmeta');
    if(!codeEl||!meta)return;
    var ean=clean(codeEl.textContent).replace(/\D/g,'');
    if(!/^(\d{8}|\d{13})$/.test(ean))return;
    var dataKey=ean+'|'+(dbStatus.reportDate||'?');
    if(row.getAttribute('data-brico-product-key-v40')===dataKey)return;
    row.setAttribute('data-brico-product-key-v40',dataKey);
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

    var list=document.getElementById('scanList');
    if(!list)return;
    var rows=[].slice.call(list.querySelectorAll('.item'));
    var pos=document.getElementById('bricoPositionStatsV40');
    if(pos)pos.textContent='• '+rows.length+' '+positionWord(rows.length);

    var latest=latestCode();
    rows.forEach(function(row,idx){
      var codeEl=row.querySelector('.code');if(!codeEl)return;
      var code=clean(codeEl.textContent);
      row.classList.toggle('bricoLatestItem',latest?code===latest:idx===0);
    });

    refreshDbStatus().then(function(){rows.forEach(decorateRow)});
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

    setInterval(schedule,1500);
    setTimeout(update,150);
    setTimeout(update,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
