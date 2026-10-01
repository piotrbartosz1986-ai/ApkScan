(function(){
  'use strict';

  var auth={mode:'legacy',verified:false,loggedIn:false,permission:'none',user:null};
  window.BricoScannerAuth=auth;

  function hasBridge(){return !!(window.BricoAuth&&typeof window.BricoAuth.getState==='function')}
  function parse(v){try{return typeof v==='string'?JSON.parse(v):v||{}}catch(e){return {}}}
  function stopScanner(){try{if(window.NativeScanner&&typeof window.NativeScanner.stopScanner==='function')window.NativeScanner.stopScanner()}catch(e){}}
  function startScanner(){try{if(window.NativeScanner&&typeof window.NativeScanner.startScanner==='function')window.NativeScanner.startScanner()}catch(e){}}
  function dispatch(){try{window.dispatchEvent(new CustomEvent('brico-auth-change',{detail:{mode:auth.mode,verified:auth.verified,loggedIn:auth.loggedIn,permission:auth.permission,user:auth.user}}))}catch(e){}}

  function installStyles(){
    if(document.getElementById('bricoAuthStyle'))return;
    var s=document.createElement('style');s.id='bricoAuthStyle';s.textContent=''
      +'.bricoAuthOverlay{position:fixed;inset:0;z-index:2147483600;background:#0b0d10;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;color:#f5f7fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}'
      +'.bricoAuthCard{width:min(430px,100%);border:1px solid #29313a;background:#11161b;border-radius:18px;padding:20px;box-sizing:border-box;box-shadow:0 24px 80px rgba(0,0,0,.45)}'
      +'.bricoAuthBrand{font-size:11px;font-weight:950;letter-spacing:.12em;color:#36d27f;text-transform:uppercase;margin-bottom:6px}'
      +'.bricoAuthTitle{font-size:24px;font-weight:950;line-height:1.05;margin:0 0 7px}'
      +'.bricoAuthText{font-size:12px;line-height:1.45;color:#aab4bf;margin:0 0 16px}'
      +'.bricoAuthField{display:grid;gap:5px;margin-top:10px}.bricoAuthField span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#8e9aa6;font-weight:900}'
      +'.bricoAuthField input{width:100%;height:44px;box-sizing:border-box;border-radius:10px;border:1px solid #303943;background:#0b0f13;color:#fff;padding:0 12px;font-size:15px;outline:none}.bricoAuthField input:focus{border-color:#36d27f}'
      +'.bricoAuthBtn{width:100%;height:46px;border:0;border-radius:10px;margin-top:14px;background:#1e7d47;color:#fff;font-weight:950;font-size:13px}.bricoAuthBtn:disabled{opacity:.55}'
      +'.bricoAuthAlt{width:100%;height:40px;border:1px solid #303943;border-radius:10px;margin-top:8px;background:#151b21;color:#dbe1e7;font-weight:850}'
      +'.bricoAuthMsg{min-height:18px;margin-top:10px;font-size:11px;color:#ff8585;line-height:1.35}'
      +'.bricoAuthSpinner{display:inline-block;width:13px;height:13px;border:2px solid #3b454f;border-top-color:#36d27f;border-radius:50%;animation:bricoSpin .8s linear infinite;vertical-align:-2px;margin-right:7px}@keyframes bricoSpin{to{transform:rotate(360deg)}}'
      +'.bricoAuthBadge{position:fixed;z-index:2147483500;right:7px;top:7px;max-width:58vw;height:28px;display:none;align-items:center;gap:6px;border:1px solid #2e3943;border-radius:999px;background:rgba(11,13,16,.92);color:#eef2f6;padding:0 8px;font:800 9px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;backdrop-filter:blur(8px)}'
      +'.bricoAuthBadge b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bricoAuthBadge em{font-style:normal;color:#36d27f;font-size:8px}.bricoAuthBadge button{border:0;background:transparent;color:#9aa5b1;font-size:9px;font-weight:900;padding:3px;cursor:pointer}'
      +'@media(max-width:380px){.bricoAuthCard{padding:16px}.bricoAuthTitle{font-size:21px}}';
    document.head.appendChild(s);
  }

  function installUi(){
    installStyles();
    if(!document.getElementById('bricoAuthOverlay')){
      var o=document.createElement('div');o.id='bricoAuthOverlay';o.className='bricoAuthOverlay';o.innerHTML=''
        +'<div class="bricoAuthCard">'
        +'<div class="bricoAuthBrand">BricoLab · Skaner</div>'
        +'<h1 class="bricoAuthTitle" id="bricoAuthTitle">Logowanie</h1>'
        +'<p class="bricoAuthText" id="bricoAuthText">Użyj tego samego konta co w BricoLab.</p>'
        +'<div id="bricoAuthFields">'
        +'<label class="bricoAuthField"><span>Login</span><input id="bricoAuthLogin" autocomplete="username" autocapitalize="none" spellcheck="false"></label>'
        +'<label class="bricoAuthField"><span>Hasło</span><input id="bricoAuthPassword" type="password" autocomplete="current-password"></label>'
        +'</div>'
        +'<button class="bricoAuthBtn" id="bricoAuthSubmit" type="button">ZALOGUJ</button>'
        +'<button class="bricoAuthAlt" id="bricoAuthRetry" type="button" style="display:none">SPRÓBUJ PONOWNIE</button>'
        +'<button class="bricoAuthAlt" id="bricoAuthClear" type="button" style="display:none">WYLOGUJ / ZMIEŃ KONTO</button>'
        +'<div class="bricoAuthMsg" id="bricoAuthMsg"></div>'
        +'</div>';
      document.body.appendChild(o);
      document.getElementById('bricoAuthSubmit').onclick=login;
      document.getElementById('bricoAuthRetry').onclick=verify;
      document.getElementById('bricoAuthClear').onclick=logout;
      document.getElementById('bricoAuthPassword').addEventListener('keydown',function(e){if(e.key==='Enter')login()});
    }
    if(!document.getElementById('bricoAuthBadge')){
      var b=document.createElement('div');b.id='bricoAuthBadge';b.className='bricoAuthBadge';b.innerHTML='<b id="bricoAuthBadgeUser">BricoLab</b><em id="bricoAuthBadgeLevel"></em><button id="bricoAuthBadgeLogout" type="button">WYLOGUJ</button>';
      document.body.appendChild(b);document.getElementById('bricoAuthBadgeLogout').onclick=logout;
    }
  }

  function el(id){return document.getElementById(id)}
  function busy(title,text){
    installUi();el('bricoAuthOverlay').style.display='flex';el('bricoAuthTitle').textContent=title||'Sprawdzam konto';
    el('bricoAuthText').innerHTML='<span class="bricoAuthSpinner"></span>'+(text||'Łączenie z BricoLab…');
    el('bricoAuthFields').style.display='none';el('bricoAuthSubmit').style.display='none';el('bricoAuthRetry').style.display='none';el('bricoAuthClear').style.display='none';el('bricoAuthMsg').textContent='';
  }
  function loginScreen(message){
    installUi();stopScanner();auth.verified=false;auth.loggedIn=false;auth.permission='none';dispatch();
    el('bricoAuthOverlay').style.display='flex';el('bricoAuthTitle').textContent='Zaloguj się do BricoLab';el('bricoAuthText').textContent='To samo konto i hasło co na stronie BricoLab.';
    el('bricoAuthFields').style.display='block';el('bricoAuthSubmit').style.display='block';el('bricoAuthRetry').style.display='none';el('bricoAuthClear').style.display=auth.user?'block':'none';el('bricoAuthMsg').textContent=message||'';el('bricoAuthBadge').style.display='none';
    setTimeout(function(){try{el('bricoAuthLogin').focus()}catch(e){}},80);
  }
  function errorScreen(message,canRetry){
    installUi();stopScanner();auth.verified=false;auth.loggedIn=false;dispatch();
    el('bricoAuthOverlay').style.display='flex';el('bricoAuthTitle').textContent='BricoLab — brak dostępu';el('bricoAuthText').textContent='Skaner pozostaje zablokowany do poprawnego sprawdzenia konta.';
    el('bricoAuthFields').style.display='none';el('bricoAuthSubmit').style.display='none';el('bricoAuthRetry').style.display=canRetry?'block':'none';el('bricoAuthClear').style.display='block';el('bricoAuthMsg').textContent=message||'Nie udało się sprawdzić konta.';el('bricoAuthBadge').style.display='none';
  }
  function ready(state){
    applyState(state);if(!auth.loggedIn){loginScreen();return}
    el('bricoAuthOverlay').style.display='none';
    var badge=el('bricoAuthBadge');badge.style.display='flex';
    var name=(auth.user&&(auth.user.name||auth.user.login))||'BricoLab';el('bricoAuthBadgeUser').textContent=name;el('bricoAuthBadgeLevel').textContent=auth.permission==='edit'?'EDYCJA':'PODGLĄD';
    dispatch();startScanner();
  }
  function applyState(state){
    state=state||{};auth.mode='bricolab';auth.verified=!!state.verified;auth.loggedIn=!!state.loggedIn;auth.permission=String(state.permission||'none');auth.user=state.user||auth.user||null;
  }
  function friendly(error){
    error=String(error||'auth_error');
    if(error==='invalid_credentials')return 'Nieprawidłowy login lub hasło.';
    if(error==='account_inactive')return 'To konto jest wyłączone w ACCESSIS.';
    if(error==='password_change_required')return 'Najpierw zmień hasło pierwszego logowania w BricoLab.';
    if(error==='store_forbidden')return 'To konto nie ma dostępu do sklepu Oborniki.';
    if(error==='scanner_forbidden')return 'To konto nie ma dostępu do modułu Skaner.';
    if(error==='no_saved_session'||error==='invalid_refresh_token')return 'Sesja wygasła. Zaloguj się ponownie.';
    if(error==='credentials_changed')return 'Hasło zostało zmienione. Zaloguj się ponownie.';
    if(error.indexOf('network_error')===0)return 'Brak połączenia z BricoLab. Sprawdź internet i spróbuj ponownie.';
    return 'Błąd logowania: '+error;
  }

  function login(){
    if(!hasBridge())return;
    var login=(el('bricoAuthLogin').value||'').trim(),password=el('bricoAuthPassword').value||'';
    if(!login||!password){el('bricoAuthMsg').textContent='Wpisz login i hasło.';return}
    busy('Logowanie','Sprawdzam konto i uprawnienia…');
    try{window.BricoAuth.login(login,password)}catch(e){loginScreen('Nie udało się uruchomić logowania: '+e.message)}
  }
  function verify(){
    if(!hasBridge())return;
    busy('Sprawdzam sesję','Weryfikuję konto i uprawnienia Skanera…');
    try{window.BricoAuth.verify()}catch(e){errorScreen('Nie udało się sprawdzić sesji.',true)}
  }
  function logout(){
    stopScanner();if(!hasBridge()){loginScreen();return}busy('Wylogowanie','Kończę sesję na tym urządzeniu…');
    try{window.BricoAuth.logout()}catch(e){loginScreen()}
  }

  window.onBricoAuthResult=function(result){
    result=result||{};var state=result.state||{};applyState(state);
    if(result.ok){
      if(result.action==='logout'){auth.user=null;loginScreen();return}
      if(state.verified&&state.loggedIn){ready(state);return}
      loginScreen();return;
    }
    var msg=friendly(result.error);
    if(result.error==='no_saved_session'||result.error==='invalid_refresh_token'||result.error==='invalid_credentials'||result.error==='credentials_changed')loginScreen(msg);
    else errorScreen(msg,String(result.error||'').indexOf('network_error')===0);
  };

  function boot(){
    if(!hasBridge()){
      auth.mode='legacy';auth.verified=true;auth.loggedIn=true;auth.permission='edit';dispatch();return;
    }
    auth.mode='bricolab';installUi();stopScanner();
    var state=parse(window.BricoAuth.getState());applyState(state);
    if(state.savedSession)verify();else loginScreen();
    setInterval(function(){if(auth.mode==='bricolab'&&auth.loggedIn&&document.visibilityState!=='hidden')try{window.BricoAuth.verify()}catch(e){}},60000);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&auth.mode==='bricolab'&&auth.loggedIn)try{window.BricoAuth.verify()}catch(e){}});
  }

  var tries=0;(function waitBridge(){
    if(hasBridge()){boot();return}
    if(++tries<20){setTimeout(waitBridge,100);return}
    boot();
  })();
})();
