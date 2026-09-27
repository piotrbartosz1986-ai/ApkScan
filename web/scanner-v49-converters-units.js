(function(){
  'use strict';

  // Kolejność zgodna z obsługą przeliczników w aplikacji.
  // value zapisujemy 1:1 w nomenklaturze bazy, label/desc służą tylko do UI.
  var UNITS=[
    {value:'kg',label:'Kg.',desc:'KILOGRAM'},
    {value:'g',label:'g',desc:'GRAM'},
    {value:'m',label:'m',desc:'METR'},
    {value:'L',label:'L',desc:'LITR'},
    {value:'ml',label:'ml.',desc:'MILILITR'},
    {value:'mb',label:'mb',desc:'METR BIEŻĄCY'},
    {value:'m2',label:'m2',desc:'METR KWADRATOWY'},
    {value:'m3',label:'m3',desc:'METR SZEŚCIENNY'},
    {value:'szt.',label:'szt.',desc:'SZTUK'},
    {value:'A.Wa',label:'A.Wa',desc:''},
    {value:'Tuzin',label:'Tuzin',desc:''}
  ];

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

  function ensureStyle(){
    if(document.getElementById('bricoConverterUnitsStyleV49'))return;
    var s=document.createElement('style');
    s.id='bricoConverterUnitsStyleV49';
    s.textContent=''
      +'#bricoUnitGridV48 button{min-height:50px!important;padding:5px 3px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;line-height:1.05!important}'
      +'#bricoUnitGridV48 .unitMainV49{font-size:13px;font-weight:950}'
      +'#bricoUnitGridV48 small{display:block;font-size:6.8px;line-height:1.05;font-weight:850;color:var(--muted);text-align:center;white-space:normal}'
      +'#bricoUnitGridV48 button.sel small{color:inherit}';
    document.head.appendChild(s);
  }

  function applyUnits(){
    ensureStyle();
    var grid=document.getElementById('bricoUnitGridV48');
    if(!grid)return false;
    var current=[].map.call(grid.querySelectorAll('[data-unit]'),function(b){return b.getAttribute('data-unit')||''}).join('|');
    var wanted=UNITS.map(function(x){return x.value}).join('|');
    var styled=!!grid.querySelector('.unitMainV49');
    if(current===wanted&&styled)return true;
    grid.innerHTML=UNITS.map(function(x){
      return '<button type="button" data-unit="'+esc(x.value)+'"><span class="unitMainV49">'+esc(x.label)+'</span>'+(x.desc?'<small>'+esc(x.desc)+'</small>':'')+'</button>';
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

  // v48 potrafi przebudować modal; pilnujemy kolejności i opisów po interakcji.
  document.addEventListener('click',function(){setTimeout(applyUnits,0)},true);
})();
