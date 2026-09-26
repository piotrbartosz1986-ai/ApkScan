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
      #scanList .bricoSepV43{display:inline-block!important;font-size:1.32em!important;font-weight:950!important;line-height:.72!important;vertical-align:-.02em!important;color:#c4ccd5!important;letter-spacing:0!important;margin:0 .5px!important}\
      #scanList .item.bricoLatestItem .bricoSepV43{font-size:1.42em!important;font-weight:950!important}\
      #scanList .item.bricoLatestItem .bricoBreakSepV44{display:none!important}\
      #scanList .item.bricoLatestItem .bricoLatestBreakV44{display:block!important}\
      html[data-brico-theme="light"] #scanList .bricoSepV43{color:#4d5b69!important}\
      #scanList .item.bricoMissingV43 .code,#scanList .item.bricoMissingV43 .itemmeta{color:var(--red)!important}\
      #scanList .item.bricoMissingV43 .bricoSepV43,#scanList .item.bricoStaleDataV40 .bricoSepV43{color:var(--red)!important}\
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

  function decorateMeta(meta){
    if(!meta)return;
    var text=String(meta.textContent||'');
    var row=meta.closest('.item');
    if(!row)return;

    var missing=/Brak w (?:nieaktualnej )?bazie/i.test(text);
    row.classList.toggle('bricoMissingV43',missing);

    var mode=row.classList.contains('bricoLatestItem')?'latest':'normal';
    if(text.indexOf('|')<0){
      meta.setAttribute('data-brico-layout-v44',mode);
      return;
    }

    if(meta.querySelector('.bricoSepV43')&&meta.getAttribute('data-brico-layout-v44')===mode)return;

    var parts=text.split('|');
    var frag=document.createDocumentFragment();
    for(var i=0;i<parts.length;i++){
      if(i){
        var sep=document.createElement('span');
        sep.className='bricoSepV43';
        sep.textContent='|';
        if(mode==='latest'&&i===2){
          sep.className+=' bricoBreakSepV44';
          frag.appendChild(sep);
          var br=document.createElement('br');
          br.className='bricoLatestBreakV44';
          frag.appendChild(br);
        }else{
          frag.appendChild(sep);
        }
      }
      if(parts[i])frag.appendChild(document.createTextNode(parts[i]));
    }
    meta.replaceChildren(frag);
    meta.setAttribute('data-brico-layout-v44',mode);
  }

  function refresh(){
    relabelControls();
    bindSendLabel();
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
      new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
    }
    setTimeout(refresh,120);
    setTimeout(refresh,650);
    setTimeout(refresh,1800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
