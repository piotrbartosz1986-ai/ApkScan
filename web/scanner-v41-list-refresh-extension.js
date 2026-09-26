(function(){
  'use strict';

  var LOOKUP_URL='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_product_lookup.php';
  var TOKEN_KEY='brico.upload.token';
  var SHOP='08042';
  var queue=[];
  var queued=new Set();
  var requested=new Map();
  var running=false;
  var lastDbKey='';
  var observer=null;

  function clean(v){return String(v==null?'':v).trim()}
  function ean(v){return clean(v).replace(/\D/g,'')}
  function token(){try{return clean(localStorage.getItem(TOKEN_KEY)||'')}catch(e){return ''}}

  function dbKey(){
    var b=document.getElementById('bricoDbBadgeV40');
    if(!b)return '';
    var text=clean(b.textContent).toUpperCase();
    if(text.indexOf('SPRAWDZAM')>=0||text.indexOf('START')>=0||text.indexOf('STATUS ?')>=0)return '';
    if(text.indexOf('ONLINE')<0&&text.indexOf('NIEAKTUALNA')<0&&text.indexOf('OFFLINE')<0)return '';
    return text+'|'+clean(b.title||'');
  }

  function visibleEans(){
    var out=[];
    document.querySelectorAll('#scanList .item .code').forEach(function(el){
      var code=ean(el.textContent);
      if(/^(\d{8}|\d{13})$/.test(code)&&out.indexOf(code)<0)out.push(code);
    });
    return out;
  }

  function enqueue(code,key,force){
    if(!code||!key)return;
    var reqKey=code+'|'+key;
    if(!force&&requested.get(code)===key)return;
    if(queued.has(reqKey))return;
    queued.add(reqKey);
    queue.push({ean:code,key:key,reqKey:reqKey});
    pump();
  }

  function pump(){
    if(running||!queue.length)return;
    if(!(window.BricoUpload&&typeof window.BricoUpload.uploadJson==='function'))return;
    var t=token();if(!t)return;
    running=true;
    var item=queue.shift();
    queued.delete(item.reqKey);
    try{
      requested.set(item.ean,item.key);
      window.BricoUpload.uploadJson(LOOKUP_URL,t,JSON.stringify({
        type:'PRODUCT_LOOKUP',shop:SHOP,ean:item.ean,requestId:Date.now()
      }));
    }catch(e){}
    setTimeout(function(){running=false;pump()},140);
  }

  function refreshAll(force){
    var key=dbKey();
    if(!key)return;
    visibleEans().forEach(function(code){enqueue(code,key,!!force)});
  }

  function checkDatabase(){
    var key=dbKey();
    if(!key)return;
    if(key!==lastDbKey){
      lastDbKey=key;
      refreshAll(true);
    }else{
      refreshAll(false);
    }
  }

  function boot(){
    var badge=document.getElementById('bricoDbBadgeV40');
    var list=document.getElementById('scanList');
    if('MutationObserver' in window){
      observer=new MutationObserver(function(){setTimeout(checkDatabase,20)});
      if(badge)observer.observe(badge,{childList:true,subtree:true,characterData:true,attributes:true});
      if(list)observer.observe(list,{childList:true,subtree:true,characterData:true});
    }
    setInterval(checkDatabase,1200);
    setTimeout(checkDatabase,800);
    setTimeout(checkDatabase,1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
