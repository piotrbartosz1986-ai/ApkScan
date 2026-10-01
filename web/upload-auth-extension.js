(function(){
  'use strict';

  var ENDPOINT='https://files.bricolab.pl/BricoLab/api/scanner_upload_v5.php';
  var nativeTimer=null;

  function authState(){return window.BricoScannerAuth||{verified:false,loggedIn:false,permission:'none',user:null}}
  function canEdit(){var a=authState();return !!(a.verified&&a.loggedIn&&a.permission==='edit')}
  function hasNative(){return !!(window.BricoUpload&&typeof window.BricoUpload.uploadJsonAuth==='function')}
  function status(msg,ok){var e=document.getElementById('bricoUploadStatus');if(!e)return;e.textContent=msg;e.style.color=ok===true?'#36d27f':ok===false?'#ff6969':'#9aa5b1'}
  function collect(){return [].slice.call(document.querySelectorAll('#scanList .item')).map(function(row){var code=row.querySelector('.code');var qtyInput=row.querySelector('[data-act=qty]');var ean=((code&&code.textContent)||'').trim();var qty=Math.max(1,parseInt(qtyInput?qtyInput.value:'1',10)||1);return [ean,qty]}).filter(function(x){return /^(\d{8}|\d{13})$/.test(x[0])})}
  function listName(){var ids=['listName','listNameInput','scanListName'];for(var i=0;i<ids.length;i++){var e=document.getElementById(ids[i]);if(e&&String(e.value||'').trim())return String(e.value).trim()}return ''}
  function reset(delay){var b=document.getElementById('bricoUploadBtn');setTimeout(function(){if(!b)return;b.disabled=!canEdit();b.textContent='WYŚLIJ DO GENERATORA'},delay||2200)}
  function success(data){var b=document.getElementById('bricoUploadBtn');status('Wysłano '+(data.items||'?')+' poz. / '+(data.qty||'?')+' szt.'+(data.user?' • '+data.user:''),true);if(b)b.textContent='WYSŁANO ✓';reset(2200)}
  function fail(message){var b=document.getElementById('bricoUploadBtn');status('Błąd: '+message,false);if(b)b.textContent='BŁĄD — SPRÓBUJ';reset(2400)}

  var prevResult=window.onNativeUploadResult;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:null;
    if(server&&server.kind==='PRODUCT_LOOKUP'){if(typeof prevResult==='function')prevResult(result);return}
    if(nativeTimer){clearTimeout(nativeTimer);nativeTimer=null}
    if(result&&result.transport==='bricolab-user-auth'){
      if(!result.ok||!server||!server.ok){fail((result&&result.error)||(server&&server.error)||('HTTP '+((result&&result.httpCode)||'?')));return}
      success(server);return;
    }
    if(typeof prevResult==='function')prevResult(result);
  };

  function send(){
    if(!canEdit()){status('Twoje konto nie ma uprawnienia Skaner = Edycja.',false);return}
    if(!hasNative()){status('Brak natywnego transportu BricoLab.',false);return}
    var items=collect();if(!items.length){status('Lista jest pusta.',false);return}
    var b=document.getElementById('bricoUploadBtn');if(b){b.disabled=true;b.textContent='WYSYŁAM…'}
    status('Wysyłanie '+items.length+' pozycji jako zalogowany użytkownik…',null);
    var payload={type:'LABELS',device:'BricoScanner',created:new Date().toISOString(),items:items};var n=listName();if(n){payload.listName=n;payload.name=n}
    try{window.BricoUpload.uploadJsonAuth(ENDPOINT,JSON.stringify(payload));nativeTimer=setTimeout(function(){nativeTimer=null;fail('Brak odpowiedzi serwera po 20 s')},20000)}catch(e){fail(e.message||String(e))}
  }

  function refresh(){var b=document.getElementById('bricoUploadBtn');if(!b)return;var a=authState();b.disabled=!canEdit();if(canEdit()){status('Wysyłanie przez konto BricoLab • '+((a.user&&a.user.login)||'zalogowano'),true)}else if(a.verified&&a.loggedIn){status('Podgląd: wysyłanie wymaga Skaner = Edycja.',null)}else{status('Najpierw zaloguj się do BricoLab.',false)}}
  function install(){
    try{localStorage.removeItem('brico.upload.token')}catch(e){}
    var legacy=document.getElementById('bricoUploadSettingsBox');if(legacy)legacy.style.display='none';
    var b=document.getElementById('bricoUploadBtn');
    if(b){b.onclick=send;b.textContent='WYŚLIJ DO GENERATORA';refresh();return}
    var exportBtn=document.getElementById('exportJsonBtn');if(!exportBtn)return;
    var serverBtn=document.getElementById('serverConfigBtn');if(serverBtn)serverBtn.style.display='none';
    var panel=exportBtn.parentElement.parentElement;var grid=exportBtn.parentElement;
    b=document.createElement('button');b.id='bricoUploadBtn';b.className='primary';b.style.gridColumn='1/-1';b.textContent='WYŚLIJ DO GENERATORA';b.onclick=send;grid.appendChild(b);
    var s=document.createElement('div');s.id='bricoUploadStatus';s.style.cssText='font-size:8px;color:#9aa5b1;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';panel.appendChild(s);refresh();
  }
  window.addEventListener('brico-auth-change',function(){install();refresh()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();