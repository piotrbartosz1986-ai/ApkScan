(function(){
  'use strict';

  function parsePayload(payload){
    if(payload && typeof payload === 'object'){
      var copy={};
      Object.keys(payload).forEach(function(k){copy[k]=payload[k]});
      return copy;
    }
    if(typeof payload === 'string'){
      try{return JSON.parse(payload)}catch(e){return {code:payload}}
    }
    return {};
  }

  function normalizeProduct13(value){
    var code=String(value==null?'':value).trim();
    if(!/^\d{1,13}$/.test(code))return null;
    return code.padStart(13,'0');
  }

  /*
    BricoLab szuka produktu po 13-cyfrowym kodzie. Format kreskowy nie ma
    znaczenia: EAN-13, EAN-8, UPC, Code 128 itd. mogą być włączone osobno,
    ale do listy i wyszukiwarki przekazujemy zawsze 13 cyfr.
  */
  var previousBarcode=window.onNativeBarcode;
  window.onNativeBarcode=function(payload){
    var x=parsePayload(payload);
    var normalized=normalizeProduct13(x.code);
    if(!normalized)return;
    x.code=normalized;
    if(typeof previousBarcode==='function')previousBarcode(x);
  };

  function compactSettings(){
    var pad=document.getElementById('setPad13');
    if(pad){
      pad.checked=true;
      var label=pad.closest ? pad.closest('label') : null;
      if(label)label.style.display='none';
    }

    var save=document.getElementById('saveSettingsBtn');
    if(save && !save.dataset.product13Guard){
      save.dataset.product13Guard='1';
      save.addEventListener('click',function(){
        var cb=document.getElementById('setPad13');
        if(cb)cb.checked=true;
      },true);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',compactSettings);
  }else{
    compactSettings();
  }
})();
