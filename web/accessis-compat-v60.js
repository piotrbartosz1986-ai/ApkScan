(function(){
  'use strict';

  var TOKEN_KEY='brico.upload.token';
  var ENDPOINT_KEY='brico.upload.endpoint';
  var lastNativeState='';

  function seed(){
    try{
      if(localStorage.getItem(TOKEN_KEY)!=='BRICOLAB_SESSION_AUTH')localStorage.setItem(TOKEN_KEY,'BRICOLAB_SESSION_AUTH');
      if(localStorage.getItem(ENDPOINT_KEY)!=='https://bricolab.pl/BricoLab/api/scanner_upload_v5.php')localStorage.setItem(ENDPOINT_KEY,'https://bricolab.pl/BricoLab/api/scanner_upload_v5.php');
    }catch(e){}
  }

  function pullNativeAuth(){
    try{
      if(!window.BricoAuth||typeof window.BricoAuth.getState!=='function')return;
      var raw=window.BricoAuth.getState();
      var state=typeof raw==='string'?JSON.parse(raw):raw;
      if(!state||typeof state!=='object')return;
      window.BricoScannerAuth=state;
      var encoded=JSON.stringify(state);
      if(encoded!==lastNativeState){
        lastNativeState=encoded;
        window.dispatchEvent(new CustomEvent('brico-auth-change',{detail:state}));
      }
    }catch(e){}
  }

  function auth(){return window.BricoScannerAuth||{verified:false,loggedIn:false,permission:'none',user:null}}
  function label(){
    var a=auth();
    if(a.verified&&a.loggedIn){
      var who=(a.user&&(a.user.login||a.user.name||a.user.displayName))||'BricoLab';
      return 'Połączono jako '+who+' • '+(a.permission==='edit'?'EDYCJA':'PODGLĄD');
    }
    return 'Połączenie przez konto BricoLab / Accessis';
  }

  function ensureAccountStyle(){
    if(document.getElementById('bricoAccountLogoutStyle'))return;
    var style=document.createElement('style');
    style.id='bricoAccountLogoutStyle';
    style.textContent='\
      #bricoUploadStatus.bricoAccountButton{display:inline-flex!important;align-items:center;gap:5px;min-height:28px;padding:5px 9px;border:1px solid rgba(54,210,127,.35);border-radius:9px;background:rgba(54,210,127,.08);font-size:9.5px!important;font-weight:900!important;line-height:1.15;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}\
      #bricoUploadStatus.bricoAccountButton:after{content:"▾";font-size:8px;opacity:.8}\
      #bricoAccountLogoutMenu{display:none;margin-top:5px}\
      #bricoAccountLogoutMenu.show{display:block}\
      #bricoAccountLogoutBtn{width:100%;min-height:34px;border:1px solid rgba(255,105,105,.35);border-radius:9px;background:rgba(255,105,105,.08);color:#ff6969;font-size:9.5px;font-weight:950}\
    ';
    document.head.appendChild(style);
  }

  function ensureAccountMenu(status){
    if(!status)return;
    ensureAccountStyle();
    status.classList.add('bricoAccountButton');
    status.setAttribute('role','button');
    status.setAttribute('tabindex','0');
    status.setAttribute('aria-expanded','false');

    var menu=document.getElementById('bricoAccountLogoutMenu');
    if(!menu){
      menu=document.createElement('div');
      menu.id='bricoAccountLogoutMenu';
      menu.innerHTML='<button type="button" id="bricoAccountLogoutBtn">WYLOGUJ</button>';
      status.insertAdjacentElement('afterend',menu);
      var logoutBtn=document.getElementById('bricoAccountLogoutBtn');
      logoutBtn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        if(!window.BricoAuth||typeof window.BricoAuth.logout!=='function'){
          logoutBtn.textContent='BRAK MODUŁU WYLOGOWANIA';
          return;
        }
        logoutBtn.disabled=true;
        logoutBtn.textContent='WYLOGOWUJĘ…';
        try{window.BricoAuth.logout()}catch(err){
          logoutBtn.disabled=false;
          logoutBtn.textContent='WYLOGUJ';
        }
      });
    }

    if(status.getAttribute('data-brico-account-bound')!=='1'){
      status.setAttribute('data-brico-account-bound','1');
      var toggle=function(e){
        e.preventDefault();
        var a=auth();
        if(!(a.verified&&a.loggedIn))return;
        var open=!menu.classList.contains('show');
        menu.classList.toggle('show',open);
        status.setAttribute('aria-expanded',open?'true':'false');
      };
      status.addEventListener('click',toggle);
      status.addEventListener('keydown',function(e){
        if(e.key==='Enter'||e.key===' '){toggle(e)}
      });
    }
  }

  function hideLegacySettings(){
    seed();
    pullNativeAuth();
    var box=document.getElementById('bricoUploadSettingsBox');
    if(box&&box.style.display!=='none')box.style.setProperty('display','none','important');
    var status=document.getElementById('bricoUploadStatus');
    if(status){
      var next=label();
      if(status.textContent!==next)status.textContent=next;
      var connected=!!(auth().verified&&auth().loggedIn);
      var color=connected?'#36d27f':'#9aa5b1';
      if(status.style.color!==color)status.style.color=color;
      ensureAccountMenu(status);
      var menu=document.getElementById('bricoAccountLogoutMenu');
      if(menu&&!connected){menu.classList.remove('show');status.setAttribute('aria-expanded','false')}
    }
    var serverBtn=document.getElementById('serverConfigBtn');
    if(serverBtn&&serverBtn.style.display!=='none')serverBtn.style.display='none';
  }

  function boot(){
    seed();
    pullNativeAuth();
    hideLegacySettings();
    if('MutationObserver' in window){
      var queued=false;
      new MutationObserver(function(){
        if(queued)return;
        queued=true;
        setTimeout(function(){queued=false;hideLegacySettings()},0);
      }).observe(document.documentElement,{childList:true,subtree:true});
    }
    window.addEventListener('brico-auth-change',hideLegacySettings);
    setInterval(function(){pullNativeAuth();hideLegacySettings()},1000);
    setTimeout(hideLegacySettings,100);
    setTimeout(hideLegacySettings,600);
    setTimeout(hideLegacySettings,1600);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
