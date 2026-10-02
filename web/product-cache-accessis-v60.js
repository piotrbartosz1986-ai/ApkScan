(function(){
  'use strict';
  var DB_NAME='BricoScannerProductsV1';
  var DB_VERSION=1;
  var PRODUCT_STORE='products';

  function clean(v){return String(v==null?'':v).replace(/\D/g,'')}
  function openDb(){
    return new Promise(function(resolve){
      try{
        var req=indexedDB.open(DB_NAME,DB_VERSION);
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
  async function cacheProduct(p,ean){
    if(!p)return;
    ean=clean((p&&p.ean)||ean);
    if(!ean)return;
    var copy={};
    Object.keys(p).forEach(function(k){copy[k]=p[k]});
    copy.ean=ean;
    var db=await openDb();if(!db)return;
    try{
      await new Promise(function(resolve){
        var tx=db.transaction(PRODUCT_STORE,'readwrite');
        tx.objectStore(PRODUCT_STORE).put(copy);
        tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;
      });
    }catch(e){}
  }
  function updateConverterName(p,ean){
    if(!p)return;
    var code=document.getElementById('bricoConvCodeV48');
    var name=document.getElementById('bricoConvNameV48');
    if(!code||!name)return;
    var current=clean(code.textContent||'');
    if(current&&current===clean(ean)&&String(p.name||'').trim())name.textContent=String(p.name).trim();
  }

  var previous=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){
    if(typeof previous==='function')previous(result);
    try{
      var server=result&&result.server?result.server:null;
      if(!server||server.kind!=='PRODUCT_LOOKUP'||!result.ok||!server.ok||!server.found||!server.product)return;
      var ean=clean(server.ean||server.product.ean||'');
      cacheProduct(server.product,ean);
      updateConverterName(server.product,ean);
    }catch(e){}
  };
})();
