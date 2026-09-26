(function(){
  'use strict';

  var PREVIEW_KEY='brico.preview.visible';

  function nativeConfig(){
    try{
      if(window.NativeScanner&&typeof window.NativeScanner.getConfig==='function'){
        var x=window.NativeScanner.getConfig();
        return typeof x==='string'?JSON.parse(x):(x||{});
      }
    }catch(e){}
    return {};
  }

  function nativeState(){
    try{
      if(window.NativeScanner&&typeof window.NativeScanner.getState==='function'){
        var x=window.NativeScanner.getState();
        return typeof x==='string'?JSON.parse(x):(x||{});
      }
    }catch(e){}
    return {};
  }

  function previewVisible(){
    try{
      if(window.NativeScanner&&typeof window.NativeScanner.isPreviewVisible==='function'){
        return !!window.NativeScanner.isPreviewVisible();
      }
    }catch(e){}
    return localStorage.getItem(PREVIEW_KEY)!=='0';
  }

  function ensureExtraCameraSettings(){
    var digital=document.getElementById('setDigitalZoom');
    if(!digital)return;
    var grid=digital.closest('.fieldGrid');
    var section=digital.closest('.settingSec');
    if(!grid||!section)return;

    if(!document.getElementById('setPreviewCamera')){
      var preview=document.createElement('label');
      preview.className='check';
      preview.id='previewCameraRow';
      preview.innerHTML='<input type="checkbox" id="setPreviewCamera"> Podgląd kamery';
      var autofocus=document.getElementById('setAutofocus');
      var autofocusRow=autofocus?autofocus.closest('.check'):null;
      if(autofocusRow)section.insertBefore(preview,autofocusRow);else section.insertBefore(preview,grid);

      var diag=document.createElement('div');
      diag.id='cameraDiagV34';
      diag.className='tech';
      diag.style.margin='-2px 0 7px';
      diag.textContent='CameraX: —';
      preview.insertAdjacentElement('afterend',diag);

      document.getElementById('setPreviewCamera').addEventListener('change',function(){
        var visible=!!this.checked;
        try{localStorage.setItem(PREVIEW_KEY,visible?'1':'0')}catch(e){}
        try{
          if(window.NativeScanner&&typeof window.NativeScanner.setPreviewVisible==='function'){
            window.NativeScanner.setPreviewVisible(visible);
          }
        }catch(e){}
        setTimeout(updateCameraDiag,250);
        setTimeout(updateCameraDiag,900);
      });
    }

    if(!document.getElementById('setZoomThumbDp')){
      var thumb=document.createElement('div');
      thumb.className='field';
      thumb.innerHTML='<label>Rozmiar kulki zoomu (dp)</label><input id="setZoomThumbDp" type="number" min="16" max="56" step="1">';
      grid.appendChild(thumb);
    }

    if(!document.getElementById('setContextFromZoom')){
      var context=document.createElement('div');
      context.className='field';
      context.innerHTML='<label>Okno kontekstowe od zoomu ×</label><input id="setContextFromZoom" type="number" min="1" max="30" step="0.1">';
      grid.appendChild(context);
    }
  }

  function updateCameraDiag(){
    var diag=document.getElementById('cameraDiagV34');
    if(!diag)return;
    var st=nativeState();
    var run=st.running?'RUNNING':'STOP';
    var pause=st.paused?' • PAUZA':'';
    var torch=st.torch?' • 🔦 ON':' • 🔦 OFF';
    var focus=st.focus?(' • AF '+st.focus):'';
    diag.textContent='CameraX: '+run+pause+torch+focus;
    diag.style.color=st.running?'#36d27f':'#9aa5b1';
  }

  function fillExtraSettings(){
    ensureExtraCameraSettings();
    var cfg=nativeConfig();
    var thumb=document.getElementById('setZoomThumbDp');
    var from=document.getElementById('setContextFromZoom');
    var preview=document.getElementById('setPreviewCamera');
    if(thumb)thumb.value=cfg.zoomThumbDp!=null?cfg.zoomThumbDp:28;
    if(from)from.value=cfg.contextPreviewFromZoom!=null?cfg.contextPreviewFromZoom:3.0;
    if(preview)preview.checked=previewVisible();
    updateCameraDiag();
  }

  function installExtraSettings(){
    ensureExtraCameraSettings();
    fillExtraSettings();

    var settings=document.getElementById('settingsBtn');
    if(settings&&!settings.dataset.v33extra){
      settings.dataset.v33extra='1';
      settings.addEventListener('click',function(){
        setTimeout(fillExtraSettings,20);
        setTimeout(updateCameraDiag,400);
      });
    }

    var save=document.getElementById('saveSettingsBtn');
    if(save&&!save.dataset.v33extra){
      save.dataset.v33extra='1';
      var original=save.onclick;
      save.onclick=function(e){
        if(typeof original==='function')original.call(this,e);
        setTimeout(function(){
          try{
            var cfg=nativeConfig();
            var thumb=parseInt((document.getElementById('setZoomThumbDp')||{}).value||28,10);
            var from=parseFloat((document.getElementById('setContextFromZoom')||{}).value||3);
            cfg.version=Math.max(9,parseInt(cfg.version||9,10));
            cfg.zoomThumbDp=Math.max(16,Math.min(56,isFinite(thumb)?thumb:28));
            cfg.contextPreviewFromZoom=Math.max(1,Math.min(30,isFinite(from)?from:3));
            if(window.NativeScanner&&typeof window.NativeScanner.applyConfig==='function'){
              window.NativeScanner.applyConfig(JSON.stringify(cfg));
            }
          }catch(err){}
        },30);
      };
    }
  }

  function install(){
    if(document.documentElement.dataset.v33ui==='1'){
      installExtraSettings();
      return;
    }
    document.documentElement.dataset.v33ui='1';

    var style=document.createElement('style');
    style.textContent='\
      .top{height:40px!important;display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:5px!important}\
      .brand{font-size:15px!important;white-space:nowrap!important}\
      .topQuick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;min-width:0}\
      .topQuick button{min-height:30px!important;height:30px!important;padding:2px 4px!important;font-size:10px!important;border-radius:8px!important;white-space:nowrap!important}\
      .topQuick button.sel{background:#213229!important;border-color:#355845!important;color:var(--green)!important}\
      .gear{width:34px!important;height:32px!important;min-height:0!important}\
      .quick{display:none!important}\
      #clearTopBtn{display:none!important}\
      #exportPanel{display:none!important}\
      .listActionsV33{display:grid;grid-template-columns:.9fr 1.55fr;gap:5px;margin-top:6px}\
      .listActionsV33 button{min-height:34px!important;font-size:9.5px!important}\
      .listActionsV33 #clearBottomBtn{display:block!important;margin:0!important;width:auto!important;min-height:34px!important}\
      .listActionsV33 #bricoUploadBtn{grid-column:auto!important;margin:0!important}\
      #bricoUploadStatus{margin-top:4px!important}\
      @media(max-width:380px){.brand{font-size:14px!important}.topQuick button{font-size:9px!important;padding:1px 2px!important}.top{gap:3px!important}}\
    ';
    document.head.appendChild(style);

    var brand=document.querySelector('.brand');
    if(brand)brand.textContent='Skaner';

    var top=document.querySelector('.top');
    var quick=document.querySelector('.quick');
    var gear=document.getElementById('settingsBtn');
    var continuous=document.getElementById('modeContinuous');
    var single=document.getElementById('modeSingle');
    var autoQty=document.getElementById('qtyAuto');
    var askQty=document.getElementById('qtyAsk');

    if(top && continuous && single && autoQty && askQty){
      var topQuick=document.createElement('div');
      topQuick.className='topQuick';
      continuous.textContent='∞';continuous.title='Tryb ciągły';continuous.setAttribute('aria-label','Tryb ciągły');
      single.textContent='1×';single.title='Tryb pojedynczy';single.setAttribute('aria-label','Tryb pojedynczy');
      autoQty.textContent='+1 szt.';autoQty.title='Dodawaj po jednej sztuce';autoQty.setAttribute('aria-label','Dodawaj po jednej sztuce');
      askQty.textContent='(× szt.)';askQty.title='Pytaj o ilość';askQty.setAttribute('aria-label','Pytaj o ilość');
      topQuick.appendChild(continuous);topQuick.appendChild(single);topQuick.appendChild(autoQty);topQuick.appendChild(askQty);
      if(gear)top.insertBefore(topQuick,gear);else top.appendChild(topQuick);
    }
    if(quick)quick.style.display='none';

    var clearTop=document.getElementById('clearTopBtn');
    if(clearTop)clearTop.style.display='none';

    var list=document.getElementById('scanList');
    var clearBottom=document.getElementById('clearBottomBtn');
    var upload=document.getElementById('bricoUploadBtn');
    var uploadStatus=document.getElementById('bricoUploadStatus');
    var listPanel=list?list.closest('.panel'):null;
    if(listPanel && clearBottom && upload){
      clearBottom.textContent='WYCZYŚĆ';
      clearBottom.className='danger';
      var actions=document.createElement('div');
      actions.className='listActionsV33';
      actions.appendChild(clearBottom);
      actions.appendChild(upload);
      listPanel.appendChild(actions);
      if(uploadStatus)listPanel.appendChild(uploadStatus);
    }

    var exportJson=document.getElementById('exportJsonBtn');
    var exportExcel=document.getElementById('exportExcelBtn');
    var exportPanel=document.getElementById('exportPanel');
    if(exportJson)exportJson.style.display='none';
    if(exportExcel)exportExcel.style.display='none';
    if(exportPanel)exportPanel.style.display='none';

    installExtraSettings();
  }

  function boot(){setTimeout(install,0);setTimeout(install,120);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
