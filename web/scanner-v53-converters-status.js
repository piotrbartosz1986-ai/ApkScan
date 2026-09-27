(function(){
'use strict';

var MODE_KEY='brico.workMode.v48';
var TOKEN_KEY='brico.upload.token';
var SHOP='08042';
var ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_converters_status.php';
var requestRestore=null;
var requestTimer=0;
var lastLists=[];
var currentDetail=null;

function clean(v){return String(v==null?'':v).trim()}
function mode(){try{return localStorage.getItem(MODE_KEY)==='converters'?'converters':'scanner'}catch(e){return'scanner'}}
function token(){try{return clean(localStorage.getItem(TOKEN_KEY)||'')}catch(e){return''}}
function isConverters(){return mode()==='converters'}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
function fmtDate(v){
  if(!v)return'—';
  var d=new Date(v);if(isNaN(d.getTime()))return String(v);
  return d.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function fmtNum(v){var n=Number(v);return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:4}):String(v||'')}
function statusLabel(s){s=String(s||'NEW').toUpperCase();if(s==='PREPARED')s='READY';return s==='READY'?'GOTOWE':s==='CHANGED'?'ZMIENIONE':'NOWE'}
function statusClass(s){s=String(s||'NEW').toUpperCase();if(s==='PREPARED')s='READY';return s==='READY'?'ready':s==='CHANGED'?'changed':'new'}

function ensureStyle(){
  if(document.getElementById('bricoConvertersStatusStyleV53'))return;
  var s=document.createElement('style');s.id='bricoConvertersStatusStyleV53';
  s.textContent='\
    #bricoConverterStatusBtnV53{width:100%;min-height:36px;margin-top:5px;font-size:10px;font-weight:950}\
    #bricoConverterStatusModalV53{position:fixed;inset:0;z-index:3200;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.72)}\
    #bricoConverterStatusModalV53.show{display:flex}\
    #bricoConverterStatusModalV53 .boxV53{width:min(680px,100%);max-height:92dvh;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:18px 18px 0 0;padding:12px 12px calc(12px + env(safe-area-inset-bottom))}\
    #bricoConverterStatusModalV53 .topV53{position:sticky;top:-12px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-12px -12px 8px;padding:10px 12px;background:var(--panel);border-bottom:1px solid var(--line)}\
    #bricoConverterStatusModalV53 .titleV53{font-size:15px;font-weight:950}\
    #bricoConverterStatusModalV53 .closeV53{width:36px;min-height:32px;padding:0;font-size:17px}\
    #bricoConverterStatusModalV53 .hintV53{font-size:9px;color:var(--muted);line-height:1.35;margin-bottom:7px}\
    #bricoConverterStatusListV53{display:flex;flex-direction:column;gap:6px}\
    .convStatusRowV53{border:1px solid var(--line);border-radius:11px;background:var(--panel2);padding:8px}\
    .convStatusHeadV53{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}\
    .convStatusFileV53{font-size:9px;font-weight:900;overflow-wrap:anywhere}\
    .convStatusMetaV53{margin-top:3px;font-size:8px;color:var(--muted)}\
    .convStatusBadgeV53{display:inline-flex;align-items:center;justify-content:center;padding:4px 7px;border:1px solid var(--line);border-radius:999px;font-size:8px;font-weight:950}\
    .convStatusBadgeV53.new{color:#5aa9ff}.convStatusBadgeV53.ready{color:#36d27f}.convStatusBadgeV53.changed{color:var(--muted)}\
    .convStatusActionsV53{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:7px}\
    .convStatusActionsV53 button{min-height:32px;font-size:9px}\
    .convMarkChangedV53{color:#07140d!important;background:var(--green)!important;border-color:transparent!important;font-weight:950!important}\
    #bricoConverterStatusDetailV53{display:none}.convDetailBackV53{margin-bottom:7px}.convDetailInfoV53{font-size:9px;color:var(--muted);margin-bottom:7px}\
    .convDetailItemV53{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding:7px 0;border-bottom:1px solid var(--line)}\
    .convDetailItemV53:last-child{border-bottom:0}.convDetailNameV53{font-size:10px;font-weight:900}.convDetailEanV53{font-size:8px;color:var(--muted);margin-top:2px}.convDetailValueV53{font-size:10px;font-weight:950;white-space:nowrap}\
    #bricoConverterStatusMsgV53{min-height:17px;margin-top:6px;font-size:9px;font-weight:850;text-align:center}\
  ';
  document.head.appendChild(s);
}

function ensureUi(){
  var panel=document.getElementById('bricoConverterSendPanelV52');
  if(panel&&!document.getElementById('bricoConverterStatusBtnV53')){
    var b=document.createElement('button');b.type='button';b.id='bricoConverterStatusBtnV53';b.textContent='LISTY / STATUSY';b.addEventListener('click',openModal);panel.appendChild(b);
  }
  var b2=document.getElementById('bricoConverterStatusBtnV53');if(b2)b2.style.display=isConverters()?'block':'none';
  if(document.getElementById('bricoConverterStatusModalV53'))return;
  var m=document.createElement('div');m.id='bricoConverterStatusModalV53';
  m.innerHTML='<div class="boxV53"><div class="topV53"><div class="titleV53">Listy przeliczników</div><button type="button" class="closeV53" id="bricoConverterStatusCloseV53">×</button></div><div class="hintV53">NOWE — czeka na informatyka · GOTOWE — możesz zmienić ceny na dziale · ZMIENIONE — potwierdzone po wykonaniu</div><div id="bricoConverterStatusListV53"></div><div id="bricoConverterStatusDetailV53"></div><div id="bricoConverterStatusMsgV53"></div></div>';
  document.body.appendChild(m);
  document.getElementById('bricoConverterStatusCloseV53').onclick=closeModal;
  m.addEventListener('click',function(e){if(e.target===m)closeModal()});
}
function setMsg(t,state){var e=document.getElementById('bricoConverterStatusMsgV53');if(!e)return;e.textContent=t||'';e.style.color=state==='ok'?'#36d27f':state==='error'?'#ff6969':'var(--muted)'}
function openModal(){ensureUi();var m=document.getElementById('bricoConverterStatusModalV53');if(m)m.classList.add('show');showList();loadList()}
function closeModal(){var m=document.getElementById('bricoConverterStatusModalV53');if(m)m.classList.remove('show');currentDetail=null}

function restoreHandler(){
  if(requestTimer){clearTimeout(requestTimer);requestTimer=0}
  if(requestRestore!==null){window.onNativeUploadResult=requestRestore;requestRestore=null}
}
function request(payload,onOk){
  var t=token();
  if(!t){setMsg('Brak klucza BricoLab — ustaw go pod ⚙.','error');return}
  if(!window.BricoUpload||typeof window.BricoUpload.uploadJson!=='function'){setMsg('Brak natywnego modułu połączenia.','error');return}
  if(requestRestore!==null){setMsg('Trwa poprzednie zapytanie…','');return}
  requestRestore=window.onNativeUploadResult||null;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:{};
    if(server&&server.kind==='UNIT_CONVERTERS_STATUS'){
      var ok=!!(result&&result.ok&&server.ok);
      var err=(result&&result.error)||(server&&server.error)||(result&&result.body)||'Błąd serwera';
      restoreHandler();
      if(ok)onOk(server);else setMsg('BŁĄD: '+err,'error');
      return;
    }
    if(typeof requestRestore==='function')requestRestore(result);
  };
  try{
    window.BricoUpload.uploadJson(ENDPOINT,t,JSON.stringify(payload));
    requestTimer=setTimeout(function(){restoreHandler();setMsg('Brak odpowiedzi serwera statusów.','error')},20000);
  }catch(e){restoreHandler();setMsg('BŁĄD: '+(e.message||e),'error')}
}
function loadList(){
  setMsg('Pobieram statusy…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'list',shop:SHOP},function(s){lastLists=Array.isArray(s.lists)?s.lists:[];renderList();setMsg(lastLists.length?'':'Brak wysłanych list.','');updateStatusButton(s.ready||0)})
}
function updateStatusButton(ready){var b=document.getElementById('bricoConverterStatusBtnV53');if(!b)return;b.textContent=Number(ready)>0?'LISTY / STATUSY • GOTOWE '+ready:'LISTY / STATUSY'}
function showList(){var l=document.getElementById('bricoConverterStatusListV53'),d=document.getElementById('bricoConverterStatusDetailV53');if(l)l.style.display='flex';if(d)d.style.display='none';currentDetail=null}
function renderList(){
  var el=document.getElementById('bricoConverterStatusListV53');if(!el)return;
  if(!lastLists.length){el.innerHTML='<div class="empty">Nie ma jeszcze wysłanych list.</div>';return}
  el.innerHTML=lastLists.map(function(x){
    var st=String(x.status||'NEW').toUpperCase();if(st==='PREPARED')st='READY';
    return '<div class="convStatusRowV53"><div class="convStatusHeadV53"><div><div class="convStatusFileV53">'+esc(x.file)+'</div><div class="convStatusMetaV53">'+esc(fmtDate(x.received||x.created))+' • '+esc(x.count)+' poz.</div></div><span class="convStatusBadgeV53 '+statusClass(st)+'">'+statusLabel(st)+'</span></div><div class="convStatusActionsV53"><button type="button" data-detail="'+esc(x.file)+'">👁 PODGLĄD</button>'+(st==='READY'?'<button type="button" class="convMarkChangedV53" data-changed="'+esc(x.file)+'">ZMIENIONE</button>':'')+'</div></div>';
  }).join('');
  [].forEach.call(el.querySelectorAll('[data-detail]'),function(b){b.onclick=function(){loadDetail(b.getAttribute('data-detail'))}});
  [].forEach.call(el.querySelectorAll('[data-changed]'),function(b){b.onclick=function(){markChanged(b.getAttribute('data-changed'))}});
}
function loadDetail(file){
  setMsg('Pobieram listę…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'detail',shop:SHOP,file:file},function(s){currentDetail=s.list||null;renderDetail();setMsg('','')})
}
function renderDetail(){
  if(!currentDetail)return;
  var l=document.getElementById('bricoConverterStatusListV53'),d=document.getElementById('bricoConverterStatusDetailV53');if(!l||!d)return;
  l.style.display='none';d.style.display='block';
  var x=currentDetail,st=String(x.status||'NEW').toUpperCase();if(st==='PREPARED')st='READY';var arr=Array.isArray(x.items)?x.items:[];
  d.innerHTML='<button type="button" class="convDetailBackV53" id="convDetailBackV53">← LISTY</button><div class="convStatusHeadV53"><div><div class="convStatusFileV53">'+esc(x.file)+'</div><div class="convDetailInfoV53">'+esc(fmtDate(x.received||x.created))+' • '+esc(arr.length)+' poz.</div></div><span class="convStatusBadgeV53 '+statusClass(st)+'">'+statusLabel(st)+'</span></div>'+(st==='READY'?'<button type="button" class="convMarkChangedV53" id="convDetailChangedV53" style="width:100%;min-height:36px;margin:6px 0">OZNACZ JAKO ZMIENIONE</button>':'')+'<div>'+arr.map(function(i){return '<div class="convDetailItemV53"><div><div class="convDetailNameV53">'+esc(i.name||('Produkt '+(i.ean||'')))+'</div><div class="convDetailEanV53">'+esc(i.ean||'')+'</div></div><div class="convDetailValueV53">'+esc(fmtNum(i.content))+' '+esc(i.unit||'')+'</div></div>'}).join('')+'</div>';
  document.getElementById('convDetailBackV53').onclick=function(){showList();renderList()};
  var c=document.getElementById('convDetailChangedV53');if(c)c.onclick=function(){markChanged(x.file)};
}
function markChanged(file){
  if(typeof window.confirm==='function'&&!window.confirm('Potwierdzasz, że ceny zostały zmienione na dziale i sprawdzone?'))return;
  setMsg('Zapisuję status ZMIENIONE…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'changed',shop:SHOP,file:file},function(){setMsg('Oznaczono jako ZMIENIONE ✓','ok');loadList();showList()})
}

function refresh(){ensureStyle();ensureUi()}
function boot(){refresh();document.addEventListener('click',function(){setTimeout(refresh,0)},true);setTimeout(refresh,250);setTimeout(refresh,900)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
