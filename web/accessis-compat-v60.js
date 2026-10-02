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
      #exportPanel{position:relative!important;z-index:5!important;overflow:visible!important}\
      #bricoUploadStatus.bricoAccountButton{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;min-height:30px!important;width:auto!important;margin-top:6px!important;padding:6px 10px!important;border:1px solid rgba(54,210,127,.38)!important;border-radius:9px!important;background:rgba(54,210,127,.09)!important;color:#36d27f!important;font-size:10px!important;font-weight:900!important;line-height:1.15!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:20!important;-webkit-tap-highlight-color:rgba(54,210,127,.16)!important}\
      #bricoUploadStatus.bricoAccountButton:after{content:"▾";font-size:8px;opacity:.82}\
      #bricoUploadStatus.bricoAccountButton[aria-expanded="true"]:after{content:"▴"}\
      #bricoAccountLogoutMenu{display:none;margin-top:5px;position:relative;z-index:21;pointer-events:auto}\
      #bricoAccountLogoutMenu.show{display:block}\
      #bricoAccountLogoutBtn{width:100%;min-height:36px;border:1px solid rgba(255,105,105,.38);border-radius:9px;background:rgba(255,105,105,.09);color:#ff6969;font-size:10px;font-weight:950;pointer-events:auto;touch-action:manipulation}\
    ';
    document.head.appendChild(style);
  }

  function ensureRealButton(status){
    if(!status)return null;
    if(status.tagName==='BUTTON')return status;
    var btn=document.createElement('button');
    btn.type='button';
    btn.id='bricoUploadStatus';
    btn.className=status.className||'';
    btn.textContent=status.textContent||'';
    btn.setAttribute('aria-expanded','false');
    status.replaceWith(btn);
    return btn;
  }

  function ensureAccountMenu(status){
    if(!status)return;
    ensureAccountStyle();
    status=ensureRealButton(status);
    if(!status)return;
    status.classList.add('bricoAccountButton');
    status.setAttribute('aria-expanded',status.getAttribute('aria-expanded')||'false');

    var menu=document.getElementById('bricoAccountLogoutMenu');
    if(!menu){
      menu=document.createElement('div');
      menu.id='bricoAccountLogoutMenu';
      menu.innerHTML='<button type="button" id="bricoAccountLogoutBtn">WYLOGUJ</button>';
      status.insertAdjacentElement('afterend',menu);
    }
  }

  function toggleAccount(){
    var status=document.getElementById('bricoUploadStatus');
    var menu=document.getElementById('bricoAccountLogoutMenu');
    var a=auth();
    if(!status||!menu||!(a.verified&&a.loggedIn))return;
    var open=!menu.classList.contains('show');
    menu.classList.toggle('show',open);
    status.setAttribute('aria-expanded',open?'true':'false');
  }

  function doLogout(){
    var btn=document.getElementById('bricoAccountLogoutBtn');
    if(!window.BricoAuth||typeof window.BricoAuth.logout!=='function'){
      if(btn)btn.textContent='BRAK MODUŁU WYLOGOWANIA';
      return;
    }
    if(btn){btn.disabled=true;btn.textContent='WYLOGOWUJĘ…'}
    try{window.BricoAuth.logout()}catch(err){
      if(btn){btn.disabled=false;btn.textContent='WYLOGUJ'}
    }
  }

  function hideLegacySettings(){
    seed();
    pullNativeAuth();
    var box=document.getElementById('bricoUploadSettingsBox');
    if(box&&box.style.display!=='none')box.style.setProperty('display','none','important');
    var status=document.getElementById('bricoUploadStatus');
    if(status){
      ensureAccountMenu(status);
      status=document.getElementById('bricoUploadStatus');
      var next=label();
      if(status&&status.textContent!==next)status.textContent=next;
      var connected=!!(auth().verified&&auth().loggedIn);
      var menu=document.getElementById('bricoAccountLogoutMenu');
      if(menu&&!connected){menu.classList.remove('show');if(status)status.setAttribute('aria-expanded','false')}
    }
    var serverBtn=document.getElementById('serverConfigBtn');
    if(serverBtn&&serverBtn.style.display!=='none')serverBtn.style.display='none';
  }

  function boot(){
    seed();
    pullNativeAuth();
    hideLegacySettings();

    document.addEventListener('click',function(e){
      var target=e.target&&e.target.closest?e.target.closest('#bricoUploadStatus,#bricoAccountLogoutBtn'):null;
      if(!target)return;
      e.preventDefault();
      e.stopPropagation();
      if(target.id==='bricoAccountLogoutBtn')doLogout();
      else toggleAccount();
    },true);

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
