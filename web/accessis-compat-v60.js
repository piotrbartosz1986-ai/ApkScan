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
      return 'Połączono jako '+who+' • WYLOGUJ';
    }
    return 'Połączenie przez konto BricoLab / Accessis';
  }

  function ensureStyle(){
    if(document.getElementById('bricoAccountLogoutStyle'))return;
    var style=document.createElement('style');
    style.id='bricoAccountLogoutStyle';
    style.textContent='\
      #bricoAccountArea{display:block!important;width:100%!important;position:relative!important;z-index:80!important;margin:2px 0 8px!important;pointer-events:auto!important}\
      #bricoAccountButton{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;width:100%!important;min-height:38px!important;padding:8px 10px!important;border:1px solid rgba(54,210,127,.40)!important;border-radius:10px!important;background:rgba(54,210,127,.10)!important;color:#36d27f!important;font-size:10.5px!important;font-weight:900!important;line-height:1.15!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:81!important;-webkit-tap-highlight-color:rgba(54,210,127,.18)!important}\
      #bricoAccountArrow{font-size:8px!important;opacity:.82!important;pointer-events:none!important}\
      #bricoAccountLogoutMenu{display:none!important;margin-top:5px!important;padding:8px!important;position:relative!important;z-index:82!important;pointer-events:auto!important;border:1px solid rgba(255,105,105,.30)!important;border-radius:10px!important;background:rgba(255,105,105,.06)!important}\
      #bricoAccountLogoutMenu.show{display:block!important}\
      #bricoAccountLogoutQuestion{margin-bottom:7px!important;text-align:center!important;color:#ff6969!important;font-size:10.5px!important;font-weight:950!important}\
      #bricoAccountLogoutActions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important}\
      #bricoAccountLogoutYes,#bricoAccountLogoutNo{display:block!important;width:100%!important;min-height:38px!important;border-radius:9px!important;font-size:10.5px!important;font-weight:950!important;pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:83!important}\
      #bricoAccountLogoutYes{border:1px solid rgba(255,105,105,.45)!important;background:rgba(255,105,105,.12)!important;color:#ff6969!important}\
      #bricoAccountLogoutNo{border:1px solid var(--line)!important;background:var(--panel2)!important;color:var(--text)!important}\
    ';
    document.head.appendChild(style);
  }

  function ensureAccountUi(){
    ensureStyle();

    var wrap=document.querySelector('.wrap');
    var exportPanel=document.getElementById('exportPanel');
    if(!wrap||!exportPanel)return null;

    var area=document.getElementById('bricoAccountArea');
    if(!area){
      area=document.createElement('div');
      area.id='bricoAccountArea';
      area.innerHTML=''
        +'<button type="button" id="bricoAccountButton" aria-expanded="false">'
        +'<span id="bricoAccountLabel"></span><span id="bricoAccountArrow">▾</span>'
        +'</button>'
        +'<div id="bricoAccountLogoutMenu">'
        +'<div id="bricoAccountLogoutQuestion">Wylogować?</div>'
        +'<div id="bricoAccountLogoutActions">'
        +'<button type="button" id="bricoAccountLogoutYes">TAK</button>'
        +'<button type="button" id="bricoAccountLogoutNo">NIE</button>'
        +'</div></div>';
    }

    if(area.parentElement!==wrap || area.previousElementSibling!==exportPanel){
      exportPanel.insertAdjacentElement('afterend',area);
    }

    var accountBtn=document.getElementById('bricoAccountButton');
    var yesBtn=document.getElementById('bricoAccountLogoutYes');
    var noBtn=document.getElementById('bricoAccountLogoutNo');

    if(accountBtn&&!accountBtn.dataset.bricoBound){
      accountBtn.dataset.bricoBound='1';
      accountBtn.onclick=function(e){
        e.preventDefault();e.stopPropagation();
        toggleAccount();
      };
    }

    if(yesBtn&&!yesBtn.dataset.bricoBound){
      yesBtn.dataset.bricoBound='1';
      yesBtn.onclick=function(e){
        e.preventDefault();e.stopPropagation();
        doLogout();
      };
    }

    if(noBtn&&!noBtn.dataset.bricoBound){
      noBtn.dataset.bricoBound='1';
      noBtn.onclick=function(e){
        e.preventDefault();e.stopPropagation();
        closeAccount();
      };
    }

    var legacy=document.getElementById('bricoUploadStatus');
    if(legacy)legacy.style.setProperty('display','none','important');

    return area;
  }

  function toggleAccount(){
    var a=auth();
    if(!(a.verified&&a.loggedIn))return;
    var menu=document.getElementById('bricoAccountLogoutMenu');
    var btn=document.getElementById('bricoAccountButton');
    var arrow=document.getElementById('bricoAccountArrow');
    if(!menu||!btn)return;
    var open=!menu.classList.contains('show');
    menu.classList.toggle('show',open);
    btn.setAttribute('aria-expanded',open?'true':'false');
    if(arrow)arrow.textContent=open?'▴':'▾';
  }

  function closeAccount(){
    var menu=document.getElementById('bricoAccountLogoutMenu');
    var btn=document.getElementById('bricoAccountButton');
    var arrow=document.getElementById('bricoAccountArrow');
    if(menu)menu.classList.remove('show');
    if(btn)btn.setAttribute('aria-expanded','false');
    if(arrow)arrow.textContent='▾';
  }

  function doLogout(){
    var btn=document.getElementById('bricoAccountLogoutYes');
    if(!window.BricoAuth||typeof window.BricoAuth.logout!=='function'){
      if(btn)btn.textContent='BŁĄD';
      return;
    }
    if(btn){btn.disabled=true;btn.textContent='WYLOGOWUJĘ…'}
    try{window.BricoAuth.logout()}catch(err){
      if(btn){btn.disabled=false;btn.textContent='TAK'}
    }
  }

  function refreshAccount(){
    seed();
    pullNativeAuth();

    var box=document.getElementById('bricoUploadSettingsBox');
    if(box&&box.style.display!=='none')box.style.setProperty('display','none','important');
    var serverBtn=document.getElementById('serverConfigBtn');
    if(serverBtn&&serverBtn.style.display!=='none')serverBtn.style.display='none';

    var area=ensureAccountUi();
    if(!area)return;

    var lbl=document.getElementById('bricoAccountLabel');
    if(lbl&&lbl.textContent!==label())lbl.textContent=label();

    var connected=!!(auth().verified&&auth().loggedIn);
    if(!connected)closeAccount();
  }

  function boot(){
    seed();
    pullNativeAuth();
    refreshAccount();

    if('MutationObserver' in window){
      var queued=false;
      new MutationObserver(function(){
        if(queued)return;
        queued=true;
        setTimeout(function(){queued=false;refreshAccount()},0);
      }).observe(document.documentElement,{childList:true,subtree:true});
    }
    window.addEventListener('brico-auth-change',refreshAccount);
    setInterval(function(){pullNativeAuth();refreshAccount()},1000);
    setTimeout(refreshAccount,100);
    setTimeout(refreshAccount,600);
    setTimeout(refreshAccount,1600);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
