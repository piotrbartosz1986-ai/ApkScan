(function(){
  'use strict';

  var TOKEN_KEY='brico.upload.token';
  var ENDPOINT_KEY='brico.upload.endpoint';

  function seed(){
    try{
      localStorage.setItem(TOKEN_KEY,'BRICOLAB_SESSION_AUTH');
      localStorage.setItem(ENDPOINT_KEY,'https://bricolab.pl/BricoLab/api/scanner_upload_v5.php');
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
    var box=document.getElementById('bricoUploadSettingsBox');
    if(box)box.style.setProperty('display','none','important');
    var status=document.getElementById('bricoUploadStatus');
    if(status){status.textContent=label();status.style.color=(auth().verified&&auth().loggedIn)?'#36d27f':'#9aa5b1'}
    var serverBtn=document.getElementById('serverConfigBtn');
    if(serverBtn)serverBtn.style.display='none';
  }

  function boot(){
    seed();
    hideLegacySettings();
    if('MutationObserver' in window){
      new MutationObserver(hideLegacySettings).observe(document.documentElement,{childList:true,subtree:true});
    }
    window.addEventListener('brico-auth-change',hideLegacySettings);
    setTimeout(hideLegacySettings,100);
    setTimeout(hideLegacySettings,600);
    setTimeout(hideLegacySettings,1600);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
