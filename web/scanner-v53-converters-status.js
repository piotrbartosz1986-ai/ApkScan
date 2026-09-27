(function(){
'use strict';

var MODE_KEY='brico.workMode.v48';
var TOKEN_KEY='brico.upload.token';
var SHOP='08042';
var ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_converters_status.php';
var requestBusy=false;
var savedUploadHandler=null;
var requestTimer=0;
var lastLists=[];
var currentDetail=null;
var countdownTimer=0;

function clean(v){return String(v==null?'':v).trim()}
function mode(){try{return localStorage.getItem(MODE_KEY)==='converters'?'converters':'scanner'}catch(e){return'scanner'}}
function token(){try{return clean(localStorage.getItem(TOKEN_KEY)||'')}catch(e){return''}}
function isConverters(){return mode()==='converters'}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
function fmtDate(v){if(!v)return'—';var d=new Date(v);if(isNaN(d.getTime()))return String(v);return d.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function fmtNum(v){var n=Number(v);return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:4}):String(v||'')}
function normalizedStatus(s){s=String(s||'NEW').toUpperCase();return s==='PREPARED'?'READY':s}
function statusLabel(s){s=normalizedStatus(s);return s==='READY'?'DO ZMIANY':s==='CHANGED'?'ZAKOŃCZONE':'NOWE'}
function statusClass(s){s=normalizedStatus(s);return s==='READY'?'ready':s==='CHANGED'?'changed':'new'}
function titleOf(x){
  if(!x)return'';
  var title=clean(x.title);if(title)return title;
  var parts=[clean(x.subject),clean(x.worker),clean(x.department)].filter(Boolean);
  return parts.length?parts.join(' — '):clean(x.file);
}
function secondaryOf(x){
  if(!x)return'';
  var parts=[];
  if(clean(x.worker)&&titleOf(x).indexOf(clean(x.worker))<0)parts.push(clean(x.worker));
  if(clean(x.department)&&titleOf(x).indexOf(clean(x.department))<0)parts.push(clean(x.department));
  parts.push(fmtDate(x.received||x.created));
  parts.push(String(x.count!=null?x.count:(Array.isArray(x.items)?x.items.length:0))+' poz.');
  return parts.join(' • ');
}
function secondsFrom(x,kind){
  if(!x)return 0;
  var direct=Number(kind==='changed'?x.undoChangedSeconds:x.undoReadySeconds);
  if(Number.isFinite(direct)&&direct>0)return Math.ceil(direct);
  var info=x.statusInfo||{};
  var iso=kind==='changed'?(x.changedAt||info.changedAt):(x.readyAt||info.readyAt);
  if(!iso)return 0;
  var ts=new Date(iso).getTime();if(!Number.isFinite(ts))return 0;
  return Math.max(0,Math.ceil((ts+60000-Date.now())/1000));
}

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
    .convStatusFileV53{font-size:10px;font-weight:950;overflow-wrap:anywhere}\
    .convStatusMetaV53{margin-top:3px;font-size:8px;color:var(--muted)}\
    .convStatusBadgeV53{display:inline-flex;align-items:center;justify-content:center;padding:4px 7px;border:1px solid currentColor;border-radius:999px;font-size:8px;font-weight:950}\
    .convStatusBadgeV53.new{color:#9aa5b1}.convStatusBadgeV53.ready{color:#ffad42}.convStatusBadgeV53.changed{color:#36d27f}\
    .convStatusActionsV53{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:7px}\
    .convStatusActionsV53 button{min-height:32px;font-size:9px}\
    .convMarkChangedV53{color:#07140d!important;background:#ffad42!important;border-color:transparent!important;font-weight:950!important}\
    .convUndoV53{font-weight:950!important}\
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
  m.innerHTML='<div class="boxV53"><div class="topV53"><div class="titleV53">Listy przeliczników</div><button type="button" class="closeV53" id="bricoConverterStatusCloseV53">×</button></div><div class="hintV53">NOWE — czeka na informatyka · DO ZMIANY — wykonaj zmianę na dziale · ZAKOŃCZONE — zmiana wykonana i sprawdzona. Ostatnią zmianę statusu można cofnąć przez 60 sekund.</div><div id="bricoConverterStatusListV53"></div><div id="bricoConverterStatusDetailV53"></div><div id="bricoConverterStatusMsgV53"></div></div>';
  document.body.appendChild(m);
  document.getElementById('bricoConverterStatusCloseV53').onclick=closeModal;
  m.addEventListener('click',function(e){if(e.target===m)closeModal()});
}
function setMsg(t,state){var e=document.getElementById('bricoConverterStatusMsgV53');if(!e)return;e.textContent=t||'';e.style.color=state==='ok'?'#36d27f':state==='error'?'#ff6969':'var(--muted)'}
function openModal(){ensureUi();var m=document.getElementById('bricoConverterStatusModalV53');if(m)m.classList.add('show');showList();loadList();startCountdown()}
function closeModal(){var m=document.getElementById('bricoConverterStatusModalV53');if(m)m.classList.remove('show');currentDetail=null;stopCountdown()}
function stopCountdown(){if(countdownTimer){clearInterval(countdownTimer);countdownTimer=0}}
function startCountdown(){stopCountdown();countdownTimer=setInterval(function(){var m=document.getElementById('bricoConverterStatusModalV53');if(!m||!m.classList.contains('show')){stopCountdown();return}if(currentDetail)renderDetail();else renderList()},1000)}

function finishRequest(){
  if(requestTimer){clearTimeout(requestTimer);requestTimer=0}
  window.onNativeUploadResult=savedUploadHandler;
  savedUploadHandler=null;
  requestBusy=false;
}
function request(payload,onOk){
  var t=token();
  if(!t){setMsg('Brak klucza BricoLab — ustaw go pod ⚙.','error');return}
  if(!window.BricoUpload||typeof window.BricoUpload.uploadJson!=='function'){setMsg('Brak natywnego modułu połączenia.','error');return}
  if(requestBusy){setMsg('Trwa poprzednie zapytanie…','');return}
  requestBusy=true;
  savedUploadHandler=typeof window.onNativeUploadResult==='function'?window.onNativeUploadResult:null;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:{};
    if(server&&server.kind==='UNIT_CONVERTERS_STATUS'){
      var ok=!!(result&&result.ok&&server.ok);
      var err=(result&&result.error)||(server&&server.error)||(result&&result.body)||'Błąd serwera';
      finishRequest();
      if(ok)onOk(server);else setMsg('BŁĄD: '+err,'error');
      return;
    }
    if(typeof savedUploadHandler==='function')savedUploadHandler(result);
  };
  try{
    window.BricoUpload.uploadJson(ENDPOINT,t,JSON.stringify(payload));
    requestTimer=setTimeout(function(){finishRequest();setMsg('Brak odpowiedzi serwera statusów.','error')},20000);
  }catch(e){finishRequest();setMsg('BŁĄD: '+(e.message||e),'error')}
}
function loadList(){
  setMsg('Pobieram statusy…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'list',shop:SHOP},function(s){lastLists=Array.isArray(s.lists)?s.lists:[];showList();renderList();setMsg(lastLists.length?'':'Brak wysłanych list.','');updateStatusButton(s.ready||0)})
}
function updateStatusButton(ready){var b=document.getElementById('bricoConverterStatusBtnV53');if(!b)return;b.textContent=Number(ready)>0?'LISTY / STATUSY • DO ZMIANY '+ready:'LISTY / STATUSY'}
function showList(){var l=document.getElementById('bricoConverterStatusListV53'),d=document.getElementById('bricoConverterStatusDetailV53');if(l)l.style.display='flex';if(d)d.style.display='none';currentDetail=null}
function renderList(){
  var el=document.getElementById('bricoConverterStatusListV53');if(!el)return;
  if(!lastLists.length){el.innerHTML='<div class="empty">Nie ma jeszcze wysłanych list.</div>';return}
  el.innerHTML=lastLists.map(function(x){
    var st=normalizedStatus(x.status),undo=st==='CHANGED'?secondsFrom(x,'changed'):0;
    return '<div class="convStatusRowV53"><div class="convStatusHeadV53"><div><div class="convStatusFileV53">'+esc(titleOf(x))+'</div><div class="convStatusMetaV53">'+esc(secondaryOf(x))+'</div></div><span class="convStatusBadgeV53 '+statusClass(st)+'">'+statusLabel(st)+'</span></div><div class="convStatusActionsV53"><button type="button" data-detail="'+esc(x.file)+'">👁 PODGLĄD</button>'+(st==='READY'?'<button type="button" class="convMarkChangedV53" data-complete="'+esc(x.file)+'">ZAKOŃCZ</button>':undo>0?'<button type="button" class="convUndoV53" data-undo="'+esc(x.file)+'">COFNIJ '+undo+' s</button>':'')+'</div></div>';
  }).join('');
  [].forEach.call(el.querySelectorAll('[data-detail]'),function(b){b.onclick=function(){loadDetail(b.getAttribute('data-detail'))}});
  [].forEach.call(el.querySelectorAll('[data-complete]'),function(b){b.onclick=function(){markCompleted(b.getAttribute('data-complete'))}});
  [].forEach.call(el.querySelectorAll('[data-undo]'),function(b){b.onclick=function(){undoCompleted(b.getAttribute('data-undo'))}});
}
function loadDetail(file){
  setMsg('Pobieram listę…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'detail',shop:SHOP,file:file},function(s){currentDetail=s.list||null;renderDetail();setMsg('','')})
}
function renderDetail(){
  if(!currentDetail)return;
  var l=document.getElementById('bricoConverterStatusListV53'),d=document.getElementById('bricoConverterStatusDetailV53');if(!l||!d)return;
  l.style.display='none';d.style.display='block';
  var x=currentDetail,st=normalizedStatus(x.status),arr=Array.isArray(x.items)?x.items:[],undo=st==='CHANGED'?secondsFrom(x,'changed'):0;
  d.innerHTML='<button type="button" class="convDetailBackV53" id="convDetailBackV53">← LISTY</button><div class="convStatusHeadV53"><div><div class="convStatusFileV53">'+esc(titleOf(x))+'</div><div class="convDetailInfoV53">'+esc(secondaryOf(x))+'</div></div><span class="convStatusBadgeV53 '+statusClass(st)+'">'+statusLabel(st)+'</span></div>'+(st==='READY'?'<button type="button" class="convMarkChangedV53" id="convDetailChangedV53" style="width:100%;min-height:36px;margin:6px 0">OZNACZ JAKO ZAKOŃCZONE</button>':undo>0?'<button type="button" class="convUndoV53" id="convDetailUndoV53" style="width:100%;min-height:36px;margin:6px 0">COFNIJ DO „DO ZMIANY” · '+undo+' s</button>':'')+'<div>'+arr.map(function(i){return '<div class="convDetailItemV53"><div><div class="convDetailNameV53">'+esc(i.name||('Produkt '+(i.ean||'')))+'</div><div class="convDetailEanV53">'+esc(i.ean||'')+'</div></div><div class="convDetailValueV53">'+esc(fmtNum(i.content))+' '+esc(i.unit||'')+'</div></div>'}).join('')+'</div>';
  document.getElementById('convDetailBackV53').onclick=function(){showList();renderList()};
  var c=document.getElementById('convDetailChangedV53');if(c)c.onclick=function(){markCompleted(x.file)};
  var u=document.getElementById('convDetailUndoV53');if(u)u.onclick=function(){undoCompleted(x.file)};
}
function markCompleted(file){
  file=clean(file);if(!file)return;
  setMsg('Zapisuję status ZAKOŃCZONE…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'changed',shop:SHOP,file:file},function(){setMsg('Lista oznaczona jako ZAKOŃCZONE ✓','ok');loadList()})
}
function undoCompleted(file){
  file=clean(file);if(!file)return;
  setMsg('Cofam status…','');
  request({type:'UNIT_CONVERTERS_STATUS',action:'undo_changed',shop:SHOP,file:file},function(){setMsg('Cofnięto do DO ZMIANY ✓','ok');loadList()})
}
function refresh(){ensureStyle();ensureUi()}
function boot(){refresh();document.addEventListener('click',function(){setTimeout(refresh,0)},true);setTimeout(refresh,250);setTimeout(refresh,900)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
