(function(){
  'use strict';

  var id='bricoNameSizeV42Style';
  if(!document.getElementById(id)){
    var style=document.createElement('style');
    style.id=id;
    style.textContent='\
      #scanList .code{font-size:11px!important;line-height:1.12!important;font-weight:900!important}\
      #scanList .itemmeta{font-size:7.5px!important;white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important;line-height:1.05!important;letter-spacing:-.12px!important}\
      #scanList .item.bricoLatestItem .code{font-size:12px!important;line-height:1.10!important;font-weight:950!important;max-width:15ch!important;white-space:normal!important;overflow-wrap:anywhere!important}\
      #scanList .item.bricoLatestItem .itemmeta{font-size:8px!important;font-weight:750!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important}\
      #scanList .bricoSepV43{display:inline-block!important;font-size:1.32em!important;font-weight:950!important;line-height:.72!important;vertical-align:-.02em!important;color:#c4ccd5!important;letter-spacing:0!important}\
      html[data-brico-theme="light"] #scanList .bricoSepV43{color:#4d5b69!important}\
      #scanList .item.bricoMissingV43 .code,#scanList .item.bricoMissingV43 .itemmeta{color:var(--red)!important}\
      #scanList .item.bricoMissingV43 .bricoSepV43,#scanList .item.bricoStaleDataV40 .bricoSepV43{color:var(--red)!important}\
    ';
    document.head.appendChild(style);
  }

  function decorateMeta(meta){
    if(!meta)return;
    var text=String(meta.textContent||'');
    var row=meta.closest('.item');
    if(row)row.classList.toggle('bricoMissingV43',/Brak w (?:nieaktualnej )?bazie/i.test(text));
    if(text.indexOf('|')<0||meta.querySelector('.bricoSepV43'))return;

    var parts=text.split('|');
    var frag=document.createDocumentFragment();
    for(var i=0;i<parts.length;i++){
      if(i){
        var sep=document.createElement('span');
        sep.className='bricoSepV43';
        sep.textContent='|';
        frag.appendChild(sep);
      }
      if(parts[i])frag.appendChild(document.createTextNode(parts[i]));
    }
    meta.replaceChildren(frag);
  }

  function refresh(){
    var metas=document.querySelectorAll('#scanList .itemmeta');
    for(var i=0;i<metas.length;i++)decorateMeta(metas[i]);
  }

  var scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(function(){scheduled=false;refresh()});
  }

  function boot(){
    refresh();
    var list=document.getElementById('scanList');
    if(list&&window.MutationObserver){
      new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
    }
    setTimeout(refresh,120);
    setTimeout(refresh,650);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
