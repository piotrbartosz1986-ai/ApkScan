(function(){
  'use strict';

  function install(){
    var old=document.getElementById('bricoDbStampScaleV64');
    if(old)old.remove();
    var s=document.createElement('style');
    s.id='bricoDbStampScaleV64';
    s.textContent='\
      #bricoDbBadgeV40 .bricoDbDateV61{font-size:8px!important;line-height:8px!important;height:8px!important;zoom:.25!important}\
      #bricoDbBadgeV40 .bricoDbTimeV61{font-size:8px!important;line-height:8px!important;height:8px!important;zoom:.5!important}\
    ';
    document.head.appendChild(s);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setTimeout(install,300);
})();
