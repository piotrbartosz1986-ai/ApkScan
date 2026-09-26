(function(){
  'use strict';

  var id='bricoNameSizeV42Style';
  if(!document.getElementById(id)){
    var style=document.createElement('style');
    style.id=id;
    style.textContent='\
      #scanList .code{font-size:11px!important;line-height:1.12!important;font-weight:900!important}\
      #scanList .itemmeta{font-size:7.5px!important;font-weight:500!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;line-height:1.08!important;letter-spacing:-.12px!important}\
      #scanList .item.bricoLatestItem .code{font-size:12px!important;line-height:1.10!important;font-weight:950!important;max-width:15ch!important;white-space:normal!important;overflow-wrap:anywhere!important}\
      #scanList .item.bricoLatestItem .itemmeta{font-size:8px!important;font-weight:400!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;line-height:1.18!important}\
    ';
    document.head.appendChild(style);
  }

  function relabelControls(){
    var qty=document.getElementById('qtyAsk');
    if(qty&&qty.textContent!=='x*szt.')qty.textContent='x*szt.';

    var send=document.getElementById('bricoUploadBtn');
    if(send&&send.textContent==='WYŚLIJ DO GENERATORA')send.textContent='WYŚLIJ';
  }

  function bindSendLabel(){
    var btn=document.getElementById('bricoUploadBtn');
    if(!btn||btn.getAttribute('data-brico-short-send-v44')==='1')return;
    btn.setAttribute('data-brico-short-send-v44','1');
    if(window.MutationObserver){
      new MutationObserver(function(){
        if(btn.textContent==='WYŚLIJ DO GENERATORA')btn.textContent='WYŚLIJ';
      }).observe(btn,{childList:true,subtree:true,characterData:true});
    }
  }

  function refresh(){
    relabelControls();
    bindSendLabel();
  }

  function boot(){
    refresh();
    setTimeout(refresh,120);
    setTimeout(refresh,650);
    setTimeout(refresh,1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
