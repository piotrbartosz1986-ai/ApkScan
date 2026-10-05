(function(){
  'use strict';

  // BricoLab Scan: po poprawnym wysłaniu nie zmieniaj napisu na przycisku.
  // Zachowujemy cały dotychczasowy upload, statusy i blokadę czasową;
  // zmieniamy wyłącznie tekst przycisku z "WYSŁANO ✓" z powrotem na "WYŚLIJ".
  var previous=window.onNativeUploadResult;

  window.onNativeUploadResult=function(result){
    if(typeof previous==='function'){
      try{previous(result)}catch(e){}
    }
    try{
      var btn=document.getElementById('bricoUploadBtn');
      if(btn && /WYSŁANO/i.test(String(btn.textContent||''))){
        btn.textContent='WYŚLIJ';
      }
    }catch(e){}
  };
})();
