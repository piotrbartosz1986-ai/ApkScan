(function(){
  'use strict';

  var SHOP='08042';
  var LOOKUP_URL='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_product_lookup.php';
  var TOKEN_KEY='brico.upload.token';
  var lastRequestedEan='';
  var productTimer=null;

  function cleanEan(v){return String(v==null?'':v).replace(/\D/g,'')}
  function money(v){
    var n=Number(String(v==null?'':v).replace(',','.'));
    return Number.isFinite(n)?n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł':'—';
  }
  function qty(v){
    var n=Number(String(v==null?'':v).replace(',','.'));
    return Number.isFinite(n)?n.toLocaleString('pl-PL',{maximumFractionDigits:3}):(String(v||'').trim()||'—');
  }
  function token(){return (localStorage.getItem(TOKEN_KEY)||'').trim()}
  function hasNative(){return !!(window.BricoUpload&&typeof window.BricoUpload.uploadJson==='function')}

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
      +'<div class="bricoProductFoot" id="bricoProductFoot">Połączenie przez natywny moduł JAVA — bez fetch/CORS.</div>';
    hero.parentNode.insertBefore(card,hero.nextSibling);
    setBadge(hasNative()&&token()?'BAZA: GOTOWA':'BAZA: KONFIG','warn');
  }

  function setBadge(text,kind){
    var el=document.getElementById('bricoDbBadge');if(!el)return;
    el.textContent=text;el.className='bricoDbBadge'+(kind?' '+kind:'');
  }
  function foot(text){var el=document.getElementById('bricoProductFoot');if(el)el.textContent=text||''}
  function resetFields(ean){
    var n=document.getElementById('bricoProductName');if(n){n.textContent='Szukam produktu…';n.classList.remove('bricoMissing')}
    var e=document.getElementById('bricoProductEan');if(e)e.textContent=ean||'—';
    var s=document.getElementById('bricoProductStock');if(s)s.textContent='—';
    var b=document.getElementById('bricoProductBuy');if(b)b.textContent='—';
    var p=document.getElementById('bricoProductSell');if(p)p.textContent='—';
  }
  function renderMissing(ean){
    var n=document.getElementById('bricoProductName');if(n){n.textContent='Brak produktu w bazie.';n.classList.add('bricoMissing')}
    var e=document.getElementById('bricoProductEan');if(e)e.textContent=ean||'—';
    foot('EAN nie występuje w bazie sklepu '+SHOP+'.');
  }
  function renderProduct(p){
    var n=document.getElementById('bricoProductName');if(n){n.textContent=p.name||'Produkt bez nazwy';n.classList.toggle('bricoMissing',p.active===false)}
    var e=document.getElementById('bricoProductEan');if(e)e.textContent=p.ean||'—';
    var s=document.getElementById('bricoProductStock');if(s)s.textContent=qty(p.stock);
    var b=document.getElementById('bricoProductBuy');if(b)b.textContent=money(p.purchasePrice);
    var sp=document.getElementById('bricoProductSell');if(sp)sp.textContent=money(p.salePrice);
    var bits=[];if(p.brand)bits.push(p.brand);if(p.active===false)bits.push('PRODUKT NIEAKTYWNY');
    foot(bits.join(' • ')||'Dane z bazy sklepu '+SHOP+'.');
  }

  function lookup(ean){
    ean=cleanEan(ean);
    if(!/^(\d{8}|\d{13})$/.test(ean))return;
    lastRequestedEan=ean;
    resetFields(ean);

    if(!hasNative()){
      setBadge('BAZA: BRAK JAVA','err');
      foot('Ta wersja aplikacji nie udostępnia natywnego modułu połączeń.');
      return;
    }
    var t=token();
    if(!t){
      setBadge('BAZA: BRAK KLUCZA','err');
      foot('Wejdź w USTAWIENIA wysyłania i zapisz klucz — ten sam, którego używasz do wysyłania list.');
      return;
    }

    setBadge('BAZA: SZUKAM','warn');
    foot('Szukam EAN '+ean+' przez natywny moduł JAVA…');
    clearTimeout(productTimer);
    productTimer=setTimeout(function(){
      if(lastRequestedEan===ean){setBadge('BAZA: TIMEOUT','err');foot('Brak odpowiedzi bazy po 15 s.');}
    },15000);

    try{
      window.BricoUpload.uploadJson(LOOKUP_URL,t,JSON.stringify({type:'PRODUCT_LOOKUP',shop:SHOP,ean:ean,requestId:Date.now()}));
    }catch(err){
      clearTimeout(productTimer);
      setBadge('BAZA: BŁĄD','err');
      foot('JAVA: '+(err&&err.message?err.message:String(err)));
    }
  }

  var previousUploadResult=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:null;
    if(server&&server.kind==='PRODUCT_LOOKUP'){
      clearTimeout(productTimer);
      var ean=cleanEan(server.ean||'');
      if(ean&&lastRequestedEan&&ean!==lastRequestedEan)return;
      if(!result.ok||!server.ok){
        setBadge('BAZA: BŁĄD','err');
        foot('Lookup: '+((server&&server.error)||(result&&result.error)||('HTTP '+((result&&result.httpCode)||'?'))));
        return;
      }
      if(!server.found){setBadge('BAZA: ONLINE','ok');renderMissing(ean);return;}
      setBadge('BAZA: ONLINE','ok');
      renderProduct(server.product||{});
      return;
    }
    if(typeof previousUploadResult==='function')previousUploadResult(result);
  };

  var previousBarcode=window.onNativeBarcode;
  window.onNativeBarcode=function(payload){
    if(typeof previousBarcode==='function')previousBarcode(payload);
    var x=payload;
    if(typeof x==='string'){try{x=JSON.parse(x)}catch(e){x={}}}
    lookup(x&&x.code?x.code:'');
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installUi);else installUi();
})();
