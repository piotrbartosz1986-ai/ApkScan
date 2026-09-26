(function(){
  'use strict';

  var id='bricoNameSizeV42Style';
  if(document.getElementById(id))return;

  var style=document.createElement('style');
  style.id=id;
  style.textContent='\
    #scanList .code{font-size:11px!important;line-height:1.12!important;font-weight:900!important}\
    #scanList .itemmeta{font-size:7.5px!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;line-height:1.05!important;letter-spacing:-.12px!important}\
    #scanList .item.bricoLatestItem .code{font-size:12px!important;line-height:1.10!important;font-weight:950!important;max-width:15ch!important;white-space:normal!important;overflow-wrap:anywhere!important}\
    #scanList .item.bricoLatestItem .itemmeta{font-size:8px!important;font-weight:750!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}\
  ';
  document.head.appendChild(style);
})();
