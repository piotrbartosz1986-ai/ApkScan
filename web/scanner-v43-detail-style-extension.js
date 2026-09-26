(function(){
  'use strict';

  var STYLE_ID='bricoDetailStyleV43';
  var ATTR='data-brico-v43-text';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\
      #scanList .itemmeta .bricoSepV43{display:inline-block;font-size:1.32em!important;font-weight:950!important;line-height:.72!important;vertical-align:-.04em;margin:0 .03em;color:#c7d0d9!important}\
      html[data-brico-theme="light"] #scanList .itemmeta .bricoSepV43{color:#465463!important}\
      html[data-brico-theme="dark"] #scanList .itemmeta .bricoSepV43{color:#c7d0d9!important}\
      #scanList .itemmeta .bricoMissingV43{color:var(--red)!important;font-weight:900!important}\
    ';
    document.head.appendChild(style);
  }

  function isMissing(text){
    return /Brak w (?:nieaktualnej )?bazie/i.test(text||'');
  }

  function decorate(el){
    if(!el)return;
    var text=String(el.textContent||'');
    if(el.getAttribute(ATTR)===text && el.querySelector('.bricoSepV43'))return;

    el.setAttribute(ATTR,text);
    var parts=text.split('|');
    var frag=document.createDocumentFragment();

    parts.forEach(function(part,index){
      if(index>0){
        var sep=document.createElement('span');
        sep.className='bricoSepV43';
        sep.textContent='|';
        frag.appendChild(sep);
      }

      if(isMissing(part)){
        var missing=document.createElement('span');
        missing.className='bricoMissingV43';
        missing.textContent=part;
        frag.appendChild(missing);
      }else{
        frag.appendChild(document.createTextNode(part));
      }
    });

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
    requestAnimationFrame(function(){scheduled=false;refresh()});
  }

  function boot(){
    refresh();
    var list=document.getElementById('scanList');
    if(list&&window.MutationObserver){
      new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
    }
    setTimeout(refresh,120);
    setTimeout(refresh,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
