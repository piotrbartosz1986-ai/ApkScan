(function(){
  'use strict';

  var id='bricoNameSizeV42Style';
  if(!document.getElementById(id)){
    var style=document.createElement('style');
    style.id=id;
    style.textContent='\
      #scanList .code{font-size:11px!important;line-height:1.12!important;font-weight:900!important}\
      #scanList .item.bricoLatestItem .code{font-size:12px!important;line-height:1.10!important;font-weight:950!important}\
      #scanList .itemmeta{white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;line-height:1.05!important;letter-spacing:-.12px!important}\
      #scanList .item.bricoLatestItem .itemmeta{font-weight:750!important}\
    ';
    document.head.appendChild(style);
  }

  function compactText(text){
    var t=String(text==null?'':text).trim();
    if(!t)return t;

    t=t.replace(/\s*•\s*/g,'|');
    t=t.replace(/(\bSt\.\s*[-+]?\d+(?:[,.]\d+)?)\s*szt\b/gi,'$1');
    t=t.replace(/\s*\|\s*/g,'|');
    return t;
  }

  function fitMeta(el){
    if(!el)return;
    var size=8;
    el.style.setProperty('font-size',size+'px','important');
    requestAnimationFrame(function(){
      var guard=0;
      while(el.scrollWidth>el.clientWidth && size>5.8 && guard<15){
        size=Math.max(5.8,size-0.2);
        el.style.setProperty('font-size',size.toFixed(1)+'px','important');
        guard++;
      }
    });
  }

  function refresh(){
    var metas=document.querySelectorAll('#scanList .itemmeta');
    for(var i=0;i<metas.length;i++){
      var el=metas[i];
      var next=compactText(el.textContent);
      if(el.textContent!==next)el.textContent=next;
      fitMeta(el);
    }
  }

  var scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(function(){scheduled=false;refresh()},0);
  }

  function boot(){
    refresh();
    var list=document.getElementById('scanList');
    if(list&&window.MutationObserver){
      new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
    }
    window.addEventListener('resize',schedule);
    setTimeout(refresh,150);
    setTimeout(refresh,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
