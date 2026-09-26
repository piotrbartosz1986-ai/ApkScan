(function(){
  'use strict';

  function bridge(){ return window.NativeScanner || null; }
  function call(name){
    var b=bridge();
    if(!b || typeof b[name] !== 'function') return null;
    try { return b[name].apply(b,[].slice.call(arguments,1)); } catch(e){ return null; }
  }

  function previewState(){
    var b=bridge();
    if(b && typeof b.isPreviewVisible === 'function'){
      try { return !!b.isPreviewVisible(); } catch(e){}
    }
    return true;
  }

  function install(){
    if(document.getElementById('setPreviewVisibleV34')) return;

    var contextToggle=document.getElementById('setContextPreview');
    var section=contextToggle ? contextToggle.closest('.settingSec') : null;
    if(!section) return;

    var box=document.createElement('div');
    box.id='previewCompatBox';
    box.style.cssText='margin-top:8px;padding-top:7px;border-top:1px solid #29313a';
    box.innerHTML=''
      +'<label class="check"><input type="checkbox" id="setPreviewVisibleV34"> Pokaż kamerę / uruchom podgląd</label>'
      +'<button id="restartCameraCompatBtn" type="button" style="width:100%;min-height:32px;margin-top:4px;font-size:9px">URUCHOM APARAT PONOWNIE</button>'
      +'<div style="font-size:8px;color:#9aa5b1;margin-top:4px;line-height:1.35">Tryb zgodny ze starszą wersją: checkbox steruje bezpośrednio widocznością podglądu i osobno uruchamia aparat.</div>';
    section.appendChild(box);

    var check=document.getElementById('setPreviewVisibleV34');
    check.checked=previewState();
    check.onchange=function(){
      localStorage.setItem('brico.preview.visible',this.checked?'1':'0');
      call('setPreviewVisible',!!this.checked);
    };

    var restart=document.getElementById('restartCameraCompatBtn');
    restart.onclick=function(){
      check.checked=true;
      localStorage.setItem('brico.preview.visible','1');
      call('setPreviewVisible',true);
      setTimeout(function(){ call('restartCameraCompat'); },80);
    };

    var saved=localStorage.getItem('brico.preview.visible');
    if(saved==='0'){
      check.checked=false;
      call('setPreviewVisible',false);
    }else{
      check.checked=true;
      // Do not force restart on every page load. Just ensure visibility.
      call('setPreviewVisible',true);
    }
  }

  function refresh(){
    install();
    var check=document.getElementById('setPreviewVisibleV34');
    if(check) check.checked=previewState();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(refresh,0);setTimeout(refresh,180);});
  else { setTimeout(refresh,0); setTimeout(refresh,180); }

  document.addEventListener('click',function(e){
    if(e.target && e.target.id==='settingsBtn') setTimeout(refresh,30);
  },true);
})();
