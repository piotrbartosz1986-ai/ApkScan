(function(){
  'use strict';
  function ensure(){
    if(document.getElementById('bricoDbStampScaleV64'))return;
    var s=document.createElement('style');
    s.id='bricoDbStampScaleV64';
    s.textContent='\
      #bricoDbBadgeV40 .bricoDbDateV61{font-size:4px!important;line-height:4px!important;height:2px!important;transform:scale(.5)!important;transform-origin:right center!important}\
      #bricoDbBadgeV40 .bricoDbTimeV61{font-size:8px!important;line-height:8px!important;height:4px!important;transform:scale(.5)!important;transform-origin:right center!important}\
    ';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
