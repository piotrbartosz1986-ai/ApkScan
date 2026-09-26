(function(){
  'use strict';
  var KEY='brico.upload.endpoint';
  var WORKING='https://gahbowq.cluster129.hosting.ovh.net/api/upload.php';
  var BROKEN='https://gahbowq.cluster129.hosting.ovh.net/scanner/upload_v5.php';

  function rollback(){
    try{
      var value=(localStorage.getItem(KEY)||'').trim();
      if(!value || value===BROKEN){
        localStorage.setItem(KEY,WORKING);
      }
    }catch(e){}

    var input=document.getElementById('bricoEndpointInput');
    if(input){
      var shown=(input.value||'').trim();
      if(!shown || shown===BROKEN) input.value=WORKING;
    }
  }

  rollback();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',rollback);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='settingsBtn') setTimeout(rollback,80);
  },true);
})();
