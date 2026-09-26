(function(){
  'use strict';

  window.bricoCompactListMode=true;

  var STYLE_ID='bricoCompactListV40Style';
  var LOOKUP_URL='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_product_lookup.php';
  var TOKEN_KEY='brico.upload.token';
  var SHOP='08042';
  var scheduled=false;
  var productCache=new Map();
  var dbInfo={stale:null,reportDate:'',status:'START'};
  var metaPending=false;
  var progressTimer=null;
  var progressValue=1;

  function clean(v){return String(v==null?'':v).trim()}
  function cleanEan(v){return clean(v).replace(/\D/g,'')}
  function money(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—'}
  function qty(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:3}):'—'}
  function token(){try{return clean(localStorage.getItem(TOKEN_KEY)||'')}catch(e){return ''}}

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\
      #hero{display:none!important}\
      #bricoProductCard{display:none!important}\
      #scanList .bricoProdMini{display:none!important}\
      #scanList .code{color:var(--text)!important;text-decoration:none!important;cursor:default!important}\
      #scanList .itemmeta{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;line-height:1.28!important}\
      #scanList .item.bricoLatestItem .code{font-size:17px!important;font-weight:950!important;line-height:1.08!important;letter-spacing:-.01em}\
      #scanList .item.bricoLatestItem .itemmeta{font-size:9px!important;font-weight:750}\
      .bricoPositionStatsV40{font-size:9px;color:var(--muted);margin-left:5px}\
      #bricoDbBadgeV40{margin-left:auto;flex:0 0 auto;font-size:9px;font-weight:900;padding:4px 7px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:var(--panel2);white-space:nowrap}\
      #bricoDbBadgeV40.ok{color:#36d27f;border-color:#285d42;background:rgba(54,210,127,.08)}\
      #bricoDbBadgeV40.warn{color:#ffd166;border-color:#66552c;background:rgba(255,209,102,.08)}\
      #bricoDbBadgeV40.err{color:#ff6969;border-color:#673434;background:rgba(255,105,105,.08)}\
      html[data-brico-theme="light"] #bricoDbBadgeV40{background:rgba(0,0,0,.50)}\
    ';
    document.head.appendChild(style);
  }

  function ensureHeaderBits(){
    var qtyTotal=document.getElementById('qtyTotal');
    if(qtyTotal&&!document.getElementById('bricoPositionStatsV40')){
      var span=document.createElement('span');
      span.id='bricoPositionStatsV40';
      span.className='bricoPositionStatsV40';
      qtyTotal.insertAdjacentElement('afterend',span);
    }
    var head=document.querySelector('.listHead');
    if(head&&!document.getElementById('bricoDbBadgeV40')){
      var badge=document.createElement('div');
      badge.id='bricoDbBadgeV40';
      badge.textContent='BAZA: SPRAWDZAM 1%';
      badge.className='warn';
      head.appendChild(badge);
    }
  }

  function positionWord(n){
    if(n===1)return 'pozycja';
    var last=n%10,last2=n%100;
    if(last>=2&&last<=4&&!(last2>=12&&last2<=14))return 'pozycje';
    return 'pozycji';
  }

  function setBadge(text,kind,title){
    ensureHeaderBits();
    var el=document.getElementById('bricoDbBadgeV40');
    if(!el)return;
    el.textContent=text;
    el.className=kind||'';
    el.title=title||'';
  }

  function parseReportMs(value){
    var s=clean(value);if(!s)return 0;
    var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),23,59,59).getTime();
    m=/^(?:Data\s*:\s*)?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i.exec(s);
    if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||23),Number(m[5]||59),Number(m[6]||59)).getTime();
    var d=new Date(s);return isNaN(d.getTime())?0:d.getTime();
  }

  function staleFromReportDate(value){
    var ms=parseReportMs(value);
    return ms?((Date.now()-ms)>24*60*60*1000):null;
  }

  function stopProgress(){
    if(progressTimer){clearInterval(progressTimer);progressTimer=null}
  }

  function startProgress(){
    stopProgress();
    progressValue=1;
    setBadge('BAZA: SPRAWDZAM '+progressValue+'%','warn');
    progressTimer=setInterval(function(){
      if(!metaPending){stopProgress();return}
      if(progressValue<90){
        progressValue=Math.min(90,progressValue+(progressValue<35?4:(progressValue<70?2:1)));
        setBadge('BAZA: SPRAWDZAM '+progressValue+'%','warn');
      }
    },250);
  }

  function applyDatabaseInfo(info){
    info=info||{};
    var reportDate=clean(info.reportDate||info.reportDateRaw||'');
    if(reportDate)dbInfo.reportDate=reportDate;

    var calculated=staleFromReportDate(dbInfo.reportDate);
    if(typeof calculated==='boolean')dbInfo.stale=calculated;
    else if(typeof info.stale==='boolean')dbInfo.stale=info.stale;

    stopProgress();
    if(dbInfo.stale===true){
      setBadge('BAZA: NIEAKTUALNA 100%','warn',dbInfo.reportDate?'Raport: '+dbInfo.reportDate:'');
    }else if(dbInfo.stale===false){
      setBadge('BAZA: ONLINE 100%','ok',dbInfo.reportDate?'Raport: '+dbInfo.reportDate:'');
    }else{
      setBadge('BAZA: STATUS ?','warn',dbInfo.reportDate?'Raport: '+dbInfo.reportDate:'');
    }
  }

  function latestCode(){
    var last=document.getElementById('lastCode');
    var value=last?cleanEan(last.textContent):'';
    return /^(\d{8}|\d{13})$/.test(value)?value:'';
  }

  function baseMeta(meta){
    var saved=meta.getAttribute('data-brico-base-meta-v40');
    if(saved!=null)return saved;
    var current=clean(meta.textContent).replace(/\s*•\s*(Stan .*|Brak w bazie|Brak w nieaktualnej bazie).*$/,'');
    meta.setAttribute('data-brico-base-meta-v40',current);
    return current;
  }

  function productSuffix(entry){
    if(!entry)return '';
    if(entry.found===false)return dbInfo.stale===true?' • Brak w nieaktualnej bazie':' • Brak w bazie';
    var p=entry.product||{};
    var stock=qty(p.stock);if(stock!=='—')stock+=' szt';
    return ' • Stan '+stock+' • Cena N. '+money(p.purchasePrice)+' • Cena Sp. '+money(p.salePrice);
  }

  function update(){
    scheduled=false;
    ensureStyle();
    ensureHeaderBits();
    var list=document.getElementById('scanList');
    if(!list)return;
    var rows=[].slice.call(list.querySelectorAll('.item'));
    var pos=document.getElementById('bricoPositionStatsV40');
    if(pos)pos.textContent='• '+rows.length+' '+positionWord(rows.length);
    var latest=latestCode();
    rows.forEach(function(row,idx){
      var codeEl=row.querySelector('.code'),meta=row.querySelector('.itemmeta');
      if(!codeEl||!meta)return;
      var ean=cleanEan(codeEl.textContent);
      row.classList.toggle('bricoLatestItem',latest?ean===latest:idx===0);
      meta.textContent=baseMeta(meta)+productSuffix(productCache.get(ean));
    });
  }

  function schedule(){if(scheduled)return;scheduled=true;setTimeout(update,0)}

  function requestMeta(){
    if(metaPending)return;
    if(!(window.BricoUpload&&typeof window.BricoUpload.uploadJson==='function')){setBadge('BAZA: OFFLINE','warn');return}
    var t=token();
    if(!t){setBadge('BAZA: BRAK KLUCZA','err');return}
    metaPending=true;
    startProgress();
    try{
      window.BricoUpload.uploadJson(LOOKUP_URL,t,JSON.stringify({type:'PRODUCT_META',shop:SHOP,requestId:Date.now()}));
      setTimeout(function(){
        if(metaPending){
          metaPending=false;
          stopProgress();
          setBadge('BAZA: STATUS ?','warn','Serwer nie zwrócił informacji o aktualności bazy.');
        }
      },8000);
    }catch(e){metaPending=false;stopProgress();setBadge('BAZA: BŁĄD','err')}
  }

  var previous=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:null;

    if(server&&server.kind==='PRODUCT_META'){
      metaPending=false;
      stopProgress();
      if(result&&result.ok&&server.ok){
        applyDatabaseInfo(server.database||server);
      }else{
        setBadge('BAZA: BŁĄD','err');
      }
      schedule();
      return;
    }

    if(metaPending&&server&&server.kind==='PRODUCT_LOOKUP'&&!server.ean&&server.error==='invalid_type'){
      metaPending=false;
      stopProgress();
      setBadge('BAZA: STATUS ?','warn','Endpoint bazy nie obsługuje jeszcze sprawdzania daty raportu.');
      return;
    }

    if(server&&server.kind==='PRODUCT_LOOKUP'){
      if(typeof previous==='function'){try{previous(result)}catch(e){}}
      metaPending=false;
      stopProgress();
      if(server.database)applyDatabaseInfo(server.database);
      else if(typeof server.databaseStale==='boolean')applyDatabaseInfo({stale:server.databaseStale,reportDate:server.reportDate||''});
      else if(!(result&&result.ok&&server.ok))setBadge('BAZA: BŁĄD','err');

      var ean=cleanEan(server.ean||'');
      if(ean){
        if(result&&result.ok&&server.ok){
          productCache.set(ean,{found:!!server.found,product:server.product||null});
        }
        schedule();
      }
      return;
    }

    if(typeof previous==='function')previous(result);
  };

  function boot(){
    ensureStyle();
    ensureHeaderBits();
    update();
    var list=document.getElementById('scanList');
    if(list&&'MutationObserver' in window)new MutationObserver(schedule).observe(list,{childList:true,subtree:true,characterData:true});
    var last=document.getElementById('lastCode');
    if(last&&'MutationObserver' in window)new MutationObserver(schedule).observe(last,{childList:true,subtree:true,characterData:true});
    setTimeout(requestMeta,500);
    setTimeout(update,150);
    setTimeout(update,700);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
