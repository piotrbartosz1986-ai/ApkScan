(function(){
  'use strict';

  var MODE_KEY='brico.workMode.v48';
  var STORE_KEY='brico.converters.items.v48';
  var MODE_SCANNER='scanner';
  var MODE_CONVERTERS='converters';
  var UNITS=['szt.','l','ml','kg','g','m','mb','m²','m³'];
  var DB_NAME='BricoScannerProductsV1';
  var PRODUCT_STORE='products';

  var mode=loadMode();
  var items=loadItems();
  var pending=null;
  var originalBarcode=null;
  var localDbPromise=null;
  var brandBaseWidth=0;

  function clean(v){return String(v==null?'':v).trim()}
  function loadMode(){try{return localStorage.getItem(MODE_KEY)===MODE_CONVERTERS?MODE_CONVERTERS:MODE_SCANNER}catch(e){return MODE_SCANNER}}
  function saveMode(){try{localStorage.setItem(MODE_KEY,mode)}catch(e){}}
  function loadItems(){
    try{
      var raw=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');
      if(!Array.isArray(raw))return[];
      return raw.filter(function(x){return x&&/^(\d{8}|\d{13})$/.test(String(x.ean||''))&&clean(x.unit)&&Number(x.content)>0})
        .map(function(x){return {ean:String(x.ean),unit:clean(x.unit),content:Number(x.content),name:clean(x.name||''),lastAt:Number(x.lastAt)||Date.now()}});
    }catch(e){return[]}
  }
  function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(items))}catch(e){}}

  function bridge(){return window.NativeScanner||null}
  function call(name){
    var b=bridge();if(!b||typeof b[name]!=='function')return null;
    try{return b[name].apply(b,[].slice.call(arguments,1))}catch(e){return null}
  }
  function parseState(){var v=call('getState');if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)}catch(e){return{}}}
  function pauseScanner(v){var s=parseState();if(s&&s.running)call('setPaused',!!v)}
  function resumeAfterModal(){
    var single=document.getElementById('modeSingle');
    var isSingle=!!(single&&single.classList.contains('sel'));
    if(!isSingle)pauseScanner(false);
  }

  function ensureStyle(){
    if(document.getElementById('bricoConvertersStyleV48'))return;
    var s=document.createElement('style');
    s.id='bricoConvertersStyleV48';
    s.textContent='\
      .brand.bricoModeBrandV48{display:block!important;height:30px!important;min-height:30px!important;line-height:30px!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;color:var(--text)!important;text-align:left!important;font-weight:950!important;letter-spacing:-.02em!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;cursor:pointer!important;box-shadow:none!important}\
      #bricoModeMenuV48{position:fixed;z-index:2800;display:none;min-width:165px;padding:5px;background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:0 8px 28px rgba(0,0,0,.36)}\
      #bricoModeMenuV48.show{display:grid;gap:4px}\
      #bricoModeMenuV48 button{min-height:34px;text-align:left;font-size:10px}\
      #bricoModeMenuV48 button.sel{color:var(--green);border-color:#355845;background:#213229}\
      #bricoConverterListV48{display:none;flex-direction:column;gap:4px}\
      #bricoConverterListV48.show{display:flex}\
      .bricoConvRowV48{display:grid;grid-template-columns:minmax(0,1fr) auto 29px;gap:5px;align-items:center;padding:6px;border:1px solid var(--line);border-radius:9px;background:var(--panel2);min-height:44px}\
      .bricoConvNameV48{font-size:12px;font-weight:900;line-height:1.15;white-space:normal;overflow-wrap:anywhere}\
      .bricoConvMetaV48{margin-top:2px;font-size:9px;color:var(--muted);font-weight:750}\
      .bricoConvValueV48{font-size:12px;font-weight:950;white-space:nowrap;padding:0 4px}\
      .bricoConvEditV48,.bricoConvDelV48{min-height:28px;padding:0 7px;font-size:9px}\
      .bricoConvDelV48{padding:0;color:var(--red)}\
      #bricoConverterModalV48{position:fixed;inset:0;z-index:2900;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.76);padding:14px}\
      #bricoConverterModalV48.show{display:flex}\
      #bricoConverterModalV48 .boxV48{width:min(410px,100%);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:12px}\
      #bricoConverterModalV48 .titleV48{font-size:15px;font-weight:950}\
      #bricoConverterModalV48 .codeV48{margin-top:3px;font:850 12px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted)}\
      #bricoConverterModalV48 .nameV48{margin-top:4px;min-height:18px;font-size:11px;font-weight:900}\
      #bricoUnitGridV48{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:9px}\
      #bricoUnitGridV48 button{min-height:38px;font-size:12px;font-weight:950}\
      #bricoUnitGridV48 button.sel{background:#213229;border-color:#355845;color:var(--green)}\
      #bricoContentV48{width:100%;height:50px;margin-top:8px;border-radius:10px;border:1px solid var(--line);background:#0b0f13;color:var(--text);font-size:21px;font-weight:950;text-align:center;padding:6px}\
      #bricoConvErrorV48{min-height:18px;margin-top:4px;font-size:9px;font-weight:850;color:var(--red)}\
      #bricoConverterModalV48 .buttonsV48{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}\
      #bricoConverterExportV48{display:none;grid-column:1/-1}\
      html[data-brico-theme="light"] #bricoModeMenuV48,html[data-brico-theme="light"] #bricoConverterModalV48 .boxV48{background:#fff!important}\
      html[data-brico-theme="light"] #bricoContentV48{background:#fff!important;color:var(--text)!important}\
    ';
    document.head.appendChild(s);
  }

  function fitBrand(){
    var brand=document.querySelector('.brand');if(!brand)return;
    if(!brandBaseWidth){
      var r=brand.getBoundingClientRect();
      brandBaseWidth=Math.max(80,Math.ceil(r.width||115));
      brand.style.width=brandBaseWidth+'px';
      brand.style.maxWidth=brandBaseWidth+'px';
      brand.style.flex='0 0 '+brandBaseWidth+'px';
    }
    var size=17;
    brand.style.fontSize=size+'px';
    while(size>9.5&&brand.scrollWidth>brand.clientWidth){size-=0.5;brand.style.fontSize=size+'px'}
  }

  function updateBrand(){
    var brand=document.querySelector('.brand');if(!brand)return;
    brand.classList.add('bricoModeBrandV48');
    brand.setAttribute('role','button');
    brand.setAttribute('tabindex','0');
    brand.textContent=(mode===MODE_CONVERTERS?'PRZELICZNIKI':'SKANER')+' ▾';
    fitBrand();
  }

  function ensureModeMenu(){
    if(document.getElementById('bricoModeMenuV48'))return;
    var menu=document.createElement('div');menu.id='bricoModeMenuV48';
    menu.innerHTML='<button type="button" data-brico-mode="scanner">SKANER</button><button type="button" data-brico-mode="converters">PRZELICZNIKI</button>';
    document.body.appendChild(menu);
    menu.addEventListener('click',function(e){
      var btn=e.target&&e.target.closest('[data-brico-mode]');if(!btn)return;
      setMode(btn.getAttribute('data-brico-mode'));
      closeModeMenu();
    });
  }
  function openModeMenu(){
    ensureModeMenu();
    var brand=document.querySelector('.brand'),menu=document.getElementById('bricoModeMenuV48');if(!brand||!menu)return;
    var r=brand.getBoundingClientRect();
    menu.style.left=Math.max(6,r.left)+'px';menu.style.top=(r.bottom+3)+'px';
    [].forEach.call(menu.querySelectorAll('[data-brico-mode]'),function(b){b.classList.toggle('sel',b.getAttribute('data-brico-mode')===mode)});
    menu.classList.add('show');
  }
  function closeModeMenu(){var m=document.getElementById('bricoModeMenuV48');if(m)m.classList.remove('show')}
  function toggleModeMenu(){var m=document.getElementById('bricoModeMenuV48');if(m&&m.classList.contains('show'))closeModeMenu();else openModeMenu()}

  function ensureConverterList(){
    var scanList=document.getElementById('scanList');if(!scanList)return;
    if(!document.getElementById('bricoConverterListV48')){
      var list=document.createElement('div');list.id='bricoConverterListV48';
      scanList.insertAdjacentElement('afterend',list);
    }
    var grid=document.querySelector('#exportPanel .exportGrid');
    if(grid&&!document.getElementById('bricoConverterExportV48')){
      var b=document.createElement('button');b.type='button';b.id='bricoConverterExportV48';b.className='blue';b.textContent='ZAPISZ JSON — PRZELICZNIKI';b.onclick=exportConverters;grid.appendChild(b);
    }
  }

  function formatNumber(v){
    var n=Number(v);if(!Number.isFinite(n))return String(v||'');
    return n.toLocaleString('pl-PL',{maximumFractionDigits:4});
  }

  function renderConverters(){
    ensureConverterList();
    var list=document.getElementById('bricoConverterListV48');if(!list)return;
    if(!items.length){list.innerHTML='<div class="empty">Lista przeliczników jest pusta.</div>';return}
    list.innerHTML=items.map(function(x,i){
      var title=escapeHtml(x.name||x.ean);
      return '<div class="bricoConvRowV48" data-i="'+i+'"><div><div class="bricoConvNameV48">'+title+'</div><div class="bricoConvMetaV48">'+escapeHtml(x.ean)+'</div></div><div><div class="bricoConvValueV48">'+escapeHtml(formatNumber(x.content))+' '+escapeHtml(x.unit)+'</div><button type="button" class="bricoConvEditV48" data-act="edit">EDYTUJ</button></div><button type="button" class="bricoConvDelV48" data-act="del">×</button></div>';
    }).join('');
    [].forEach.call(list.querySelectorAll('.bricoConvRowV48'),function(row){
      var i=parseInt(row.getAttribute('data-i'),10);
      var edit=row.querySelector('[data-act=edit]'),del=row.querySelector('[data-act=del]');
      if(edit)edit.onclick=function(){openConverter(items[i].ean,items[i])};
      if(del)del.onclick=function(){items.splice(i,1);persist();renderConverters();updateModeUi()};
    });
  }
  function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}

  function updateModeUi(){
    updateBrand();ensureConverterList();renderConverters();
    var converter=mode===MODE_CONVERTERS;
    var scanList=document.getElementById('scanList');if(scanList)scanList.style.display=converter?'none':'';
    var conv=document.getElementById('bricoConverterListV48');if(conv)conv.classList.toggle('show',converter);
    var title=document.querySelector('.listTitle');if(title){
      if(!title.getAttribute('data-v48-original'))title.setAttribute('data-v48-original',title.textContent||'Lista kodów');
      title.textContent=converter?'Lista przeliczników':title.getAttribute('data-v48-original');
    }
    var qty=document.getElementById('qtyTotal');if(qty){
      if(!qty.getAttribute('data-v48-original'))qty.setAttribute('data-v48-original',qty.textContent||'0 szt.');
      if(converter)qty.textContent=items.length+' poz.';
    }
    var pos=document.getElementById('bricoPositionStatsV40');if(pos)pos.style.display=converter?'none':'';
    var clearTop=document.getElementById('clearTopBtn');if(clearTop)clearTop.style.display=converter?'none':'';
    var clearBottom=document.getElementById('clearBottomBtn');if(clearBottom)clearBottom.style.display=converter?'none':'';
    var qtySeg=document.getElementById('qtyAuto');qtySeg=qtySeg&&qtySeg.closest('.seg');if(qtySeg)qtySeg.style.display=converter?'none':'';
    var quick=document.querySelector('.panel.quick');if(quick)quick.style.gridTemplateColumns=converter?'1fr':'1fr 1fr';
    ['exportJsonBtn','exportExcelBtn','bricoUploadBtn'].forEach(function(id){var e=document.getElementById(id);if(e)e.style.display=converter?'none':''});
    var uploadStatus=document.getElementById('bricoUploadStatus');if(uploadStatus)uploadStatus.style.display=converter?'none':'';
    var exp=document.getElementById('bricoConverterExportV48');if(exp)exp.style.display=converter?'block':'none';
    var badge=document.getElementById('bricoDbBadgeV40');if(badge)badge.style.display='';
  }

  function setMode(next){
    next=next===MODE_CONVERTERS?MODE_CONVERTERS:MODE_SCANNER;
    if(mode===next){updateModeUi();return}
    closeConverter(false);
    mode=next;saveMode();updateModeUi();
  }

  function openLocalDb(){
    if(localDbPromise)return localDbPromise;
    localDbPromise=new Promise(function(resolve){
      try{
        var req=indexedDB.open(DB_NAME);
        req.onsuccess=function(){var db=req.result;if(!db.objectStoreNames.contains(PRODUCT_STORE)){try{db.close()}catch(e){};resolve(null);return}resolve(db)};
        req.onerror=function(){resolve(null)};
        req.onupgradeneeded=function(){try{req.transaction.abort()}catch(e){}};
      }catch(e){resolve(null)}
    });
    return localDbPromise;
  }
  async function getLocalProduct(ean){
    var db=await openLocalDb();if(!db)return null;
    return await new Promise(function(resolve){
      try{var tx=db.transaction(PRODUCT_STORE,'readonly');var r=tx.objectStore(PRODUCT_STORE).get(ean);r.onsuccess=function(){resolve(r.result||null)};r.onerror=function(){resolve(null)}}catch(e){resolve(null)}
    });
  }

  function ensureConverterModal(){
    if(document.getElementById('bricoConverterModalV48'))return;
    var m=document.createElement('div');m.id='bricoConverterModalV48';
    m.innerHTML='<div class="boxV48"><div class="titleV48">Przelicznik produktu</div><div class="codeV48" id="bricoConvCodeV48">—</div><div class="nameV48" id="bricoConvNameV48">Sprawdzam produkt…</div><div id="bricoUnitGridV48"></div><input id="bricoContentV48" type="text" inputmode="decimal" autocomplete="off" placeholder="Ile zawiera produkt? np. 0,33"><div id="bricoConvErrorV48"></div><div class="buttonsV48"><button type="button" id="bricoConvCancelV48">ANULUJ</button><button type="button" class="primary" id="bricoConvSaveV48">ZAPISZ</button></div></div>';
    document.body.appendChild(m);
    var grid=document.getElementById('bricoUnitGridV48');
    grid.innerHTML=UNITS.map(function(u){return '<button type="button" data-unit="'+escapeHtml(u)+'">'+escapeHtml(u)+'</button>'}).join('');
    grid.addEventListener('click',function(e){var b=e.target&&e.target.closest('[data-unit]');if(!b||!pending)return;pending.unit=b.getAttribute('data-unit');paintUnits();var input=document.getElementById('bricoContentV48');if(input)setTimeout(function(){input.focus()},20)});
    document.getElementById('bricoConvCancelV48').onclick=function(){closeConverter(true)};
    document.getElementById('bricoConvSaveV48').onclick=saveConverter;
    document.getElementById('bricoContentV48').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();saveConverter()}if(e.key==='Escape'){e.preventDefault();closeConverter(true)}});
    m.addEventListener('click',function(e){if(e.target===m)closeConverter(true)});
  }
  function paintUnits(){
    var grid=document.getElementById('bricoUnitGridV48');if(!grid)return;
    [].forEach.call(grid.querySelectorAll('[data-unit]'),function(b){b.classList.toggle('sel',!!pending&&b.getAttribute('data-unit')===pending.unit)});
  }

  function openConverter(ean,existing){
    ensureConverterModal();
    pauseScanner(true);
    var current=existing||items.find(function(x){return x.ean===ean})||null;
    pending={ean:ean,unit:current?current.unit:'',content:current?current.content:'',name:current?current.name:'',lastAt:Date.now()};
    document.getElementById('bricoConvCodeV48').textContent=ean;
    document.getElementById('bricoConvNameV48').textContent=pending.name||'Sprawdzam produkt…';
    document.getElementById('bricoContentV48').value=current?String(current.content).replace('.',','):'';
    document.getElementById('bricoConvErrorV48').textContent='';
    paintUnits();
    document.getElementById('bricoConverterModalV48').classList.add('show');
    getLocalProduct(ean).then(function(p){
      if(!pending||pending.ean!==ean)return;
      var name=p&&clean(p.name||'');
      if(name){pending.name=name;document.getElementById('bricoConvNameV48').textContent=name}
      else document.getElementById('bricoConvNameV48').textContent='Produkt '+ean;
    });
  }
  function closeConverter(resume){
    var m=document.getElementById('bricoConverterModalV48');if(m)m.classList.remove('show');
    pending=null;if(resume)resumeAfterModal();
  }
  function saveConverter(){
    if(!pending)return;
    var err=document.getElementById('bricoConvErrorV48');
    if(!pending.unit){if(err)err.textContent='Wybierz jednostkę.';return}
    var raw=clean(document.getElementById('bricoContentV48').value).replace(',','.');
    var val=Number(raw);
    if(!Number.isFinite(val)||val<=0){if(err)err.textContent='Wpisz poprawną wartość większą od 0.';return}
    var obj={ean:pending.ean,unit:pending.unit,content:val,name:pending.name||'',lastAt:Date.now()};
    var i=items.findIndex(function(x){return x.ean===obj.ean});
    if(i>=0)items[i]=obj;else items.unshift(obj);
    persist();renderConverters();updateModeUi();closeConverter(true);
  }

  function toBase64Utf8(text){
    var bytes=new TextEncoder().encode(text),binary='',chunk=0x8000;
    for(var i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));
    return btoa(binary);
  }
  function stamp(){var d=new Date(),p=function(v){return String(v).padStart(2,'0')};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'_'+p(d.getHours())+'-'+p(d.getMinutes())+'-'+p(d.getSeconds())}
  function toast(msg){var e=document.getElementById('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(function(){e.classList.remove('show')},2200)}
  function exportConverters(){
    if(!items.length){toast('Lista przeliczników jest pusta.');return}
    var payload={type:'UNIT_CONVERTERS',version:1,source:'BricoScanner',createdAt:new Date().toISOString(),items:items.map(function(x){return {ean:x.ean,unit:x.unit,content:x.content}})};
    var b=bridge();
    if(b&&typeof b.saveFile==='function'){
      try{b.saveFile('bricolab_przeliczniki_'+stamp()+'.json','application/json',toBase64Utf8(JSON.stringify(payload,null,2)));toast('Zapisuję JSON przeliczników…');return}catch(e){}
    }
    try{
      var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bricolab_przeliczniki_'+stamp()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
    }catch(e){toast('Nie udało się zapisać pliku.')}
  }

  function installBarcodeWrapper(){
    if(window.__bricoConvertersWrappedV48)return;
    if(typeof window.onNativeBarcode!=='function')return false;
    originalBarcode=window.onNativeBarcode;
    window.onNativeBarcode=function(payload){
      if(mode!==MODE_CONVERTERS)return originalBarcode(payload);
      var x=payload;if(typeof x==='string'){try{x=JSON.parse(x)}catch(e){x={}}}
      x=x||{};var code=clean(x.code||'');
      if(!/^(\d{8}|\d{13})$/.test(code))return;
      if(pending)return;
      openConverter(code,null);
    };
    window.__bricoConvertersWrappedV48=true;
    return true;
  }

  function boot(){
    ensureStyle();ensureModeMenu();ensureConverterList();ensureConverterModal();
    var brand=document.querySelector('.brand');
    if(brand){
      brand.addEventListener('click',function(e){e.preventDefault();toggleModeMenu()});
      brand.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleModeMenu()}});
    }
    document.addEventListener('click',function(e){var m=document.getElementById('bricoModeMenuV48');if(!m||!m.classList.contains('show'))return;if((brand&&brand.contains(e.target))||m.contains(e.target))return;closeModeMenu()},true);
    updateModeUi();
    if(!installBarcodeWrapper()){
      var tries=0,t=setInterval(function(){tries++;if(installBarcodeWrapper()||tries>50)clearInterval(t)},100);
    }
    setTimeout(updateModeUi,250);setTimeout(updateModeUi,900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
