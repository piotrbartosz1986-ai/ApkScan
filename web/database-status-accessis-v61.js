(function(){
  'use strict';

  var BADGE_ID='bricoDbBadgeV40';

  function auth(){return window.BricoScannerAuth||{verified:false,loggedIn:false,permission:'none'}}
  function canView(){var a=auth();return !!(a.verified&&a.loggedIn&&(a.permission==='view'||a.permission==='edit'))}

  function badge(){return document.getElementById(BADGE_ID)}
  function set(text,kind,title){
    var el=badge();if(!el)return;
    el.textContent=text;
    el.className=kind||'';
    el.title=title||'';
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
      if(server&&server.kind==='PRODUCT_LOOKUP'){
        if(result&&result.ok&&server.ok){
          set('BAZA: ONLINE','ok','Połączenie z bazą działa przez konto BricoLab / Accessis.');
        }else{
          set('BAZA: BŁĄD','err',(server&&server.error)||(result&&result.error)||'Błąd połączenia z bazą.');
        }
      }
    }catch(e){}
    setTimeout(normalizeLegacyStatus,0);
  };

  function boot(){
    normalizeLegacyStatus();
    window.addEventListener('brico-auth-change',function(){setTimeout(normalizeLegacyStatus,0)});
    if('MutationObserver' in window){
      new MutationObserver(function(){normalizeLegacyStatus()}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    }
    setInterval(normalizeLegacyStatus,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
