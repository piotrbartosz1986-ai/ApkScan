(function(){
  'use strict';
  var id='bricoNameSizeV42Style';
  if(document.getElementById(id))return;
  var style=document.createElement('style');
  style.id=id;
  style.textContent='\
    #scanList .code{font-size:11px!important;line-height:1.12!important;font-weight:900!important}\
    #scanList .item.bricoLatestItem .code{font-size:12px!important;line-height:1.10!important;font-weight:950!important}\
  ';
  document.head.appendChild(style);
})();
