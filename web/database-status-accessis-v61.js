(function(){
  'use strict';

  var BADGE_ID='bricoDbBadgeV40';
  var DEBUG_ID='bricoDbDebugV63';

  function auth(){return window.BricoScannerAuth||{verified:false,loggedIn:false,permission:'none'}}
  function canView(){var a=auth();return !!(a.verified&&a.loggedIn&&(a.permission==='view'||a.permission==='edit'))}

  function badge(){return document.getElementById(BADGE_ID)}
  function set(text,kind,title){
    var el=badge();if(!el)return;
    el.textContent=text;
    el.className=kind||'';
    el.title=title||'';
  }

  function ensureDebug(){
    var existing=document.getElementById(DEBUG_ID);if(existing)return existing;
    var head=document.querySelector('.listHead');if(!head||!head.parentNode)return null;
    var div=document.createElement('div');
    div.id=DEBUG_ID;
    div.style.cssText='display:none;margin:4px 0 7px;padding:6px 8px;border:1px solid #8a3a3a;border-radius:8px;background:rgba(255,105,105,.08);color:#b42318;font-size:10px;font-weight:850;line-height:1.35;word-break:break-word';
    head.insertAdjacentElement('afterend',div);
    return div;
  }

  function debugHide(){var el=ensureDebug();if(el){el.style.display='none';el.textContent=''}}
  function debugShow(kind,result,server){
    var el=ensureDebug();if(!el)return;
    var http=(result&&result.httpCode)!=null?String(result.httpCode):'?';
    var err=(server&&server.error)||(result&&result.error)||(result&&result.body)||'brak szczegółów';
    err=String(err).replace(/\s+/g,' ').trim();
    if(err.length>220)err=err.slice(0,220)+'…';
    el.textContent='DB '+kind+' · HTTP '+http+' · '+err;
    el.style.display='block';
  }

  function normalizeLegacyStatus(){
    var el=badge();if(!el||!canView())return;
    var t=String(el.textContent||'');
    if(/BAZA:\s*(SPRAWDZAM|STATUS \?|BRAK KLUCZA|START)/i.test(t)){
      set('BAZA: GOTOWA','ok','Baza dostępna przez zalogowane konto BricoLab / Accessis.');
    }
  }

  var previousResult=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){
    if(typeof previousResult==='function'){
      try{previousResult(result)}catch(e){}
    }
    try{
      var server=result&&result.server?result.server:null;
      var kind=server&&server.kind?String(server.kind):'';

      if(kind==='PRODUCT_META'){
        if(result&&result.ok&&server&&server.ok){
          debugHide();
          set('BAZA: GOTOWA','ok','Metadane bazy odczytane przez Accessis.');
        }else{
          debugShow('META',result,server);
          var metaErr=(server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'));
          set('BAZA: BŁĄD','err',String(metaErr));
        }
      }

      if(kind==='PRODUCT_LOOKUP'){
        if(result&&result.ok&&server&&server.ok){
          debugHide();
          set('BAZA: ONLINE','ok','Połączenie z bazą działa przez konto BricoLab / Accessis.');
        }else{
          debugShow('LOOKUP',result,server);
          var lookupErr=(server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'));
          set('BAZA: BŁĄD','err',String(lookupErr));
        }
      }

      if(!server && result && result.ok===false){
        debugShow('TRANSPORT',result,null);
        set('BAZA: BŁĄD','err',String(result.error||result.body||('HTTP '+(result.httpCode||'?'))));
      }
    }catch(e){
      debugShow('UI',{httpCode:'?',error:e&&e.message?e.message:String(e)},null);
    }
    setTimeout(normalizeLegacyStatus,0);
  };

  function boot(){
    ensureDebug();
    normalizeLegacyStatus();
    window.addEventListener('brico-auth-change',function(){setTimeout(normalizeLegacyStatus,0)});
    if('MutationObserver' in window){
      new MutationObserver(function(){normalizeLegacyStatus();ensureDebug()}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    }
    setInterval(normalizeLegacyStatus,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
