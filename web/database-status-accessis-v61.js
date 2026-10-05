(function(){
  'use strict';

  var BADGE_ID='bricoDbBadgeV40';
  var DEBUG_ID='bricoDbDebugV63';
  var dbDate='';
  var dbTime='';

  function auth(){return window.BricoScannerAuth||{verified:false,loggedIn:false,permission:'none'}}
  function canView(){var a=auth();return !!(a.verified&&a.loggedIn&&(a.permission==='view'||a.permission==='edit'))}

  function badge(){return document.getElementById(BADGE_ID)}
  function ensureBadgeStyle(){
    if(document.getElementById('bricoDbOnlineStampStyleV61'))return;
    var s=document.createElement('style');
    s.id='bricoDbOnlineStampStyleV61';
    s.textContent='\
      #bricoDbBadgeV40.bricoDbStampedV61{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;line-height:1!important}\
      #bricoDbBadgeV40 .bricoDbMainV61{display:block;line-height:1!important}\
      #bricoDbBadgeV40 .bricoDbStampV61{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;line-height:1!important;font-weight:800!important;letter-spacing:0!important;opacity:.78}\
      #bricoDbBadgeV40 .bricoDbStampV61 span{display:block;white-space:nowrap}\
      #bricoDbBadgeV40 .bricoDbDateV61{font-size:2px!important;height:2px!important;line-height:2px!important}\
      #bricoDbBadgeV40 .bricoDbTimeV61{font-size:4px!important;height:4px!important;line-height:4px!important}\
    ';
    document.head.appendChild(s);
  }
  function set(text,kind,title){
    var el=badge();if(!el)return;
    el.textContent=text;
    el.className=kind||'';
    el.title=title||'';
    if(text==='BAZA: ONLINE'||text==='BAZA: GOTOWA')enhanceStatusBadge();
  }

  function parseDbStamp(info){
    info=info||{};
    var raw=String(info.reportDateRaw||info.reportDate||'').trim();
    if(!raw)return;
    var m=raw.match(/^(?:Data\s*:\s*)?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?/i);
    if(m){
      dbDate=String(m[1]).padStart(2,'0')+'.'+String(m[2]).padStart(2,'0')+'.'+m[3];
      dbTime=m[4]?String(m[4]).padStart(2,'0')+':'+String(m[5]).padStart(2,'0'):'';
      return;
    }
    m=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if(m){
      dbDate=m[3]+'.'+m[2]+'.'+m[1];
      dbTime=m[4]?m[4]+':'+m[5]:'';
    }
  }

  function enhanceStatusBadge(){
    var el=badge();if(!el)return;
    var plain=String(el.textContent||'').replace(/\s+/g,' ').trim();
    var mainText='';
    if(plain.indexOf('BAZA: ONLINE')===0)mainText='BAZA: ONLINE';
    else if(plain.indexOf('BAZA: GOTOWA')===0)mainText='BAZA: GOTOWA';
    else return;
    if(!dbDate&&!dbTime)return;
    if(el.querySelector('.bricoDbMainV61'))return;
    ensureBadgeStyle();
    el.classList.add('bricoDbStampedV61');
    el.textContent='';
    var main=document.createElement('span');
    main.className='bricoDbMainV61';
    main.textContent=mainText;
    el.appendChild(main);
    var stamp=document.createElement('span');
    stamp.className='bricoDbStampV61';
    if(dbDate){var d=document.createElement('span');d.className='bricoDbDateV61';d.textContent=dbDate;stamp.appendChild(d)}
    if(dbTime){var t=document.createElement('span');t.className='bricoDbTimeV61';t.textContent=dbTime;stamp.appendChild(t)}
    el.appendChild(stamp);
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
      return;
    }
    if(/BAZA:\s*(ONLINE|GOTOWA)/i.test(t))enhanceStatusBadge();
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
          parseDbStamp(server.database||server);
          debugHide();
          set('BAZA: GOTOWA','ok','Metadane bazy odczytane przez Accessis.');
        }else{
          debugShow('META',result,server);
          var metaErr=(server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'));
          set('BAZA: BŁĄD','err',String(metaErr));
        }
        return;
      }

      if(kind==='PRODUCT_LOOKUP'){
        if(result&&result.ok&&server&&server.ok){
          parseDbStamp(server.database||server);
          debugHide();
          set('BAZA: ONLINE','ok','Połączenie z bazą działa przez konto BricoLab / Accessis.');
        }else{
          debugShow('LOOKUP',result,server);
          var lookupErr=(server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'));
          set('BAZA: BŁĄD','err',String(lookupErr));
        }
        return;
      }

      if(!server && result && result.ok===false){
        debugShow('TRANSPORT',result,null);
        set('BAZA: BŁĄD','err',String(result.error||result.body||('HTTP '+(result.httpCode||'?'))));
      }
    }catch(e){
      debugShow('UI',{httpCode:'?',error:e&&e.message?e.message:String(e)},null);
    }
  };

  function boot(){
    ensureBadgeStyle();
    ensureDebug();
    normalizeLegacyStatus();

    // Status bazy jest teraz event-driven: żadnego pollingu co 500 ms.
    // Zmieniamy go wyłącznie po realnej odpowiedzi PRODUCT_META / PRODUCT_LOOKUP
    // albo po zmianie stanu logowania Accessis.
    window.addEventListener('brico-auth-change',function(){
      setTimeout(function(){ensureDebug();normalizeLegacyStatus()},0);
      setTimeout(function(){normalizeLegacyStatus()},250);
    });

    // Jednorazowe wyrównanie po złożeniu interfejsu WebView.
    setTimeout(function(){ensureDebug();normalizeLegacyStatus()},120);
    setTimeout(function(){normalizeLegacyStatus()},900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
