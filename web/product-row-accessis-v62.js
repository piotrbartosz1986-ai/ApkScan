(function(){
  'use strict';

  var SHOP='08042';
  var LOOKUP_URL='https://bricolab.pl/BricoLab/api/scanner_product_lookup_v3.php';
  var DB_NAME='BricoScannerProductsV1';
  var PRODUCT_STORE='products';
  var pendingEan='';
  var pendingAt=0;
  var lastAttempt={};
  var lastSuccess={};
  var rowScanTimer=null;

  function clean(v){return String(v==null?'':v).trim()}
  function ean(v){return clean(v).replace(/\D/g,'')}
  function money(v){
    var n=Number(String(v==null?'':v).replace(',','.'));
    return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—';
  }
  function qty(v){
    var n=Number(String(v==null?'':v).replace(',','.'));
    return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:3}):'—';
  }
  function timeFromMeta(text){
    var m=String(text||'').match(/(?:^|\||•)\s*(\d{1,2}:\d{2}:\d{2})/);
    if(m)return m[1];
    var d=new Date();
    return [d.getHours(),d.getMinutes(),d.getSeconds()].map(function(x){return String(x).padStart(2,'0')}).join(':');
  }
  function badge(text,kind,title){
    var el=document.getElementById('bricoDbBadgeV40');
    if(!el)return;
    el.textContent=text;
    el.className=kind||'';
    el.title=title||'';
  }
  function shortError(result,server){
    var code=result&&result.httpCode?String(result.httpCode):'';
    var err=clean((server&&server.error)||(result&&result.error)||(result&&result.body)||'nieznany_blad');
    err=err.replace(/^HTTP\s+\d+\s*[•:-]?\s*/i,'').replace(/\s+/g,' ');
    if(err.length>32)err=err.slice(0,32)+'…';
    return (code?code+' ':'')+err;
  }
  function showDbError(result,server){
    var detail=shortError(result,server);
    badge('BAZA: BŁĄD · '+detail,'err',detail);
  }
  function hasNative(){return !!(window.BricoUpload&&typeof window.BricoUpload.uploadJsonAuth==='function')}
  function devicePayload(){
    var id='';
    try{if(window.BricoAuth&&typeof window.BricoAuth.getDeviceId==='function')id=String(window.BricoAuth.getDeviceId()||'')}catch(e){}
    return {deviceId:id,deviceName:'Brico Scanner Android',appVersion:'3.3.22-good320-accessis-single-bridge'};
  }

  function openDb(){
    return new Promise(function(resolve){
      try{
        var req=indexedDB.open(DB_NAME,1);
        req.onupgradeneeded=function(){
          var db=req.result;
          if(!db.objectStoreNames.contains(PRODUCT_STORE))db.createObjectStore(PRODUCT_STORE,{keyPath:'ean'});
          if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
        };
        req.onsuccess=function(){resolve(req.result)};
        req.onerror=function(){resolve(null)};
      }catch(e){resolve(null)}
    });
  }
  async function cacheProduct(product,code){
    if(!product)return;
    var id=ean(product.ean||code);if(!id)return;
    var p={};Object.keys(product).forEach(function(k){p[k]=product[k]});p.ean=id;
    var db=await openDb();if(!db)return;
    try{
      await new Promise(function(resolve){
        var tx=db.transaction(PRODUCT_STORE,'readwrite');
        tx.objectStore(PRODUCT_STORE).put(p);
        tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;
      });
    }catch(e){}
  }

  function matchingRows(code){
    code=ean(code);
    return [].slice.call(document.querySelectorAll('#scanList .item')).filter(function(row){
      var saved=ean(row.getAttribute('data-brico-ean-v40')||'');
      if(saved===code)return true;
      var codeEl=row.querySelector('.code');
      return ean(codeEl&&codeEl.textContent)===code;
    });
  }
  function renderFound(code,product){
    code=ean(code);if(!code||!product)return;
    lastSuccess[code]=Date.now();
    matchingRows(code).forEach(function(row){
      row.setAttribute('data-brico-ean-v40',code);
      row.classList.remove('bricoStaleDataV40');
      var codeEl=row.querySelector('.code');
      var meta=row.querySelector('.itemmeta');
      var tm=timeFromMeta(meta&&meta.textContent);
      if(codeEl)codeEl.textContent=clean(product.name)||code;
      if(meta)meta.textContent=tm+'|'+code+'|St. '+qty(product.stock)+'|C.Z. '+money(product.purchasePrice)+'|C. Sp. '+money(product.salePrice);
    });
    var convCode=document.getElementById('bricoConvCodeV48');
    var convName=document.getElementById('bricoConvNameV48');
    if(convCode&&convName&&ean(convCode.textContent)===code&&clean(product.name))convName.textContent=clean(product.name);
    badge('BAZA: ONLINE','ok','Dane produktu pobrane przez konto BricoLab / Accessis.');
  }
  function renderMissing(code){
    code=ean(code);if(!code)return;
    lastSuccess[code]=Date.now();
    matchingRows(code).forEach(function(row){
      row.setAttribute('data-brico-ean-v40',code);
      var codeEl=row.querySelector('.code');
      var meta=row.querySelector('.itemmeta');
      var tm=timeFromMeta(meta&&meta.textContent);
      if(codeEl)codeEl.textContent=code;
      if(meta)meta.textContent=tm+'|'+code+'|Brak w bazie';
    });
    badge('BAZA: ONLINE','ok','Połączenie działa; produktu nie znaleziono w bazie.');
  }

  function lookup(code,force){
    code=ean(code);if(!/^(\d{8}|\d{13})$/.test(code))return;
    var now=Date.now();
    if(!force&&lastSuccess[code]&&now-lastSuccess[code]<60000)return;
    if(!force&&lastAttempt[code]&&now-lastAttempt[code]<3000)return;
    lastAttempt[code]=now;
    pendingEan=code;pendingAt=now;
    if(!hasNative()){badge('BAZA: BŁĄD · brak transportu','err','Brak BricoUpload.uploadJsonAuth');return}
    badge('BAZA: SZUKAM','warn','Szukam '+code+'…');
    try{
      var payload={type:'PRODUCT_LOOKUP',shop:SHOP,ean:code,requestId:now};
      var dev=devicePayload();
      Object.keys(dev).forEach(function(k){payload[k]=dev[k]});
      window.BricoUpload.uploadJsonAuth(LOOKUP_URL,JSON.stringify(payload));
    }catch(err){
      badge('BAZA: BŁĄD · JS','err',err&&err.message?err.message:String(err));
    }
  }

  function scanRowsForLookup(){
    rowScanTimer=null;
    var rows=[].slice.call(document.querySelectorAll('#scanList .item'));
    rows.forEach(function(row){
      var saved=ean(row.getAttribute('data-brico-ean-v40')||'');
      var codeEl=row.querySelector('.code');
      var fromText=ean(codeEl&&codeEl.textContent);
      var code=/^(\d{8}|\d{13})$/.test(saved)?saved:(/^(\d{8}|\d{13})$/.test(fromText)?fromText:'');
      if(code)lookup(code,false);
    });
  }
  function scheduleRowScan(){
    if(rowScanTimer)return;
    rowScanTimer=setTimeout(scanRowsForLookup,120);
  }

  var previousBarcode=window.onNativeBarcode;
  window.onNativeBarcode=function(payload){
    if(typeof previousBarcode==='function')previousBarcode(payload);
    var x=payload;
    if(typeof x==='string'){try{x=JSON.parse(x)}catch(e){x={code:x}}}
    var code=ean(x&&x.code?x.code:'');
    if(code)setTimeout(function(){lookup(code,true)},0);
    scheduleRowScan();
  };

  var previousResult=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){
    if(typeof previousResult==='function'){
      try{previousResult(result)}catch(e){}
    }
    try{
      var server=result&&result.server?result.server:null;
      if(server&&server.kind==='PRODUCT_META')return;

      if(server&&server.kind==='PRODUCT_LOOKUP'){
        var code=ean(server.ean||pendingEan||'');
        if(!result.ok||!server.ok){showDbError(result,server);return}
        if(!server.found||!server.product){renderMissing(code);return}
        cacheProduct(server.product,code);
        renderFound(code,server.product);
        return;
      }

      // Auth/backend failures can be returned before the endpoint adds kind/ean.
      // If they happen directly after a product request, expose the real error.
      if(pendingEan&&Date.now()-pendingAt<12000&&result&&result.ok===false){
        showDbError(result,server);
      }
    }catch(e){
      badge('BAZA: BŁĄD · UI','err',e&&e.message?e.message:String(e));
    }
  };

  function boot(){
    var list=document.getElementById('scanList');
    if(list&&'MutationObserver' in window){
      new MutationObserver(scheduleRowScan).observe(list,{childList:true,subtree:true,characterData:true});
    }
    scheduleRowScan();
    setTimeout(scheduleRowScan,500);
    setTimeout(scheduleRowScan,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
