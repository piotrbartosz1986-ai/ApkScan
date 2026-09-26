(function(){
  'use strict';

  var THEME_KEY='brico.appearance';

  function bridge(){ return window.NativeScanner || null; }
  function call(name){
    var b=bridge();
    if(!b || typeof b[name] !== 'function') return null;
    try { return b[name].apply(b,[].slice.call(arguments,1)); } catch(e){ return null; }
  }
  function state(){
    try{
      var value=call('getState');
      return typeof value==='string' ? JSON.parse(value) : (value||{});
    }catch(e){ return {}; }
  }

  // Exactly the proven path from diagnostic C/D. No second CameraX path.
  function goodCameraToggle(){
    var s=state();
    if(!s.running){
      call('setPreviewVisible',true);
      call('startScanner');
    }else if(s.paused){
      call('setPaused',false);
    }else{
      call('stopScanner');
    }
  }
  window.bricoGoodCameraToggle=goodCameraToggle;

  function removeOldCameraBar(){
    var bar=document.getElementById('cameraStartCompatBarV35');
    if(bar) bar.remove();
  }

  function hideUnusedCameraSettings(){
    var ids=['setContextPreview'];
    ids.forEach(function(id){
      var el=document.getElementById(id);
      if(!el) return;
      var row=el.closest('.check');
      if(row) row.style.display='none';
    });

    ['setContextFromZoom','setDigitalZoom'].forEach(function(id){
      var el=document.getElementById(id);
      if(!el) return;
      var field=el.closest('.field');
      if(field) field.style.display='none';
    });
  }

  function ensureThemeStyle(){
    if(document.getElementById('bricoThemeV37')) return;
    var style=document.createElement('style');
    style.id='bricoThemeV37';
    style.textContent='\
      .themeChoiceV37{display:grid;grid-template-columns:1fr 1fr;gap:6px}\
      .themeChoiceV37 button{min-height:34px}\
      .themeChoiceV37 button.sel{font-weight:950}\
      html[data-brico-theme="dark"] .themeChoiceV37 button.sel{background:#213229;border-color:#355845;color:var(--green)}\
      html[data-brico-theme="light"]{--bg:#f2f4f7;--panel:#ffffff;--panel2:#f7f9fb;--line:#d6dde5;--text:#18212b;--muted:#697786;--green:#16864a;--red:#c93f45;--blue:#2869a8;--yellow:#8a6a00}\
      html[data-brico-theme="light"],html[data-brico-theme="light"] body{background:var(--bg)!important;color:var(--text)!important}\
      html[data-brico-theme="light"] .panel,html[data-brico-theme="light"] .settingSec,html[data-brico-theme="light"] .modalbox{background:var(--panel)!important;border-color:var(--line)!important}\
      html[data-brico-theme="light"] .item{background:var(--panel2)!important;border-color:var(--line)!important}\
      html[data-brico-theme="light"] button{background:#eef2f6!important;border-color:var(--line)!important;color:var(--text)!important}\
      html[data-brico-theme="light"] button.primary{background:var(--green)!important;border-color:var(--green)!important;color:#ffffff!important}\
      html[data-brico-theme="light"] button.blue{background:#e8f2ff!important;border-color:#b7d4ef!important;color:#1d5588!important}\
      html[data-brico-theme="light"] button.danger,html[data-brico-theme="light"] .danger{color:var(--red)!important}\
      html[data-brico-theme="light"] .seg button.sel,html[data-brico-theme="light"] .topQuick button.sel,html[data-brico-theme="light"] .themeChoiceV37 button.sel{background:#e5f3ea!important;border-color:#b8d9c4!important;color:#116b3b!important}\
      html[data-brico-theme="light"] input[type="number"],html[data-brico-theme="light"] input[type="text"],html[data-brico-theme="light"] .qtybox input,html[data-brico-theme="light"] .qtyinput{background:#ffffff!important;color:var(--text)!important;border-color:var(--line)!important}\
      html[data-brico-theme="light"] .fmt{background:#f7f9fb!important;border-color:var(--line)!important}\
      html[data-brico-theme="light"] .toast{background:#ffffff!important;border-color:var(--line)!important;color:var(--text)!important;box-shadow:0 8px 28px rgba(24,33,43,.14)}\
      html[data-brico-theme="light"] .modal{background:rgba(24,33,43,.38)!important}\
      html[data-brico-theme="light"] .modalTop{background:rgba(255,255,255,.97)!important;border-color:var(--line)!important}\
      html[data-brico-theme="light"] .tech,html[data-brico-theme="light"] .settingTitle,html[data-brico-theme="light"] .field label,html[data-brico-theme="light"] .heroLabel,html[data-brico-theme="light"] .lastMeta,html[data-brico-theme="light"] .listStats,html[data-brico-theme="light"] .empty,html[data-brico-theme="light"] .infoDetails summary,html[data-brico-theme="light"] .infoDetails div{color:var(--muted)!important}\
      html[data-brico-theme="light"] .bricoProductCard{background:#ffffff!important;border-color:#d2d9e1!important}\
      html[data-brico-theme="light"] .bricoProductTitle{color:#7a8794!important}\
      html[data-brico-theme="light"] .bricoProductName{color:#18212b!important}\
      html[data-brico-theme="light"] .bricoMetric{background:#f4f6f8!important;border-color:#d6dde5!important}\
      html[data-brico-theme="light"] .bricoMetric span{color:#697786!important}\
      html[data-brico-theme="light"] .bricoMetric b{color:#18212b!important}\
      html[data-brico-theme="light"] .bricoProductFoot{color:#697786!important}\
      html[data-brico-theme="light"] .bricoProdMini{color:#344250!important;border-color:#d6dde5!important}\
      html[data-brico-theme="light"] .bricoProdMini b{color:#18212b!important}\
      html[data-brico-theme="light"] .bricoProdMini .pvals{color:#697786!important}\
      html[data-brico-theme="light"] .bricoDbBadge{background:rgba(0,0,0,.50)!important;border-color:rgba(0,0,0,.58)!important;color:#f3f5f7!important}\
      html[data-brico-theme="light"] .bricoDbBadge.ok{background:rgba(0,0,0,.50)!important;border-color:#16864a!important;color:#5ee39a!important}\
      html[data-brico-theme="light"] .bricoDbBadge.warn{background:rgba(0,0,0,.50)!important;border-color:#9a7400!important;color:#ffd76a!important}\
      html[data-brico-theme="light"] .bricoDbBadge.err{background:rgba(0,0,0,.50)!important;border-color:#b43b43!important;color:#ff7b82!important}\
    ';
    document.head.appendChild(style);
  }

  function currentTheme(){
    var value='dark';
    try{ value=localStorage.getItem(THEME_KEY)||'dark'; }catch(e){}
    return value==='light' ? 'light' : 'dark';
  }

  function applyTheme(theme){
    theme=theme==='light'?'light':'dark';
    document.documentElement.setAttribute('data-brico-theme',theme);
    try{ localStorage.setItem(THEME_KEY,theme); }catch(e){}
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content',theme==='light'?'#f2f4f7':'#0b0d10');
    var dark=document.getElementById('themeDarkV37');
    var light=document.getElementById('themeLightV37');
    if(dark) dark.classList.toggle('sel',theme==='dark');
    if(light) light.classList.toggle('sel',theme==='light');
  }

  function ensureThemeSetting(){
    var modal=document.querySelector('#settingsModal .modalbox');
    if(!modal || document.getElementById('appearanceSettingV37')) return;

    var sec=document.createElement('section');
    sec.className='settingSec';
    sec.id='appearanceSettingV37';
    sec.innerHTML=''
      +'<div class="settingTitle">Wygląd</div>'
      +'<div class="themeChoiceV37">'
      +'<button type="button" id="themeDarkV37">CIEMNY</button>'
      +'<button type="button" id="themeLightV37">JASNY</button>'
      +'</div>';

    var first=modal.querySelector('.settingSec');
    if(first) modal.insertBefore(sec,first); else modal.appendChild(sec);

    document.getElementById('themeDarkV37').onclick=function(){ applyTheme('dark'); };
    document.getElementById('themeLightV37').onclick=function(){ applyTheme('light'); };
    applyTheme(currentTheme());
  }

  function prepareUi(){
    ensureThemeStyle();
    applyTheme(currentTheme());
    removeOldCameraBar();
    hideUnusedCameraSettings();
    ensureThemeSetting();
  }

  function autoStart(){
    if(window.__bricoAutoStartDone) return;
    window.__bricoAutoStartDone=true;
    setTimeout(function(){
      var s=state();
      if(!s.running) goodCameraToggle();
    },350);
  }

  function boot(){
    setTimeout(prepareUi,0);
    setTimeout(prepareUi,160);
    setTimeout(prepareUi,600);
    autoStart();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  document.addEventListener('click',function(e){
    if(e.target && e.target.id==='settingsBtn'){
      setTimeout(prepareUi,30);
      setTimeout(prepareUi,180);
    }
  },true);
})();
