(function(){
  'use strict';
  function ensure(){
    if(document.getElementById('bricoDbStampScaleV65'))return;
    var s=document.createElement('style');
    s.id='bricoDbStampScaleV65';
    s.textContent='\
      #bricoDbBadgeV40,#bricoDbBadgeV40 *{-webkit-text-size-adjust:none!important;text-size-adjust:none!important}\
      #bricoDbBadgeV40 .bricoDbDateV61{font-size:8px!important;line-height:8px!important;height:4px!important;transform:scale(.5)!important;transform-origin:right center!important}\
      #bricoDbBadgeV40 .bricoDbTimeV61{font-size:8px!important;line-height:8px!important;height:6px!important;transform:scale(.75)!important;transform-origin:right center!important}\
    ';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
