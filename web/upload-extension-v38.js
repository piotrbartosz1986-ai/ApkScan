(function(){
  'use strict';

  var ENDPOINT_KEY='brico.upload.endpoint';
  var TOKEN_KEY='brico.upload.token';
  var LIST_NAME_KEY='brico.list.name';
  var DEFAULT_ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/api/upload.php';
  var nativeTimer=null;

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

  function getEndpoint(){return (localStorage.getItem(ENDPOINT_KEY)||DEFAULT_ENDPOINT).trim()}
  function getToken(){return (localStorage.getItem(TOKEN_KEY)||'').trim()}
  function getListName(){
    var input=document.getElementById('bricoListNameV38');
    var value=((input&&input.value)||localStorage.getItem(LIST_NAME_KEY)||'').trim();
    return value||'Lista';
  }
  function hasNativeUpload(){return !!(window.BricoUpload&&typeof window.BricoUpload.uploadJson==='function')}

  function fillSettings(){
    var ep=document.getElementById('bricoEndpointInput'),tk=document.getElementById('bricoTokenInput');
    if(ep)ep.value=getEndpoint();
    if(tk)tk.value=getToken();
  }

  function openSettings(){
    var main=document.getElementById('settingsBtn');
    if(main)main.click();
    fillSettings();
    setTimeout(function(){var sec=document.getElementById('bricoUploadSettingsBox');if(sec)sec.scrollIntoView({behavior:'smooth',block:'center'});},80);
  }

  function saveSettings(){
    var endpoint=(document.getElementById('bricoEndpointInput').value||'').trim();
    var token=(document.getElementById('bricoTokenInput').value||'').trim();
    if(!endpoint||endpoint.indexOf('https://')!==0){status('Adres musi zaczynać się od https://',false);return;}
    if(!token){status('Wpisz klucz wysyłania.',false);return;}
    localStorage.setItem(ENDPOINT_KEY,endpoint);
    localStorage.setItem(TOKEN_KEY,token);
    status('Wysyłanie gotowe • '+(hasNativeUpload()?'JAVA':'FETCH'),true);
  }

  function resetButton(delay){
    var btn=document.getElementById('bricoUploadBtn');
    setTimeout(function(){if(!btn)return;btn.disabled=false;btn.textContent='WYŚLIJ DO GENERATORA';},delay||2200);
  }

  function finishSuccess(data){
    var btn=document.getElementById('bricoUploadBtn');
    status('Wysłano '+(data.items||'?')+' poz. / '+(data.qty||'?')+' szt.',true);
    if(btn)btn.textContent='WYSŁANO ✓';
    resetButton(2200);
  }

  function finishError(message){
    var btn=document.getElementById('bricoUploadBtn');
    status('Błąd: '+message,false);
    if(btn)btn.textContent='BŁĄD — SPRÓBUJ';
    resetButton(2400);
  }

  window.onNativeUploadResult=function(result){
    if(nativeTimer){clearTimeout(nativeTimer);nativeTimer=null;}
    try{
      var data=result&&result.server?result.server:{};
      if(!result||!result.ok||!data.ok){finishError((result&&result.error)||(data&&data.error)||('HTTP '+((result&&result.httpCode)||'?')));return;}
      finishSuccess(data);
    }catch(e){finishError(e.message||String(e));}
  };

  async function send(){
    var endpoint=getEndpoint(),token=getToken();
    if(!token){openSettings();status('Ustaw klucz wysyłania.',false);return;}
    var items=collectVisibleItems();
    if(!items.length){status('Lista jest pusta.',false);return;}

    var btn=document.getElementById('bricoUploadBtn');
    btn.disabled=true;btn.textContent='WYSYŁAM…';
    status('Wysyłanie '+items.length+' pozycji…',null);

    var listName=getListName();
    var payload={type:'LABELS',device:'BricoScanner',created:new Date().toISOString(),name:listName,listName:listName,items:items};
    if(hasNativeUpload()){
      try{
        window.BricoUpload.uploadJson(endpoint,token,JSON.stringify(payload));
        nativeTimer=setTimeout(function(){nativeTimer=null;finishError('Brak odpowiedzi JAVA po 20 s');},20000);
      }catch(e){finishError(e.message||String(e));}
      return;
    }

    try{
      var res=await fetch(endpoint,{method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(payload)});
      var text=await res.text(),data={};try{data=JSON.parse(text)}catch(e){}
      if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
      finishSuccess(data);
    }catch(e){finishError(e.message||e);}
  }

  function install(){
    if(document.getElementById('bricoUploadBtn'))return;
    var exportBtn=document.getElementById('exportJsonBtn');
    if(!exportBtn)return;

    var serverBtn=document.getElementById('serverConfigBtn');
    if(serverBtn)serverBtn.style.display='none';

    var panel=exportBtn.parentElement.parentElement;
    var grid=exportBtn.parentElement;

    var btn=document.createElement('button');
    btn.id='bricoUploadBtn';btn.className='primary';btn.style.gridColumn='1/-1';btn.textContent='WYŚLIJ DO GENERATORA';btn.onclick=send;grid.appendChild(btn);

    var s=document.createElement('div');
    s.id='bricoUploadStatus';
    s.style.cssText='font-size:8px;color:#9aa5b1;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    s.textContent=getToken()?'Wysyłanie gotowe':'Klucz wysyłania ustawisz pod ⚙';
    panel.appendChild(s);

    var actions=document.querySelector('#settingsModal .settingsActions');
    if(actions){
      var sec=document.createElement('section');
      sec.className='settingSec';sec.id='bricoUploadSettingsBox';
      sec.innerHTML=''
        +'<div class="settingTitle">Połączenie z BricoLab</div>'
        +'<div class="field"><label>Adres wysyłania HTTPS</label><input id="bricoEndpointInput" type="text" autocomplete="off"></div>'
        +'<div class="field" style="margin-top:6px"><label>Klucz wysyłania / bazy</label><input id="bricoTokenInput" type="password" autocomplete="off" style="width:100%;height:35px;border-radius:8px;border:1px solid #29313a;background:#0b0f13;color:#f5f7fa;padding:5px 7px;font-size:12px"></div>'
        +'<button id="bricoSaveSettings" type="button" class="primary" style="width:100%;margin-top:7px">ZAPISZ POŁĄCZENIE</button>';
      actions.parentNode.insertBefore(sec,actions);
      fillSettings();
      document.getElementById('bricoSaveSettings').onclick=saveSettings;
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
