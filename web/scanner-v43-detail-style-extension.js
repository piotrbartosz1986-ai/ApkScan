(function(){
  'use strict';

  var STYLE_ID='bricoDetailStyleV43';
  var ATTR='data-brico-v43-text';
  var MODE_ATTR='data-brico-v43-mode';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\
      #scanList .itemmeta .bricoSepV43{display:inline-block;font-size:1.45em!important;font-weight:950!important;line-height:.70!important;vertical-align:-.05em;margin:0 .03em;color:#c7d0d9!important}\
      html[data-brico-theme="light"] #scanList .itemmeta .bricoSepV43{color:#465463!important}\
      html[data-brico-theme="dark"] #scanList .itemmeta .bricoSepV43{color:#c7d0d9!important}\
      #scanList .itemmeta .bricoMissingV43{color:#ff6969!important;font-weight:950!important}\
      #scanList .item.bricoLatestItem .itemmeta{font-weight:400!important}\
      #scanList .item.bricoLatestItem .bricoLatestTopV46,#scanList .item.bricoLatestItem .bricoLatestBottomV46{display:block!important;width:100%!important}\
      #scanList .item.bricoLatestItem .bricoLatestBottomV46{margin-top:1px!important}\
    ';
    document.head.appendChild(style);
  }

  function isMissing(text){
    return /Brak w (?:nieaktualnej )?bazie/i.test(text||'');
  }

  function appendPart(target,part){
    if(isMissing(part)){
      var missing=document.createElement('span');
      missing.className='bricoMissingV43';
      missing.textContent=part;
      target.appendChild(missing);
    }else{
      target.appendChild(document.createTextNode(part));
    }
  }

  function appendSep(target){
    var sep=document.createElement('span');
    sep.className='bricoSepV43';
    sep.textContent='|';
    target.appendChild(sep);
  }

  function decorate(el){
    if(!el)return;
    var row=el.closest('.item');
    if(!row)return;

    var text=String(el.textContent||'');
    var mode=row.classList.contains('bricoLatestItem')?'latest':'normal';
    if(el.getAttribute(ATTR)===text && el.getAttribute(MODE_ATTR)===mode && el.querySelector('.bricoSepV43'))return;

    el.setAttribute(ATTR,text);
    el.setAttribute(MODE_ATTR,mode);
    var parts=text.split('|');
    var frag=document.createDocumentFragment();

    if(mode==='latest' && parts.length>=3){
      var top=document.createElement('span');
      top.className='bricoLatestTopV46';
      appendPart(top,parts[0]||'');
      appendSep(top);
      appendPart(top,parts[1]||'');
      frag.appendChild(top);

      var bottom=document.createElement('span');
      bottom.className='bricoLatestBottomV46';
      for(var i=2;i<parts.length;i++){
        if(i>2)appendSep(bottom);
        appendPart(bottom,parts[i]||'');
      }
      frag.appendChild(bottom);
    }else{
      parts.forEach(function(part,index){
        if(index>0)appendSep(frag);
        appendPart(frag,part);
      });
    }

    el.replaceChildren(frag);
  }

  function refresh(){
    ensureStyle();
    document.querySelectorAll('#scanList .itemmeta').forEach(decorate);
  }

  var scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    var run=function(){scheduled=false;refresh()};
    if(typeof queueMicrotask==='function')queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  function boot(){
    refresh();
    var list=document.getElementById('scanList');
    if(list&&window.MutationObserver){
      new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
    }
    setTimeout(refresh,120);
    setTimeout(refresh,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
