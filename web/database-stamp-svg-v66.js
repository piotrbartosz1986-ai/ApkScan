(function(){
  'use strict';

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

  function ensureStyle(){
    if(document.getElementById('bricoDbStampSvgStyleV66'))return;
    var s=document.createElement('style');
    s.id='bricoDbStampSvgStyleV66';
    s.textContent='\
      #bricoDbBadgeV40.bricoDbStampedV61{gap:2px!important}\
      #bricoDbBadgeV40 .bricoDbStampV61{display:block!important;width:31px!important;height:10px!important;min-width:31px!important;line-height:0!important;overflow:visible!important;opacity:.82!important}\
      #bricoDbBadgeV40 .bricoDbStampSvgV66{display:block!important;width:31px!important;height:10px!important;overflow:visible!important;transform:translateY(-2px)!important}\
    ';
    document.head.appendChild(s);
  }

  function convert(){
    ensureStyle();
    var stamp=document.querySelector('#bricoDbBadgeV40 .bricoDbStampV61');
    if(!stamp||stamp.querySelector('.bricoDbStampSvgV66'))return;

    var dateEl=stamp.querySelector('.bricoDbDateV61');
    var timeEl=stamp.querySelector('.bricoDbTimeV61');
    var date=dateEl?String(dateEl.textContent||'').trim():'';
    var time=timeEl?String(timeEl.textContent||'').trim():'';
    if(!date&&!time)return;

    stamp.innerHTML=''
      +'<svg class="bricoDbStampSvgV66" viewBox="0 0 31 10" width="31" height="10" aria-hidden="true">'
      +(date?'<text x="0" y="3.8" text-anchor="start" fill="currentColor" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="5" font-weight="800">'+esc(date)+'</text>':'')
      +(time?'<text x="0" y="9.3" text-anchor="start" fill="currentColor" font-family="system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-size="6" font-weight="800">'+esc(time)+'</text>':'')
      +'</svg>';
  }

  function boot(){
    ensureStyle();
    convert();
    if('MutationObserver' in window){
      var queued=false;
      new MutationObserver(function(){
        if(queued)return;
        queued=true;
        setTimeout(function(){queued=false;convert()},0);
      }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    }
    setInterval(convert,500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
