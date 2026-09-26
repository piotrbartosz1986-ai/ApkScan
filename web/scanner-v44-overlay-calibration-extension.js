(function(){
  'use strict';

  var FIXED={
    scan:{left:3,bottom:3,width:64,height:24,transparency:25},
    torch:{left:70,bottom:3,width:32,height:24,transparency:25},
    zoom:{right:-48,y:0,length:171,touchWidth:58,transparency:10,trackWidth:8,trackColor:'#36927F',thumbColor:'#FFFFFF',thumbSize:22},
    zoomLabel:{right:25,bottom:3,width:46,height:26,transparency:10}
  };

  function apply(){
    var b=window.NativeScanner;
    if(!b||typeof b.applyOverlayCalibration!=='function')return;
    try{b.applyOverlayCalibration(JSON.stringify(FIXED))}catch(e){}
  }

  function boot(){
    apply();
    setTimeout(apply,80);
    setTimeout(apply,350);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
