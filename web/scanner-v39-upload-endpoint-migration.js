(function(){
  'use strict';
  var KEY='brico.upload.endpoint';
  var LEGACY='https://gahbowq.cluster129.hosting.ovh.net/api/upload.php';
  var CURRENT='https://gahbowq.cluster129.hosting.ovh.net/scanner/upload_v5.php';

  function migrate(){
    try{
      var value=(localStorage.getItem(KEY)||'').trim();
      if(!value || value===LEGACY){
        localStorage.setItem(KEY,CURRENT);
      }
    }catch(e){}

    var input=document.getElementById('bricoEndpointInput');
    if(input){
      var shown=(input.value||'').trim();
      if(!shown || shown===LEGACY) input.value=CURRENT;
    }
  }

  migrate();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',migrate);
  document.addEventListener('click',function(e){
    if(e.target&&e.target.id==='settingsBtn') setTimeout(migrate,80);
  },true);
})();
