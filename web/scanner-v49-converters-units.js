(function(){
  'use strict';

  // Dokładne wartości JED występujące w aktualnym pliku bazy wydruk_ust.
  // Zapisujemy je 1:1, żeby plik dla informatyka był zgodny z nomenklaturą systemu.
  var UNITS=['szt.','L','kg','mb','m2','g','m','ml','m3','A.Wa','Tuzin'];

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

  function applyUnits(){
    var grid=document.getElementById('bricoUnitGridV48');
    if(!grid)return false;
    var current=[].map.call(grid.querySelectorAll('[data-unit]'),function(b){return b.getAttribute('data-unit')||''}).join('|');
    var wanted=UNITS.join('|');
    if(current===wanted)return true;
    grid.innerHTML=UNITS.map(function(u){
      return '<button type="button" data-unit="'+esc(u)+'">'+esc(u)+'</button>';
    }).join('');
    return true;
  }

  function boot(){
    if(applyUnits())return;
    var tries=0;
    var t=setInterval(function(){
      tries++;
      if(applyUnits()||tries>80)clearInterval(t);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

  // v48 tworzy modal tylko raz, ale na wszelki wypadek pilnujemy listy po kliknięciu trybu/marki.
  document.addEventListener('click',function(){setTimeout(applyUnits,0)},true);
})();
