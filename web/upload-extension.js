(function(){
  'use strict';

  var ENDPOINT_KEY='brico.upload.endpoint';
  var TOKEN_KEY='brico.upload.token';
  var DEFAULT_ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/api/upload.php';

  function status(msg, ok){
    var e=document.getElementById('bricoUploadStatus');
    if(!e)return;
    e.textContent=msg;
    e.style.color=ok===true?'#36d27f':ok===false?'#ff6969':'#9aa5b1';
  }

  function collectVisibleItems(){
    return [].slice.call(document.querySelectorAll('#scanList .item')).map(function(row){
      var code=row.querySelector('.code');
      var qtyInput=row.querySelector('[data-act=qty]');
      var ean=((code&&code.textContent)||'').trim();
      var qty=Math.max(1,parseInt(qtyInput?qtyInput.value:'1',10)||1);
      return [ean,qty];
    }).filter(function(x){return /^(\d{8}|\d{13})$/.test(x[0]);});
  }

  function getEndpoint(){
    return (localStorage.getItem(ENDPOINT_KEY)||DEFAULT_ENDPOINT).trim();
  }

  function getToken(){
    return (localStorage.getItem(TOKEN_KEY)||'').trim();
  }

  function closeSettings(){
    var box=document.getElementById('bricoUploadSettingsBox');
    if(box)box.style.display='none';
  }

  function openSettings(){
    var box=document.getElementById('bricoUploadSettingsBox');
    if(!box)return;
    document.getElementById('bricoEndpointInput').value=getEndpoint();
    document.getElementById('bricoTokenInput').value=getToken();
    box.style.display='block';
    status('Wpisz adres i klucz, a potem ZAPISZ.',null);
    setTimeout(function(){document.getElementById('bricoTokenInput').focus();},100);
  }

  function saveSettings(){
    var endpoint=(document.getElementById('bricoEndpointInput').value||'').trim();
    var token=(document.getElementById('bricoTokenInput').value||'').trim();
    if(!endpoint || endpoint.indexOf('https://')!==0){status('Adres musi zaczynać się od https://',false);return;}
    if(!token){status('Wpisz klucz wysyłania.',false);return;}
    localStorage.setItem(ENDPOINT_KEY,endpoint);
    localStorage.setItem(TOKEN_KEY,token);
    closeSettings();
    status('Wysyłanie skonfigurowane. Możesz wysłać listę.',true);
  }

  async function send(){
    var endpoint=getEndpoint();
    var token=getToken();
    if(!token){openSettings();return;}

    var items=collectVisibleItems();
    if(!items.length){status('Lista jest pusta.',false);return;}

    var btn=document.getElementById('bricoUploadBtn');
    btn.disabled=true;
    btn.textContent='WYSYŁAM…';
    status('Wysyłanie '+items.length+' pozycji…',null);

    try{
      var res=await fetch(endpoint,{
        method:'POST',
        mode:'cors',
        cache:'no-store',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+token
        },
        body:JSON.stringify({
          type:'LABELS',
          device:'BricoScanner',
          created:new Date().toISOString(),
          items:items
        })
      });

      var text=await res.text();
      var data={};
      try{data=JSON.parse(text);}catch(e){}
      if(!res.ok || !data.ok)throw new Error(data.error||('HTTP '+res.status));

      status('Wysłano '+data.items+' pozycji / '+data.qty+' szt. • '+data.file,true);
      btn.textContent='WYSŁANO ✓';
    }catch(e){
      status('Błąd wysyłania: '+(e.message||e),false);
      btn.textContent='BŁĄD — SPRÓBUJ';
    }

    setTimeout(function(){
      btn.disabled=false;
      btn.textContent='WYŚLIJ DO GENERATORA ETYKIET';
    },2400);
  }

  function install(){
    if(document.getElementById('bricoUploadBtn'))return;
    var exportBtn=document.getElementById('exportJsonBtn');
    if(!exportBtn)return;

    var panel=exportBtn.parentElement.parentElement;
    var grid=exportBtn.parentElement;

    var btn=document.createElement('button');
    btn.id='bricoUploadBtn';
    btn.className='primary';
    btn.style.gridColumn='1/-1';
    btn.textContent='WYŚLIJ DO GENERATORA ETYKIET';
    btn.onclick=send;
    grid.appendChild(btn);

    var line=document.createElement('div');
    line.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px';

    var s=document.createElement('div');
    s.id='bricoUploadStatus';
    s.className='small';
    s.textContent=getToken()?'Wysyłanie skonfigurowane.':'Wysyłanie nie jest jeszcze skonfigurowane.';
    line.appendChild(s);

    var settings=document.createElement('button');
    settings.textContent='USTAWIENIA';
    settings.style.cssText='min-height:32px;font-size:10px;padding:4px 8px';
    settings.onclick=openSettings;
    line.appendChild(settings);
    panel.appendChild(line);

    var box=document.createElement('div');
    box.id='bricoUploadSettingsBox';
    box.style.cssText='display:none;margin-top:10px;padding:10px;border:1px solid #29313a;border-radius:12px;background:#0f1317';
    box.innerHTML=''
      +'<div style="font-size:11px;font-weight:900;margin-bottom:8px">WYSYŁANIE DO BRICOLAB</div>'
      +'<div style="font-size:10px;color:#9aa5b1;margin-bottom:4px">Adres HTTPS</div>'
      +'<input id="bricoEndpointInput" type="text" autocomplete="off" style="width:100%;height:40px;border-radius:9px;border:1px solid #29313a;background:#0b0f13;color:#f5f7fa;padding:8px;font-size:11px;margin-bottom:8px">'
      +'<div style="font-size:10px;color:#9aa5b1;margin-bottom:4px">Klucz wysyłania</div>'
      +'<input id="bricoTokenInput" type="password" autocomplete="off" style="width:100%;height:40px;border-radius:9px;border:1px solid #29313a;background:#0b0f13;color:#f5f7fa;padding:8px;font-size:11px;margin-bottom:8px">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +'<button id="bricoCancelSettings" type="button">ANULUJ</button>'
      +'<button id="bricoSaveSettings" type="button" class="primary">ZAPISZ</button>'
      +'</div>';
    panel.appendChild(box);

    document.getElementById('bricoSaveSettings').onclick=saveSettings;
    document.getElementById('bricoCancelSettings').onclick=closeSettings;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
