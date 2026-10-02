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

  function hideLegacySettings(){
    seed();
    pullNativeAuth();
    var box=document.getElementById('bricoUploadSettingsBox');
    if(box&&box.style.display!=='none')box.style.setProperty('display','none','important');
    var status=document.getElementById('bricoUploadStatus');
    if(status){
      var next=label();
      if(status.textContent!==next)status.textContent=next;
      var color=(auth().verified&&auth().loggedIn)?'#36d27f':'#9aa5b1';
      if(status.style.color!==color)status.style.color=color;
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
