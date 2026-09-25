(function(){
  'use strict';

  var SHOP='08042';
  var API_BASE='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_products.php?shop='+SHOP;
  var META_URL=API_BASE+'&meta=1';
  var FILE_URL=API_BASE;
  var TOKEN_KEY='brico.upload.token';
  var DB_NAME='BricoScannerProductsV1';
  var DB_VERSION=1;
  var PRODUCT_STORE='products';
  var META_STORE='meta';
  var META_KEY='current';

  var dbPromise=null;
  var syncPromise=null;
  var databaseReady=false;
  var databaseMeta=null;
  var hotCache=new Map();
  var lastRequestedEan='';

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]})}
  function cleanEan(v){return String(v==null?'':v).replace(/\D/g,'')}
  function numOr(v,fallback){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n:fallback}
  function money(v){var n=Number(v);return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—'}
  function intLike(v){var n=Number(String(v==null?'':v).replace(',','.'));if(Number.isFinite(n))return n.toLocaleString('pl-PL',{maximumFractionDigits:3});return String(v==null||v===''?'—':v)}
  function token(){return (localStorage.getItem(TOKEN_KEY)||'').trim()}
  function authHeaders(){var t=token();return t?{'X-Brico-Token':t}: {}}

  function installUi(){
    if(document.getElementById('bricoProductCard'))return;
    var style=document.createElement('style');
    style.textContent=''
      +'.bricoProductCard{position:relative;overflow:hidden}'
      +'.bricoProductTop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}'
      +'.bricoProductTitle{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#9aa5b1}'
      +'.bricoDbBadge{font-size:9px;font-weight:900;padding:4px 7px;border-radius:999px;border:1px solid #29313a;color:#9aa5b1;background:#0f1317}'
      +'.bricoDbBadge.ok{color:#36d27f;border-color:#285d42;background:rgba(54,210,127,.08)}'
      +'.bricoDbBadge.warn{color:#ffd166;border-color:#66552c;background:rgba(255,209,102,.08)}'
      +'.bricoDbBadge.err{color:#ff6969;border-color:#673434;background:rgba(255,105,105,.08)}'
      +'.bricoProductName{font-size:17px;line-height:1.2;font-weight:900;margin:3px 0 10px;min-height:20px}'
      +'.bricoProductGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}'
      +'.bricoMetric{border:1px solid #29313a;background:#0f1317;border-radius:11px;padding:9px 10px;min-width:0}'
      +'.bricoMetric span{display:block;color:#9aa5b1;font-size:9px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}'
      +'.bricoMetric b{display:block;font-size:15px;line-height:1.2;overflow-wrap:anywhere}'
      +'.bricoMetric.price b{font-size:18px}'
      +'.bricoProductFoot{margin-top:8px;color:#9aa5b1;font-size:9px;line-height:1.35}'
      +'.bricoProdMini{margin-top:5px;padding-top:5px;border-top:1px solid #27303a;font-size:10px;line-height:1.35;color:#cfd6dd}'
      +'.bricoProdMini b{color:#f5f7fa}'
      +'.bricoProdMini .pvals{color:#9aa5b1;margin-top:2px}'
      +'.bricoMissing{color:#ff6969!important}';
    document.head.appendChild(style);

    var hero=document.getElementById('hero');
    if(!hero)return;
    var card=document.createElement('section');
    card.className='panel bricoProductCard';
    card.id='bricoProductCard';
    card.innerHTML=''
      +'<div class="bricoProductTop"><div class="bricoProductTitle">Produkt z bazy sklepu</div><div class="bricoDbBadge" id="bricoDbBadge">BAZA: START</div></div>'
      +'<div class="bricoProductName" id="bricoProductName">Zeskanuj EAN, aby wyświetlić dane produktu.</div>'
      +'<div class="bricoProductGrid">'
      +'<div class="bricoMetric"><span>EAN</span><b id="bricoProductEan">—</b></div>'
      +'<div class="bricoMetric"><span>Stan</span><b id="bricoProductStock">—</b></div>'
      +'<div class="bricoMetric price"><span>Cena zakupu</span><b id="bricoProductBuy">—</b></div>'
      +'<div class="bricoMetric price"><span>Cena sprzedaży</span><b id="bricoProductSell">—</b></div>'
      +'</div>'
      +'<div class="bricoProductFoot" id="bricoProductFoot">Sprawdzam bazę produktów…</div>';
    hero.parentNode.insertBefore(card,hero.nextSibling);
  }

  function setDbBadge(text,kind){
    var el=document.getElementById('bricoDbBadge');if(!el)return;
    el.textContent=text;el.className='bricoDbBadge'+(kind?' '+kind:'');
  }
  function setFoot(text){var el=document.getElementById('bricoProductFoot');if(el)el.textContent=text||''}

  function renderEmptyProduct(ean,message){
    var n=document.getElementById('bricoProductName');
    if(n){n.textContent=message||'Brak produktu w bazie.';n.classList.add('bricoMissing')}
    var e=document.getElementById('bricoProductEan');if(e)e.textContent=ean||'—';
    var s=document.getElementById('bricoProductStock');if(s)s.textContent='—';
    var b=document.getElementById('bricoProductBuy');if(b)b.textContent='—';
    var p=document.getElementById('bricoProductSell');if(p)p.textContent='—';
  }

  function renderProduct(p){
    var n=document.getElementById('bricoProductName');
    if(n){n.textContent=p.name||'Produkt bez nazwy';n.classList.toggle('bricoMissing',p.active===false)}
    var e=document.getElementById('bricoProductEan');if(e)e.textContent=p.ean||'—';
    var s=document.getElementById('bricoProductStock');if(s)s.textContent=intLike(p.stock);
    var b=document.getElementById('bricoProductBuy');if(b)b.textContent=money(p.purchasePrice);
    var sp=document.getElementById('bricoProductSell');if(sp)sp.textContent=money(p.salePrice);
    var bits=[];
    if(p.brand)bits.push(p.brand);
    if(p.active===false)bits.push('PRODUKT NIEAKTYWNY');
    if(databaseMeta&&databaseMeta.reportDate)bits.push('raport '+databaseMeta.reportDate);
    setFoot(bits.join(' • ')||'Dane z aktualnej bazy produktów.');
  }

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(function(resolve,reject){
      var req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=function(){
        var db=req.result;
        if(!db.objectStoreNames.contains(PRODUCT_STORE))db.createObjectStore(PRODUCT_STORE,{keyPath:'ean'});
        if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE,{keyPath:'key'});
      };
      req.onsuccess=function(){resolve(req.result)};
      req.onerror=function(){reject(req.error||new Error('Błąd IndexedDB'))};
    });
    return dbPromise;
  }

  async function dbGetMeta(){
    var db=await openDb();
    return await new Promise(function(resolve,reject){var tx=db.transaction(META_STORE,'readonly'),r=tx.objectStore(META_STORE).get(META_KEY);r.onsuccess=function(){resolve(r.result||null)};r.onerror=function(){reject(r.error)}});
  }
  async function dbPutMeta(meta){
    var db=await openDb();
    await new Promise(function(resolve,reject){var tx=db.transaction(META_STORE,'readwrite');tx.objectStore(META_STORE).put(Object.assign({key:META_KEY},meta));tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)}});
  }
  async function dbClearProducts(){
    var db=await openDb();
    await new Promise(function(resolve,reject){var tx=db.transaction(PRODUCT_STORE,'readwrite');tx.objectStore(PRODUCT_STORE).clear();tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)}});
    hotCache.clear();
  }
  async function dbPutBatch(batch){
    if(!batch.length)return;
    var db=await openDb();
    await new Promise(function(resolve,reject){var tx=db.transaction(PRODUCT_STORE,'readwrite'),st=tx.objectStore(PRODUCT_STORE);batch.forEach(function(p){st.put(p)});tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error)}});
  }
  async function dbGetProduct(ean){
    ean=cleanEan(ean);
    if(hotCache.has(ean))return hotCache.get(ean);
    var db=await openDb();
    var p=await new Promise(function(resolve,reject){var tx=db.transaction(PRODUCT_STORE,'readonly'),r=tx.objectStore(PRODUCT_STORE).get(ean);r.onsuccess=function(){resolve(r.result||null)};r.onerror=function(){reject(r.error)}});
    if(p){hotCache.set(ean,p);if(hotCache.size>250){var first=hotCache.keys().next().value;hotCache.delete(first)}}
    return p;
  }

  function zipU16(v,o){return v.getUint16(o,true)}
  function zipU32(v,o){return v.getUint32(o,true)}
  function parseZipDirectory(buffer){
    var v=new DataView(buffer),eocd=-1,i;
    for(i=v.byteLength-22;i>=Math.max(0,v.byteLength-65557);i--){if(zipU32(v,i)===0x06054b50){eocd=i;break}}
    if(eocd<0)throw new Error('Nie znaleziono katalogu ZIP w XLSX.');
    var total=zipU16(v,eocd+10),cdOffset=zipU32(v,eocd+16),dec=new TextDecoder('utf-8'),entries=new Map(),p=cdOffset,n;
    for(n=0;n<total;n++){
      if(zipU32(v,p)!==0x02014b50)throw new Error('Uszkodzony katalog XLSX.');
      var method=zipU16(v,p+10),compSize=zipU32(v,p+20),uncompSize=zipU32(v,p+24),nameLen=zipU16(v,p+28),extraLen=zipU16(v,p+30),commentLen=zipU16(v,p+32),localOffset=zipU32(v,p+42);
      var name=dec.decode(new Uint8Array(buffer,p+46,nameLen));entries.set(name,{method:method,compSize:compSize,uncompSize:uncompSize,localOffset:localOffset});p+=46+nameLen+extraLen+commentLen;
    }
    return entries;
  }
  function zipEntryStream(buffer,entries,name){
    var e=entries.get(name);if(!e)throw new Error('Brak '+name+' w XLSX.');var v=new DataView(buffer),o=e.localOffset;
    if(zipU32(v,o)!==0x04034b50)throw new Error('Nieprawidłowy wpis ZIP: '+name);
    var nameLen=zipU16(v,o+26),extraLen=zipU16(v,o+28),start=o+30+nameLen+extraLen,src=new Uint8Array(buffer,start,e.compSize);
    var stream=new Blob([src]).stream();
    if(e.method===8){if(!('DecompressionStream' in window))throw new Error('WebView nie obsługuje dekompresji XLSX.');stream=stream.pipeThrough(new DecompressionStream('deflate-raw'))}
    else if(e.method!==0)throw new Error('Nieobsługiwana kompresja XLSX ('+e.method+').');
    return stream;
  }
  async function unzipText(buffer,entries,name){return await new Response(zipEntryStream(buffer,entries,name)).text()}
  function decodeXmlEntities(s){return String(s||'').replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g,function(m,k){if(k==='amp')return'&';if(k==='lt')return'<';if(k==='gt')return'>';if(k==='quot')return'"';if(k==='apos')return"'";if(k[0]==='#'){var hex=k[1].toLowerCase()==='x';return String.fromCodePoint(parseInt(k.slice(hex?2:1),hex?16:10)||32)}return m})}
  function parseSharedStrings(xml){var out=[],re=/<si\b[^>]*>([\s\S]*?)<\/si>/g,m;while((m=re.exec(xml))){var value='',tm,tr=/<t\b[^>]*>([\s\S]*?)<\/t>/g;while((tm=tr.exec(m[1])))value+=decodeXmlEntities(tm[1].replace(/<[^>]+>/g,''));out.push(value)}return out}
  function colLetters(ref){var m=/^([A-Z]+)/.exec(ref||'');return m?m[1]:''}
  function parseSheetRowCells(rowXml,shared){
    var cells={},re=/<c\b([^>]*)>([\s\S]*?)<\/c>/g,m;
    while((m=re.exec(rowXml))){var attrs=m[1],body=m[2],rm=/\br="([A-Z]+\d+)"/.exec(attrs);if(!rm)continue;var col=colLetters(rm[1]),tm=/\bt="([^"]+)"/.exec(attrs),vm=/<v>([\s\S]*?)<\/v>/.exec(body),im=/<t\b[^>]*>([\s\S]*?)<\/t>/.exec(body),val='';if(tm&&tm[1]==='inlineStr')val=im?decodeXmlEntities(im[1]):'';else if(vm){val=vm[1];if(tm&&tm[1]==='s')val=shared[Number(val)]||'';else val=decodeXmlEntities(val)}cells[col]=val}
    return cells;
  }
  async function forEachSheetRow(buffer,entries,name,onRow){
    var reader=zipEntryStream(buffer,entries,name).getReader(),decoder=new TextDecoder('utf-8'),buf='',done=false;
    while(!done){var part=await reader.read();done=part.done;buf+=decoder.decode(part.value||new Uint8Array(),{stream:!done});while(true){var start=buf.indexOf('<row');if(start<0){if(buf.length>32)buf=buf.slice(-32);break}var end=buf.indexOf('</row>',start);if(end<0){if(start>0)buf=buf.slice(start);break}var rowXml=buf.slice(start,end+6);buf=buf.slice(end+6);await onRow(rowXml)}}
  }

  async function importWorkbook(arrayBuffer,serverMeta){
    setDbBadge('BAZA: ANALIZA','warn');setFoot('Analizuję raport produktów…');
    var entries=parseZipDirectory(arrayBuffer);
    var sharedXml=entries.has('xl/sharedStrings.xml')?await unzipText(arrayBuffer,entries,'xl/sharedStrings.xml'):'';
    var shared=sharedXml?parseSharedStrings(sharedXml):[];
    var sheetName=entries.has('xl/worksheets/sheet1.xml')?'xl/worksheets/sheet1.xml':Array.from(entries.keys()).find(function(k){return /^xl\/worksheets\/sheet\d+\.xml$/.test(k)});
    if(!sheetName)throw new Error('Brak arkusza danych w XLSX.');

    await dbClearProducts();
    var header=null,reportDate='',rows=0,stored=0,batch=[];
    await forEachSheetRow(arrayBuffer,entries,sheetName,async function(rowXml){
      var am=/^<row\b([^>]*)>/.exec(rowXml),attrs=am?am[1]:'',rnum=Number((/\br="(\d+)"/.exec(attrs)||[])[1]||0),body=rowXml.replace(/^<row\b[^>]*>/,'').replace(/<\/row>$/,'');
      var cells=parseSheetRowCells(body,shared);
      if(rnum===2)reportDate=String(cells.A||'').replace(/^Data\s*:\s*/i,'').trim();
      if(!header){
        var vals=Object.entries(cells);
        if(vals.some(function(x){return String(x[1]).trim()==='EAN'})&&vals.some(function(x){return String(x[1]).trim()==='CENA_SPRZEDAZY'})){
          header={};vals.forEach(function(x){header[String(x[1]).trim()]=x[0]});
          if(!header.NAZWA||!header.STAN||!header.CENA_ZAKUPU)throw new Error('Raport nie zawiera NAZWA / STAN / CENA_ZAKUPU.');
        }
        return;
      }
      var get=function(h){return cells[header[h]]==null?'':cells[header[h]]};
      var ean=cleanEan(get('EAN'));if(!ean)return;
      var sale=numOr(get('CENA_SPRZEDAZY'),NaN),purchase=numOr(get('CENA_ZAKUPU'),NaN);
      var active=/^(tak|1|true)$/i.test(String(get('AKTYWNY')).trim());
      var p={ean:ean,name:String(get('NAZWA')||'').trim(),brand:String(get('MARKA')||'').trim(),stock:String(get('STAN')||'').trim(),purchasePrice:Number.isFinite(purchase)?Math.round(purchase*10000)/10000:null,salePrice:Number.isFinite(sale)?Math.round(sale*100)/100:null,active:active};
      batch.push(p);rows++;
      if(batch.length>=1000){await dbPutBatch(batch);stored+=batch.length;batch=[];if(stored%5000===0){setDbBadge('BAZA: '+stored.toLocaleString('pl-PL'),'warn');setFoot('Indeksuję produkty… '+stored.toLocaleString('pl-PL'));await new Promise(function(r){setTimeout(r,0)})}}
    });
    if(!header)throw new Error('Nie znaleziono nagłówków EAN / CENA_SPRZEDAZY.');
    if(batch.length){await dbPutBatch(batch);stored+=batch.length;batch=[]}
    shared.length=0;sharedXml='';
    databaseMeta={sourceModifiedMs:Number(serverMeta.modifiedMs||0),sourceSize:Number(serverMeta.size||0),file:String(serverMeta.file||'products.xlsx'),reportDate:reportDate,records:stored,importedAt:new Date().toISOString()};
    await dbPutMeta(databaseMeta);
    databaseReady=true;
    setDbBadge('BAZA: '+stored.toLocaleString('pl-PL'),'ok');
    setFoot('Baza gotowa • raport '+(reportDate||'?')+' • '+stored.toLocaleString('pl-PL')+' produktów');
    decorateRows();
  }

  async function serverMeta(){
    var t=token();if(!t)throw new Error('Brak klucza BricoLab. Ustaw go w sekcji wysyłania.');
    var res=await fetch(META_URL,{cache:'no-store',headers:authHeaders()});
    var text=await res.text(),data={};try{data=JSON.parse(text)}catch(e){}
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
    return data;
  }

  async function syncDatabase(){
    if(syncPromise)return syncPromise;
    syncPromise=(async function(){
      try{
        await openDb();
        var local=await dbGetMeta().catch(function(){return null});
        if(local){databaseMeta=local;databaseReady=true;setDbBadge('BAZA: '+Number(local.records||0).toLocaleString('pl-PL'),'ok');setFoot('Baza lokalna • raport '+(local.reportDate||'?'))}
        setDbBadge('BAZA: SPRAWDZAM','warn');
        var remote=await serverMeta();
        if(local&&Number(local.sourceModifiedMs||0)===Number(remote.modifiedMs||0)&&Number(local.records||0)>0){databaseMeta=local;databaseReady=true;setDbBadge('BAZA: '+Number(local.records||0).toLocaleString('pl-PL'),'ok');setFoot('Baza aktualna • raport '+(local.reportDate||'?'));decorateRows();return true}
        setDbBadge('BAZA: POBIERAM','warn');setFoot('Pobieram aktualny raport produktów ('+(Number(remote.size||0)/1048576).toFixed(1)+' MB)…');
        var res=await fetch(FILE_URL,{cache:'no-store',headers:authHeaders()});
        if(!res.ok)throw new Error('Pobieranie XLSX: HTTP '+res.status);
        var buffer=await res.arrayBuffer();
        await importWorkbook(buffer,remote);
        return true;
      }catch(err){
        var local2=await dbGetMeta().catch(function(){return null});
        if(local2&&Number(local2.records||0)>0){databaseMeta=local2;databaseReady=true;setDbBadge('BAZA: OFFLINE','warn');setFoot('Używam zapisanej bazy • '+(err.message||err));decorateRows();return true}
        databaseReady=false;setDbBadge('BAZA: BŁĄD','err');setFoot(err.message||String(err));return false;
      }finally{syncPromise=null}
    })();
    return syncPromise;
  }

  async function lookupAndRender(ean){
    ean=cleanEan(ean);if(!ean)return;
    lastRequestedEan=ean;
    var e=document.getElementById('bricoProductEan');if(e)e.textContent=ean;
    var n=document.getElementById('bricoProductName');if(n){n.textContent='Szukam produktu…';n.classList.remove('bricoMissing')}
    if(!databaseReady){await syncDatabase()}
    var p=databaseReady?await dbGetProduct(ean).catch(function(){return null}):null;
    if(lastRequestedEan!==ean)return;
    if(p)renderProduct(p);else renderEmptyProduct(ean,databaseReady?'Brak produktu w bazie.':'Baza produktów niedostępna.');
    decorateRows();
  }

  async function decorateRows(){
    if(!databaseReady)return;
    var rows=[].slice.call(document.querySelectorAll('#scanList .item'));
    for(var i=0;i<rows.length;i++){
      var row=rows[i],codeEl=row.querySelector('.code');if(!codeEl)continue;var ean=cleanEan(codeEl.textContent);if(!ean)continue;
      var existing=row.querySelector('.bricoProdMini');if(existing&&existing.getAttribute('data-ean')===ean)continue;
      if(existing)existing.remove();
      var p=await dbGetProduct(ean).catch(function(){return null});
      var mini=document.createElement('div');mini.className='bricoProdMini'+(p?'':' bricoMissing');mini.setAttribute('data-ean',ean);
      if(p)mini.innerHTML='<b>'+esc(p.name||'Produkt')+'</b><div class="pvals">Stan: '+esc(intLike(p.stock))+' • Zakup: '+esc(money(p.purchasePrice))+' • Sprzedaż: '+esc(money(p.salePrice))+'</div>';
      else mini.textContent='Brak produktu w bazie';
      var first=row.children&&row.children[0];if(first)first.appendChild(mini);
    }
  }

  function hookScanner(){
    var original=window.onNativeBarcode;
    if(typeof original!=='function')return false;
    if(original.__bricoProductHook)return true;
    var wrapped=function(payload){
      original(payload);
      try{var x=(typeof payload==='object'&&payload)?payload:JSON.parse(payload||'{}'),ean=cleanEan(x.code||'');if(ean)lookupAndRender(ean)}catch(e){}
    };
    wrapped.__bricoProductHook=true;window.onNativeBarcode=wrapped;
    return true;
  }

  function install(){
    installUi();
    if(!hookScanner()){var tries=0,t=setInterval(function(){tries++;if(hookScanner()||tries>30)clearInterval(t)},100)}
    var list=document.getElementById('scanList');if(list&&'MutationObserver' in window){new MutationObserver(function(){setTimeout(decorateRows,0)}).observe(list,{childList:true,subtree:true})}
    var clear=document.getElementById('clearBtn');if(clear)clear.addEventListener('click',function(){lastRequestedEan='';setTimeout(function(){renderEmptyProduct('','Zeskanuj EAN, aby wyświetlić dane produktu.');if(databaseMeta)setFoot('Baza gotowa • raport '+(databaseMeta.reportDate||'?'))},0)});
    syncDatabase();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();