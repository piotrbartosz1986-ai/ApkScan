(function(){
'use strict';

var STORE_KEY='brico.converters.items.v48';
var TOKEN_KEY='brico.upload.token';
var SHOP='08042';
var CONVERTERS_ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_converters.php';
var STATUS_ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_converters_status.php';
var busy=false;
var restoreHandler=null;
var timer=0;

function clean(v){return String(v==null?'':v).trim()}
function token(){try{return clean(localStorage.getItem(TOKEN_KEY)||'')}catch(e){return''}}
function items(){try{var a=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function setSendStatus(text,state){
  var e=document.getElementById('bricoConverterSendStatusV52');
  if(!e)return;
  e.textContent=text||'';
  e.style.color=state==='ok'?'#36d27f':state==='error'?'#ff6969':'var(--muted)';
}
function setStatusMsg(text,state){
  var e=document.getElementById('bricoConverterStatusMsgV53');
  if(!e)return;
  e.textContent=text||'';
  e.style.color=state==='ok'?'#36d27f':state==='error'?'#ff6969':'var(--muted)';
}
function resetNative(){
  if(timer){clearTimeout(timer);timer=0}
  if(restoreHandler!==null){window.onNativeUploadResult=restoreHandler;restoreHandler=null}
  busy=false;
}
function displayedName(code,fallback){
  var rows=[].slice.call(document.querySelectorAll('#bricoConverterListV48 .bricoConvRowV48'));
  for(var i=0;i<rows.length;i++){
    var meta=rows[i].querySelector('.bricoConvMetaV48');
    if(clean(meta&&meta.textContent)===String(code)){
      var name=rows[i].querySelector('.bricoConvNameV48');
      if(clean(name&&name.textContent))return clean(name.textContent);
    }
  }
  return clean(fallback||'');
}
function sendPayload(){
  return {
    type:'UNIT_CONVERTERS',version:1,shop:SHOP,device:'BricoScanner',created:new Date().toISOString(),
    items:items().map(function(x){
      return {ean:String(x.ean||''),name:displayedName(x.ean,x.name),unit:clean(x.unit||''),content:Number(x.content),changedAt:new Date(Number(x.lastAt)||Date.now()).toISOString()};
    })
  };
}
function clearConverters(){
  var count=items().length;
  if(!count){setSendStatus('Lista przeliczników jest już pusta.','');return}
  if(typeof window.confirm==='function'&&!window.confirm('Wyczyścić wszystkie '+count+' przeliczników?'))return;

  var guard=0;
  while(guard<10000){
    var del=document.querySelector('#bricoConverterListV48 .bricoConvDelV48');
    if(!del)break;
    var fn=del.onclick;
    if(typeof fn==='function')fn.call(del);else del.click();
    guard++;
  }

  var left=document.querySelectorAll('#bricoConverterListV48 .bricoConvRowV48').length;
  if(left===0){
    setSendStatus('Wyczyszczono listę przeliczników.','ok');
  }else{
    setSendStatus('Nie udało się wyczyścić całej listy.','error');
  }
}
function sendConverters(){
  if(busy)return;
  var list=items();
  var btn=document.getElementById('bricoConverterSendV52');
  var t=token();
  if(!list.length){setSendStatus('Lista przeliczników jest pusta.','error');return}
  if(!t){setSendStatus('Brak klucza BricoLab — ustaw go pod ⚙.','error');return}
  if(!window.BricoUpload||typeof window.BricoUpload.uploadJson!=='function'){setSendStatus('Brak natywnego modułu wysyłania.','error');return}

  busy=true;
  if(btn){btn.disabled=true;btn.textContent='WYSYŁAM…'}
  setSendStatus('Wysyłanie '+list.length+' pozycji…','');
  restoreHandler=window.onNativeUploadResult||null;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:{};
    if(server&&(server.kind==='UNIT_CONVERTERS'||server.type==='UNIT_CONVERTERS'||server.converterUpload===true)){
      var ok=!!(result&&result.ok&&server.ok);
      var err=(result&&result.error)||(server&&server.error)||(result&&result.body)||'Błąd wysyłania';
      resetNative();
      if(ok){
        setSendStatus('Wysłano '+(server.items||list.length)+' przeliczników ✓','ok');
        if(btn){btn.textContent='WYSŁANO ✓';setTimeout(function(){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'},1600)}
      }else{
        setSendStatus('BŁĄD: '+err,'error');
        if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}
      }
      return;
    }
    if(typeof restoreHandler==='function')restoreHandler(result);
  };
  try{
    window.BricoUpload.uploadJson(CONVERTERS_ENDPOINT,t,JSON.stringify(sendPayload()));
    timer=setTimeout(function(){resetNative();setSendStatus('Brak odpowiedzi serwera przeliczników.','error');if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}},20000);
  }catch(e){
    resetNative();setSendStatus('BŁĄD: '+(e.message||e),'error');if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}
  }
}
function fileFromChangedButton(btn){
  if(!btn)return'';
  var f=clean(btn.getAttribute&&btn.getAttribute('data-changed'));
  if(f)return f;
  var detail=btn.closest&&btn.closest('#bricoConverterStatusDetailV53');
  if(detail){
    var title=detail.querySelector('.convStatusFileV53');
    return clean(title&&title.textContent);
  }
  return'';
}
function refreshStatuses(){
  var close=document.getElementById('bricoConverterStatusCloseV53');
  if(close)close.click();
  setTimeout(function(){var b=document.getElementById('bricoConverterStatusBtnV53');if(b)b.click()},180);
}
function markChanged(file){
  if(busy||!file)return;
  if(typeof window.confirm==='function'&&!window.confirm('Potwierdzasz, że ceny zostały zmienione na dziale i sprawdzone?'))return;
  var t=token();
  if(!t){setStatusMsg('Brak klucza BricoLab — ustaw go pod ⚙.','error');return}
  if(!window.BricoUpload||typeof window.BricoUpload.uploadJson!=='function'){setStatusMsg('Brak natywnego modułu połączenia.','error');return}

  busy=true;
  setStatusMsg('Zapisuję status ZMIENIONE…','');
  restoreHandler=window.onNativeUploadResult||null;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:{};
    if(server&&server.kind==='UNIT_CONVERTERS_STATUS'){
      var ok=!!(result&&result.ok&&server.ok);
      var err=(result&&result.error)||(server&&server.error)||(result&&result.body)||'Błąd serwera';
      resetNative();
      if(ok){setStatusMsg('Oznaczono jako ZMIENIONE ✓','ok');setTimeout(refreshStatuses,180)}
      else setStatusMsg('BŁĄD: '+err,'error');
      return;
    }
    if(typeof restoreHandler==='function')restoreHandler(result);
  };
  try{
    window.BricoUpload.uploadJson(STATUS_ENDPOINT,t,JSON.stringify({type:'UNIT_CONVERTERS_STATUS',action:'changed',shop:SHOP,file:file}));
    timer=setTimeout(function(){resetNative();setStatusMsg('Brak odpowiedzi serwera statusów.','error')},20000);
  }catch(e){resetNative();setStatusMsg('BŁĄD: '+(e.message||e),'error')}
}

function intercept(e){
  var target=e.target&&e.target.closest?e.target.closest('#bricoConverterClearV52,#bricoConverterSendV52,.convMarkChangedV53,#convDetailChangedV53'):null;
  if(!target)return;

  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();

  if(target.id==='bricoConverterClearV52'){clearConverters();return}
  if(target.id==='bricoConverterSendV52'){sendConverters();return}
  markChanged(fileFromChangedButton(target));
}

document.addEventListener('click',intercept,true);
})();
