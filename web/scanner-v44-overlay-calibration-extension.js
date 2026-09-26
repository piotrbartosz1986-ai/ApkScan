(function(){
  'use strict';

  var PANEL_ID='bricoOverlayCalibrationV44';
  var APPLY_DELAY=90;
  var applyTimer=null;

  function bridge(){return window.NativeScanner||null}
  function call(name){
    var b=bridge();
    if(!b||typeof b[name]!=='function')return null;
    try{return b[name].apply(b,[].slice.call(arguments,1))}catch(e){return null}
  }
  function num(id,fallback){
    var el=document.getElementById(id);if(!el)return fallback;
    var n=Number(el.value);return Number.isFinite(n)?n:fallback;
  }
  function txt(id,fallback){
    var el=document.getElementById(id);return el?String(el.value||fallback).trim():fallback;
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}

  function defaults(){
    return {
      scan:{left:12,bottom:0,width:64,height:38,transparency:10},
      torch:{left:82,bottom:0,width:46,height:38,transparency:10},
      zoom:{right:-53,y:0,length:171,touchWidth:58,transparency:10,trackWidth:2,trackColor:'#36D27F',thumbColor:'#FFFFFF',thumbSize:22},
      zoomLabel:{right:4,bottom:4,width:46,height:24,transparency:10}
    };
  }

  function readNative(){
    var raw=call('getOverlayCalibration');
    if(!raw)return defaults();
    try{return JSON.parse(raw)}catch(e){return defaults()}
  }

  function field(id,label,value,min,max,step){
    return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="number" min="'+min+'" max="'+max+'" step="'+(step||1)+'" value="'+esc(value)+'"></div>';
  }
  function colorField(id,label,value){
    return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="text" value="'+esc(value)+'" spellcheck="false" autocomplete="off"></div>';
  }

  function build(){
    var modal=document.querySelector('#settingsModal .modalbox');
    if(!modal||document.getElementById(PANEL_ID))return;
    var actions=modal.querySelector('.settingsActions');
    if(!actions)return;

    var cfg=readNative();
    var s=cfg.scan||defaults().scan;
    var t=cfg.torch||defaults().torch;
    var z=cfg.zoom||defaults().zoom;
    var l=cfg.zoomLabel||defaults().zoomLabel;

    var sec=document.createElement('section');
    sec.className='settingSec';
    sec.id=PANEL_ID;
    sec.innerHTML=''
      +'<div class="settingTitle">KALIBRACJA PODGLĄDU — TYMCZASOWE</div>'
      +'<div style="font-size:9px;color:var(--muted);line-height:1.35;margin-bottom:8px">Zmiany działają na żywo i zapisują się w APK. Jak ustawisz wygląd, kliknij <b>KOPIUJ DANE</b> i wklej mi JSON — potem ten panel usuniemy.</div>'

      +'<div class="settingTitle" style="margin-top:8px">START / STOP</div>'
      +'<div class="fieldGrid">'
      +field('ovScanLeft','X od lewej (dp)',s.left,-40,320,1)
      +field('ovScanBottom','Y od dołu (dp)',s.bottom,-40,160,1)
      +field('ovScanWidth','Szerokość (dp)',s.width,30,180,1)
      +field('ovScanHeight','Wysokość (dp)',s.height,24,100,1)
      +field('ovScanTransparency','Przezroczystość tła (%)',s.transparency,0,95,1)
      +'</div>'

      +'<div class="settingTitle" style="margin-top:10px">LATARKA</div>'
      +'<div class="fieldGrid">'
      +field('ovTorchLeft','X od lewej (dp)',t.left,-40,340,1)
      +field('ovTorchBottom','Y od dołu (dp)',t.bottom,-40,160,1)
      +field('ovTorchWidth','Szerokość (dp)',t.width,30,160,1)
      +field('ovTorchHeight','Wysokość (dp)',t.height,24,100,1)
      +field('ovTorchTransparency','Przezroczystość tła (%)',t.transparency,0,95,1)
      +'</div>'

      +'<div class="settingTitle" style="margin-top:10px">ZOOM — SUWAK</div>'
      +'<div class="fieldGrid">'
      +field('ovZoomRight','Pozycja od prawej (dp)',z.right,-140,120,1)
      +field('ovZoomY','Przesunięcie pionowe (dp)',z.y,-140,140,1)
      +field('ovZoomLength','Długość suwaka (dp)',z.length,70,280,1)
      +field('ovZoomTouchWidth','Szerokość pola suwaka (dp)',z.touchWidth,28,110,1)
      +field('ovZoomTransparency','Przezroczystość suwaka (%)',z.transparency,0,95,1)
      +field('ovZoomTrackWidth','Grubość linii (dp)',z.trackWidth,1,14,1)
      +field('ovZoomThumbSize','Wielkość kropki (dp)',z.thumbSize,10,52,1)
      +colorField('ovZoomTrackColor','Kolor linii HEX',z.trackColor||'#36D27F')
      +colorField('ovZoomThumbColor','Kolor kropki HEX',z.thumbColor||'#FFFFFF')
      +'</div>'

      +'<div class="settingTitle" style="margin-top:10px">ZOOM — NAPIS 1.0×</div>'
      +'<div class="fieldGrid">'
      +field('ovLabelRight','Od prawej (dp)',l.right,-40,160,1)
      +field('ovLabelBottom','Od dołu (dp)',l.bottom,-40,160,1)
      +field('ovLabelWidth','Szerokość (dp)',l.width,28,100,1)
      +field('ovLabelHeight','Wysokość (dp)',l.height,18,60,1)
      +field('ovLabelTransparency','Przezroczystość (%)',l.transparency,0,95,1)
      +'</div>'

      +'<textarea id="ovCalibrationJson" readonly style="width:100%;min-height:104px;margin-top:10px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--text);padding:7px;font-size:9px;line-height:1.35"></textarea>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px">'
      +'<button type="button" id="ovCopyCalibration">KOPIUJ DANE</button>'
      +'<button type="button" id="ovResetCalibration" class="danger">RESET</button>'
      +'</div>';

    modal.insertBefore(sec,actions);
    bind();
    updateJson(cfg);
  }

  function collect(){
    return {
      scan:{
        left:num('ovScanLeft',12),bottom:num('ovScanBottom',0),width:num('ovScanWidth',64),height:num('ovScanHeight',38),transparency:num('ovScanTransparency',10)
      },
      torch:{
        left:num('ovTorchLeft',82),bottom:num('ovTorchBottom',0),width:num('ovTorchWidth',46),height:num('ovTorchHeight',38),transparency:num('ovTorchTransparency',10)
      },
      zoom:{
        right:num('ovZoomRight',-53),y:num('ovZoomY',0),length:num('ovZoomLength',171),touchWidth:num('ovZoomTouchWidth',58),transparency:num('ovZoomTransparency',10),trackWidth:num('ovZoomTrackWidth',2),trackColor:txt('ovZoomTrackColor','#36D27F'),thumbColor:txt('ovZoomThumbColor','#FFFFFF'),thumbSize:num('ovZoomThumbSize',22)
      },
      zoomLabel:{
        right:num('ovLabelRight',4),bottom:num('ovLabelBottom',4),width:num('ovLabelWidth',46),height:num('ovLabelHeight',24),transparency:num('ovLabelTransparency',10)
      }
    };
  }

  function updateJson(cfg){
    var out=document.getElementById('ovCalibrationJson');
    if(out)out.value=JSON.stringify(cfg||collect(),null,2);
  }

  function applyNow(){
    var cfg=collect();
    call('applyOverlayCalibration',JSON.stringify(cfg));
    setTimeout(function(){
      var normalized=readNative();
      updateJson(normalized);
    },80);
  }

  function scheduleApply(){
    clearTimeout(applyTimer);
    applyTimer=setTimeout(applyNow,APPLY_DELAY);
  }

  function fillFrom(cfg){
    cfg=cfg||defaults();
    var map={
      ovScanLeft:cfg.scan.left,ovScanBottom:cfg.scan.bottom,ovScanWidth:cfg.scan.width,ovScanHeight:cfg.scan.height,ovScanTransparency:cfg.scan.transparency,
      ovTorchLeft:cfg.torch.left,ovTorchBottom:cfg.torch.bottom,ovTorchWidth:cfg.torch.width,ovTorchHeight:cfg.torch.height,ovTorchTransparency:cfg.torch.transparency,
      ovZoomRight:cfg.zoom.right,ovZoomY:cfg.zoom.y,ovZoomLength:cfg.zoom.length,ovZoomTouchWidth:cfg.zoom.touchWidth,ovZoomTransparency:cfg.zoom.transparency,ovZoomTrackWidth:cfg.zoom.trackWidth,ovZoomTrackColor:cfg.zoom.trackColor,ovZoomThumbColor:cfg.zoom.thumbColor,ovZoomThumbSize:cfg.zoom.thumbSize,
      ovLabelRight:cfg.zoomLabel.right,ovLabelBottom:cfg.zoomLabel.bottom,ovLabelWidth:cfg.zoomLabel.width,ovLabelHeight:cfg.zoomLabel.height,ovLabelTransparency:cfg.zoomLabel.transparency
    };
    Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)el.value=map[id]});
    updateJson(cfg);
  }

  function copyData(){
    var normalized=readNative();
    updateJson(normalized);
    var out=document.getElementById('ovCalibrationJson');
    if(!out)return;
    out.focus();out.select();
    var ok=false;
    try{ok=document.execCommand('copy')}catch(e){}
    if(window.navigator&&navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(out.value).catch(function(){});
      ok=true;
    }
    var old=document.getElementById('ovCopyCalibration');
    if(old){var prev=old.textContent;old.textContent=ok?'SKOPIOWANO ✓':'ZAZNACZONO';setTimeout(function(){old.textContent=prev},1200)}
  }

  function resetData(){
    call('resetOverlayCalibration');
    setTimeout(function(){fillFrom(readNative())},120);
  }

  function bind(){
    var sec=document.getElementById(PANEL_ID);if(!sec)return;
    sec.querySelectorAll('input').forEach(function(input){
      input.addEventListener('input',scheduleApply);
      input.addEventListener('change',scheduleApply);
    });
    var copy=document.getElementById('ovCopyCalibration');if(copy)copy.onclick=copyData;
    var reset=document.getElementById('ovResetCalibration');if(reset)reset.onclick=resetData;
  }

  function ensure(){
    build();
    var sec=document.getElementById(PANEL_ID);
    if(sec&&bridge()&&typeof bridge().getOverlayCalibration==='function'){
      fillFrom(readNative());
    }
  }

  function boot(){
    setTimeout(ensure,80);
    setTimeout(ensure,500);
    document.addEventListener('click',function(e){
      if(e.target&&e.target.id==='settingsBtn')setTimeout(ensure,80);
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
