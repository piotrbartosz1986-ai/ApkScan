(function(){
'use strict';

var MODE_KEY='brico.workMode.v48';
var STORE_KEY='brico.converters.items.v48';
var TOKEN_KEY='brico.upload.token';
var SHOP='08042';
var ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_converters.php';
var restoreUploadHandler=null;
var sendTimeout=0;
var brandRaf=0;

function clean(v){return String(v==null?'':v).trim()}
function mode(){try{return localStorage.getItem(MODE_KEY)==='converters'?'converters':'scanner'}catch(e){return'scanner'}}
function token(){try{return clean(localStorage.getItem(TOKEN_KEY)||'')}catch(e){return''}}
function items(){try{var a=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function isConverters(){return mode()==='converters'}
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

function ensureStyle(){
  if(document.getElementById('bricoModeFixStyleV52'))return;
  var s=document.createElement('style');
  s.id='bricoModeFixStyleV52';
  s.textContent='\
    .brand.bricoModeBrandV48{width:auto!important;max-width:none!important;min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;text-overflow:clip!important;white-space:nowrap!important}\
    #bricoConverterSendPanelV52{display:none;margin-top:7px;padding-top:7px;border-top:1px solid var(--line)}\
    #bricoConverterSendPanelV52.show{display:block}\
    #bricoConverterActionsV52{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:stretch}\
    #bricoConverterClearV52{min-width:104px;min-height:42px;font-size:10px;font-weight:950;color:var(--red)}\
    #bricoConverterSendV52{width:100%;min-height:42px;font-size:11px;font-weight:950}\
    #bricoConverterSendStatusV52{min-height:15px;margin-top:4px;font-size:8px;font-weight:800;line-height:1.35;color:var(--muted);text-align:center}\
    #bricoConverterExportV48{display:none!important}\
  ';
  document.head.appendChild(s);
}

function fitBrandNow(){
  var brand=document.querySelector('.brand');
  if(!brand)return;
  var top=brand.parentElement;
  var gear=document.getElementById('settingsBtn');
  brand.style.width='auto';
  brand.style.maxWidth='none';
  brand.style.minWidth='0';
  brand.style.flex='1 1 auto';
  if(top){
    var available=top.clientWidth-(gear?gear.offsetWidth:36)-12;
    if(available>50)brand.style.maxWidth=available+'px';
  }
  var wanted=(isConverters()?'PRZELICZNIKI':'ETYKIETY')+' ▾';
  if(brand.textContent!==wanted)brand.textContent=wanted;
  var size=17;
  brand.style.fontSize=size+'px';
  while(size>8&&brand.scrollWidth>brand.clientWidth){size-=0.25;brand.style.fontSize=size+'px'}
}
function fitBrand(){cancelAnimationFrame(brandRaf);brandRaf=requestAnimationFrame(fitBrandNow)}

function fixModeMenu(){
  var menu=document.getElementById('bricoModeMenuV48');
  if(!menu)return;
  var scanner=menu.querySelector('[data-brico-mode="scanner"]');
  var converters=menu.querySelector('[data-brico-mode="converters"]');
  if(scanner&&scanner.textContent!=='ETYKIETY')scanner.textContent='ETYKIETY';
  if(converters&&converters.textContent!=='PRZELICZNIKI')converters.textContent='PRZELICZNIKI';
}

function hideLegacyClear(){
  var converter=isConverters();
  var bottom=document.getElementById('clearBottomBtn');
  if(bottom)bottom.style.setProperty('display',converter?'none':'','important');
  if(converter){
    [].forEach.call(document.querySelectorAll('.bottomClear'),function(b){
      if(b.id!=='bricoConverterClearV52')b.style.setProperty('display','none','important');
    });
  }else{
    [].forEach.call(document.querySelectorAll('.bottomClear'),function(b){
      if(b.id!=='bricoConverterClearV52')b.style.removeProperty('display');
    });
  }
}

function ensureSendPanel(){
  var list=document.getElementById('bricoConverterListV48');
  if(!list)return false;
  var panel=document.getElementById('bricoConverterSendPanelV52');
  if(!panel){
    panel=document.createElement('div');
    panel.id='bricoConverterSendPanelV52';
    panel.innerHTML='<div id="bricoConverterActionsV52"><button type="button" class="danger" id="bricoConverterClearV52">WYCZYŚĆ</button><button type="button" class="primary" id="bricoConverterSendV52">WYŚLIJ PRZELICZNIKI</button></div><div id="bricoConverterSendStatusV52"></div>';
    list.insertAdjacentElement('afterend',panel);
    document.getElementById('bricoConverterSendV52').addEventListener('click',sendConverters);
    document.getElementById('bricoConverterClearV52').addEventListener('click',clearConverters);
  }
  panel.classList.toggle('show',isConverters());
  var oldBtn=document.getElementById('convSendBtnV51');if(oldBtn)oldBtn.style.display='none';
  var oldStatus=document.getElementById('convSendStatusV51');if(oldStatus)oldStatus.style.display='none';
  hideLegacyClear();
  return true;
}

function clearConverters(){
  var count=items().length;
  if(!count){setStatus('Lista przeliczników jest już pusta.','');return}
  if(typeof window.confirm==='function'&&!window.confirm('Wyczyścić wszystkie '+count+' przeliczników?'))return;
  var guard=0;
  while(guard<10000){
    var del=document.querySelector('#bricoConverterListV48 .bricoConvDelV48');
    if(!del)break;
    del.click();
    guard++;
  }
  setStatus('Wyczyszczono listę przeliczników.','ok');
}

function setStatus(text,state){
  var e=document.getElementById('bricoConverterSendStatusV52');if(!e)return;
  e.textContent=text||'';
  e.style.color=state==='ok'?'#36d27f':state==='error'?'#ff6969':'var(--muted)';
}
function restoreHandler(){
  if(sendTimeout){clearTimeout(sendTimeout);sendTimeout=0}
  if(restoreUploadHandler!==null){window.onNativeUploadResult=restoreUploadHandler;restoreUploadHandler=null}
}
function payload(){
  return {
    type:'UNIT_CONVERTERS',version:1,shop:SHOP,device:'BricoScanner',created:new Date().toISOString(),
    items:items().map(function(x){return {ean:String(x.ean||''),name:displayedName(x.ean,x.name),unit:clean(x.unit||''),content:Number(x.content),changedAt:new Date(Number(x.lastAt)||Date.now()).toISOString()}})
  };
}
function finishSend(result){
  var btn=document.getElementById('bricoConverterSendV52');
  var server=result&&result.server?result.server:{};
  if(result&&result.ok&&server&&server.ok){
    setStatus('Wysłano '+(server.items||items().length)+' przeliczników ✓','ok');
    if(btn){btn.textContent='WYSŁANO ✓';setTimeout(function(){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'},1600)}
  }else{
    var msg=(result&&result.error)||(server&&server.error)||(result&&result.body)||'Błąd wysyłania';
    setStatus('BŁĄD: '+msg,'error');
    if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}
  }
  restoreHandler();
}
function sendConverters(){
  var list=items(),btn=document.getElementById('bricoConverterSendV52'),t=token();
  if(!list.length){setStatus('Lista przeliczników jest pusta.','error');return}
  if(!t){setStatus('Brak klucza BricoLab — ustaw go pod ⚙.','error');return}
  if(!window.BricoUpload||typeof window.BricoUpload.uploadJson!=='function'){setStatus('Brak natywnego modułu wysyłania.','error');return}
  btn.disabled=true;btn.textContent='WYSYŁAM…';setStatus('Wysyłanie '+list.length+' pozycji…','');
  restoreUploadHandler=window.onNativeUploadResult||null;
  window.onNativeUploadResult=function(result){
    var s=result&&result.server;
    if(s&&(s.kind==='UNIT_CONVERTERS'||s.type==='UNIT_CONVERTERS'||s.converterUpload===true)){finishSend(result);return}
    if(typeof restoreUploadHandler==='function')restoreUploadHandler(result);
  };
  try{
    window.BricoUpload.uploadJson(ENDPOINT,t,JSON.stringify(payload()));
    sendTimeout=setTimeout(function(){setStatus('Brak odpowiedzi serwera przeliczników.','error');if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}restoreHandler()},20000);
  }catch(e){setStatus('BŁĄD: '+(e.message||e),'error');btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI';restoreHandler()}
}

function refresh(){ensureStyle();fixModeMenu();ensureSendPanel();hideLegacyClear();fitBrand()}
function boot(){
  refresh();
  var brand=document.querySelector('.brand');
  if(brand&&window.MutationObserver)new MutationObserver(refresh).observe(brand,{childList:true,characterData:true,subtree:true});
  var menu=document.getElementById('bricoModeMenuV48');
  if(menu&&window.MutationObserver)new MutationObserver(function(){fixModeMenu();fitBrand()}).observe(menu,{childList:true,subtree:true,characterData:true});
  var list=document.getElementById('bricoConverterListV48');
  if(list&&window.MutationObserver)new MutationObserver(function(){ensureSendPanel();hideLegacyClear();fitBrand()}).observe(list,{childList:true,subtree:true});
  if(window.ResizeObserver&&brand)new ResizeObserver(fitBrand).observe(brand.parentElement||brand);
  document.addEventListener('click',function(){setTimeout(refresh,0)},true);
  window.addEventListener('resize',fitBrand);
  setTimeout(refresh,250);setTimeout(refresh,900);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
