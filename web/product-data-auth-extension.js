(function(){
  'use strict';
  var SHOP='08042';
  var LOOKUP_URL='https://files.bricolab.pl/BricoLab/api/scanner_product_lookup_v2.php';
  var lastRequestedEan='';
  var productTimer=null;

  function clean(v){return String(v==null?'':v).replace(/\D/g,'')}
  function money(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—'}
  function qty(v){var n=Number(String(v==null?'':v).replace(',','.'));return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:3}):(String(v||'').trim()||'—')}
  function authState(){return window.BricoScannerAuth||{verified:false,loggedIn:false,permission:'none'}}
  function canView(){var a=authState();return !!(a.verified&&a.loggedIn&&(a.permission==='view'||a.permission==='edit'))}
  function hasNative(){return !!(window.BricoUpload&&typeof window.BricoUpload.uploadJsonAuth==='function')}
  function feedback(found){try{if(window.NativeScanner&&typeof window.NativeScanner.productFeedback==='function')window.NativeScanner.productFeedback(!!found)}catch(e){}}

  function installUi(){
    if(document.getElementById('bricoProductCard'))return;
    var style=document.createElement('style');style.textContent=''
      +'.bricoProductCard{position:relative;overflow:hidden;padding:7px 8px!important}.bricoProductTop{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:3px}.bricoProductTitle{font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#9aa5b1}.bricoDbBadge{font-size:8px;font-weight:900;padding:2px 5px;border-radius:999px;border:1px solid #29313a;color:#9aa5b1;background:#0f1317}.bricoDbBadge.ok{color:#36d27f;border-color:#285d42;background:rgba(54,210,127,.08)}.bricoDbBadge.warn{color:#ffd166;border-color:#66552c;background:rgba(255,209,102,.08)}.bricoDbBadge.err{color:#ff6969;border-color:#673434;background:rgba(255,105,105,.08)}.bricoProductName{font-size:14px;line-height:1.12;font-weight:900;margin:2px 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bricoProductGrid{display:grid;grid-template-columns:1.35fr .65fr 1fr 1fr;gap:4px}.bricoMetric{border:1px solid #29313a;background:#0f1317;border-radius:8px;padding:4px 5px;min-width:0}.bricoMetric span{display:block;color:#9aa5b1;font-size:7px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px}.bricoMetric b{display:block;font-size:11px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bricoMetric.price b{font-size:12px}.bricoProductFoot{margin-top:3px;color:#9aa5b1;font-size:8px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bricoMissing{color:#ff6969!important}@media(max-width:390px){.bricoProductGrid{grid-template-columns:1fr 1fr}.bricoProductFoot{display:none}}';document.head.appendChild(style);
    var hero=document.getElementById('hero');if(!hero)return;var card=document.createElement('section');card.className='panel bricoProductCard';card.id='bricoProductCard';card.innerHTML='<div class="bricoProductTop"><div class="bricoProductTitle">Produkt z bazy sklepu</div><div class="bricoDbBadge" id="bricoDbBadge">BAZA: START</div></div><div class="bricoProductName" id="bricoProductName">Zeskanuj kod produktu.</div><div class="bricoProductGrid"><div class="bricoMetric"><span>EAN / kod</span><b id="bricoProductEan">—</b></div><div class="bricoMetric"><span>Stan</span><b id="bricoProductStock">—</b></div><div class="bricoMetric price"><span>Zakup</span><b id="bricoProductBuy">—</b></div><div class="bricoMetric price"><span>Sprzedaż</span><b id="bricoProductSell">—</b></div></div><div class="bricoProductFoot" id="bricoProductFoot">Baza sklepu '+SHOP+'</div>';hero.parentNode.insertBefore(card,hero.nextSibling);refreshBadge();
  }
  function badge(t,k){var e=document.getElementById('bricoDbBadge');if(!e)return;e.textContent=t;e.className='bricoDbBadge'+(k?' '+k:'')}
  function foot(t){var e=document.getElementById('bricoProductFoot');if(e)e.textContent=t||''}
  function refreshBadge(){if(canView()&&hasNative())badge('BAZA: GOTOWA','ok');else badge('BAZA: LOGOWANIE','warn')}
  function reset(ean){var n=document.getElementById('bricoProductName');if(n){n.textContent='Szukam produktu…';n.classList.remove('bricoMissing')}var e=document.getElementById('bricoProductEan');if(e)e.textContent=ean||'—';['bricoProductStock','bricoProductBuy','bricoProductSell'].forEach(function(id){var x=document.getElementById(id);if(x)x.textContent='—'})}
  function missing(ean){var n=document.getElementById('bricoProductName');if(n){n.textContent='Brak produktu w bazie.';n.classList.add('bricoMissing')}var e=document.getElementById('bricoProductEan');if(e)e.textContent=ean||'—';foot('Kod nie występuje w bazie sklepu '+SHOP+'.')}
  function render(p){var n=document.getElementById('bricoProductName');if(n){n.textContent=p.name||'Produkt bez nazwy';n.classList.toggle('bricoMissing',p.active===false)}var e=document.getElementById('bricoProductEan');if(e)e.textContent=p.ean||'—';var s=document.getElementById('bricoProductStock');if(s)s.textContent=qty(p.stock);var b=document.getElementById('bricoProductBuy');if(b)b.textContent=money(p.purchasePrice);var sp=document.getElementById('bricoProductSell');if(sp)sp.textContent=money(p.salePrice);var bits=[];if(p.brand)bits.push(p.brand);if(p.active===false)bits.push('NIEAKTYWNY');foot(bits.join(' • ')||'Dane z bazy sklepu '+SHOP+'.')}

  function lookup(ean){
    ean=clean(ean);if(!/^(\d{8}|\d{13})$/.test(ean))return;lastRequestedEan=ean;reset(ean);
    if(!canView()){badge('BAZA: BRAK DOSTĘPU','err');foot('Zaloguj się do BricoLab i sprawdź uprawnienie Skaner.');return}
    if(!hasNative()){badge('BAZA: BRAK JAVA','err');foot('Brak natywnego transportu BricoLab.');return}
    badge('BAZA: SZUKAM','warn');foot('Szukam '+ean+'…');clearTimeout(productTimer);productTimer=setTimeout(function(){if(lastRequestedEan===ean){badge('BAZA: TIMEOUT','err');foot('Brak odpowiedzi bazy po 15 s.')}},15000);
    try{window.BricoUpload.uploadJsonAuth(LOOKUP_URL,JSON.stringify({type:'PRODUCT_LOOKUP',shop:SHOP,ean:ean,requestId:Date.now()}))}catch(err){clearTimeout(productTimer);badge('BAZA: BŁĄD','err');foot('JAVA: '+(err&&err.message?err.message:String(err)))}
  }

  var previousResult=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){var server=result&&result.server?result.server:null;if(server&&server.kind==='PRODUCT_LOOKUP'){clearTimeout(productTimer);var ean=clean(server.ean||'');if(ean&&lastRequestedEan&&ean!==lastRequestedEan)return;if(!result.ok||!server.ok){badge('BAZA: BŁĄD','err');foot('Lookup: '+((server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'))));return}if(!server.found){badge('BAZA: ONLINE','ok');missing(ean);feedback(false);return}badge('BAZA: ONLINE','ok');render(server.product||{});feedback(true);return}if(typeof previousResult==='function')previousResult(result)};
  var previousBarcode=window.onNativeBarcode;
  window.onNativeBarcode=function(payload){if(typeof previousBarcode==='function')previousBarcode(payload);var x=payload;if(typeof x==='string'){try{x=JSON.parse(x)}catch(e){x={}}}lookup(x&&x.code?x.code:'')};
  window.addEventListener('brico-auth-change',refreshBadge);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUi);else installUi();
})();