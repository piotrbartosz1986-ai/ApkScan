(function(){
  'use strict';

  var SECTION_ID='bricoRawMlKitV46';
  var LIST_ID='bricoRawMlKitListV46';
  var COUNT_ID='bricoRawMlKitCountV46';
  var STORE_KEY='brico.rawMlKitHistory.v46';
  var MAX_ITEMS=80;
  var history=[];

  function parse(v){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)}catch(e){return{}}}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
  function load(){
    try{
      var raw=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');
      history=Array.isArray(raw)?raw.slice(0,MAX_ITEMS):[];
    }catch(e){history=[]}
  }
  function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(history.slice(0,MAX_ITEMS)))}catch(e){}}
  function timeText(ts){
    var d=new Date(Number(ts)||Date.now());
    var p=function(v,n){return String(v).padStart(n||2,'0')};
    return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())+'.'+p(d.getMilliseconds(),3);
  }
  function ensureSection(){
    if(document.getElementById(SECTION_ID))return;
    var actions=document.querySelector('#settingsModal .settingsActions');
    if(!actions)return;
    var sec=document.createElement('section');
    sec.className='settingSec';
    sec.id=SECTION_ID;
    sec.innerHTML=''
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px">'
      +'<div class="settingTitle" style="margin:0">HISTORIA ML KIT — RAW <span id="'+COUNT_ID+'"></span></div>'
      +'<button type="button" id="bricoRawMlKitClearV46" style="min-height:26px;padding:3px 7px;font-size:8px">WYCZYŚĆ</button>'
      +'</div>'
      +'<div style="font-size:8px;color:var(--muted);line-height:1.35;margin-bottom:7px">To jest dokładnie to, co rozpozna ML Kit <b>przed ROI, wyborem formatów, kontrolą długości, cyfrą kontrolną i zasadą 3 odczytów</b>. Checkboksy niżej decydują tylko, co może wejść do listy.</div>'
      +'<div id="'+LIST_ID+'" style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel2);font:700 9px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;padding:6px"></div>';
    actions.parentNode.insertBefore(sec,actions);
    var clear=document.getElementById('bricoRawMlKitClearV46');
    if(clear)clear.onclick=function(){history=[];save();render()};
  }
  function render(){
    ensureSection();
    var list=document.getElementById(LIST_ID);
    var count=document.getElementById(COUNT_ID);
    if(count)count.textContent='('+history.length+')';
    if(!list)return;
    if(!history.length){
      list.innerHTML='<div style="color:var(--muted);font-weight:600">Brak odczytów RAW.</div>';
      return;
    }
    list.innerHTML=history.map(function(x){
      return '<div style="padding:3px 0;border-bottom:1px solid var(--line)">'
        +'<span style="color:var(--muted)">'+esc(timeText(x.ts))+'</span> | '
        +'<span style="font-weight:950">'+esc(x.format||'OTHER')+'</span> | '
        +'<span>'+esc(x.value||'')+'</span>'
        +'</div>';
    }).join('');
  }
  function addRaw(x){
    if(!x||x.event!=='raw_read')return;
    history.unshift({
      ts:Number(x.rawTimestamp)||Date.now(),
      format:String(x.rawFormat||'OTHER'),
      value:String(x.rawValue==null?'':x.rawValue)
    });
    if(history.length>MAX_ITEMS)history.length=MAX_ITEMS;
    save();
    var modal=document.getElementById('settingsModal');
    if(modal&&modal.classList.contains('show'))render();
  }

  function wrapState(){
    if(window.__bricoRawMlKitWrappedV46)return;
    window.__bricoRawMlKitWrappedV46=true;
    var previous=window.onNativeScannerState;
    window.onNativeScannerState=function(payload){
      var parsed=parse(payload);
      addRaw(parsed);
      if(typeof previous==='function')return previous(payload);
    };
  }

  function boot(){
    load();
    ensureSection();
    render();
    wrapState();
    document.addEventListener('click',function(e){
      if(e.target&&e.target.id==='settingsBtn')setTimeout(render,60);
    },false);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
