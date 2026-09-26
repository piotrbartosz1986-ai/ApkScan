(function(){
  'use strict';

  var MIGRATION_KEY='brico.nativeFormats.code128Migration.v1';
  var STATUS_ID='bricoNativeFormatsStatusV45';

  function bridge(){return window.NativeScanner||null}
  function parse(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)}catch(e){return{}}}
  function nativeConfig(){
    var b=bridge();
    if(!b||typeof b.getConfig!=='function')return{};
    try{return parse(b.getConfig())}catch(e){return{}}
  }
  function apply(cfg){
    var b=bridge();
    if(!b||typeof b.applyConfig!=='function')return false;
    try{b.applyConfig(JSON.stringify(cfg));return true}catch(e){return false}
  }
  function formatsOf(cfg){return Array.isArray(cfg&&cfg.formats)?cfg.formats.slice():[]}
  function sameFormats(a,b){
    a=(a||[]).slice().sort();b=(b||[]).slice().sort();
    return a.length===b.length&&a.every(function(v,i){return v===b[i]});
  }
  function checkedFormats(){
    var out=[];
    document.querySelectorAll('[data-format]:checked').forEach(function(el){
      var f=el.getAttribute('data-format');if(f&&out.indexOf(f)<0)out.push(f);
    });
    return out;
  }
  function ensureStatus(){
    var tech=document.getElementById('techInfo');
    if(!tech)return null;
    var el=document.getElementById(STATUS_ID);
    if(!el){
      el=document.createElement('div');
      el.id=STATUS_ID;
      el.style.cssText='margin-top:7px;padding-top:7px;border-top:1px solid var(--line);font-size:9px;font-weight:850;line-height:1.45;word-break:break-word';
      tech.parentNode.appendChild(el);
    }
    return el;
  }
  function showStatus(prefix){
    var el=ensureStatus();if(!el)return;
    var cfg=nativeConfig();
    var list=formatsOf(cfg);
    var code128=list.indexOf('CODE_128')>=0;
    var af=cfg.autoFocus!==false;
    var focusMs=Number(cfg.focusIntervalMs)||1800;
    el.style.color=code128?'var(--green)':'var(--red)';
    el.textContent=(prefix?prefix+' • ':'')+'DO LISTY: '+(list.length?list.join(', '):'BRAK')+(code128?'':' • CODE_128 WYŁĄCZONY')+'\nAUTOFOCUS NATYWNIE: '+(af?'ON':'OFF')+' • co '+focusMs+' ms';
    el.style.whiteSpace='pre-line';
  }
  function migrateCode128Once(){
    if(localStorage.getItem(MIGRATION_KEY)==='1'){showStatus();return}
    var cfg=nativeConfig();
    var list=formatsOf(cfg);
    if(!list.length){showStatus();return}
    if(list.indexOf('CODE_128')<0){
      list.push('CODE_128');
      cfg.formats=list;
      cfg.version=Math.max(10,Number(cfg.version)||0);
      if(!apply(cfg)){showStatus('BŁĄD ZAPISU');return}
      setTimeout(function(){
        var after=formatsOf(nativeConfig());
        if(after.indexOf('CODE_128')>=0){
          localStorage.setItem(MIGRATION_KEY,'1');
          showStatus('MIGRACJA CODE_128 OK');
        }else{
          showStatus('APK NIE PRZYJĘŁO CODE_128');
        }
      },300);
    }else{
      localStorage.setItem(MIGRATION_KEY,'1');
      showStatus();
    }
  }
  function verifySavedFormats(){
    var wanted=checkedFormats();
    if(!wanted.length){showStatus();return}

    // Tylko weryfikacja. Nie zapisujemy tutaj ponownie całego configu.
    // Poprzednia wersja mogła w wyścigu po kliknięciu ZAPISZ pobrać starszy
    // config i zapisać go ponownie, cofając m.in. focusIntervalMs/autofocus.
    var active=formatsOf(nativeConfig());
    showStatus(sameFormats(wanted,active)?'USTAWIENIA ZAPISANE':'FORMATY NIEZGODNE');
  }
  function boot(){
    ensureStatus();
    setTimeout(migrateCode128Once,250);
    document.addEventListener('click',function(e){
      var id=e.target&&e.target.id;
      if(id==='settingsBtn')setTimeout(showStatus,80);
      if(id==='saveSettingsBtn')setTimeout(verifySavedFormats,700);
    },false);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
