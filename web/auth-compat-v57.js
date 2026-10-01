(function(){
'use strict';

var AUTH_TOKEN='BRICOLAB_SESSION_AUTH';
var OLD_PRODUCTS='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_products.php';
var NEW_PRODUCTS='https://bricolab.pl/BricoLab/api/products.php';
var auth={verified:false,loggedIn:false,permission:'none',user:null};
window.BricoScannerAuth=auth;

/*
 * The newest Scanner/Converters UI still contains historical calls that expect
 * a local token value. Keep a non-secret compatibility marker internally, but
 * never show or use it as authentication. Native BricoAuthClient signs every
 * protected request with the logged-in BricoLab account.
 */
function seedLegacyCompat(){
  try{
    localStorage.setItem('brico.upload.token',AUTH_TOKEN);
    localStorage.setItem('brico.upload.endpoint','https://bricolab.pl/BricoLab/api/scanner_upload_v5.php');
  }catch(e){}
}
seedLegacyCompat();

function installAuthUiStyle(){
  if(document.getElementById('bricoAuthUiStyleV58'))return;
  var s=document.createElement('style');s.id='bricoAuthUiStyleV58';
  s.textContent='\
    #bricoUploadSettingsBox{display:none!important}\
    #bricoAccountBoxV58{display:block!important}\
    #bricoAccountBoxV58 .bricoAccountLineV58{margin:7px 0 9px;padding:9px 10px;border:1px solid var(--line,#29313a);border-radius:9px;background:var(--panel2,#0f1317);font-size:11px;font-weight:850;line-height:1.35}\
    #bricoLogoutBtnV58{width:100%;min-height:38px;border:1px solid #6b3636!important;background:#311919!important;color:#ffb0b0!important;font-weight:950!important}\
  ';
  document.head.appendChild(s);
}
installAuthUiStyle();

// Preserve the latest full XLSX -> IndexedDB database flow. The historical
// extension still points at the old OVH scanner_products endpoint and expects a
// static key. Rewrite only those product XLSX requests to the current public
// BricoLab products endpoint and strip the obsolete custom header.
var realFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url?input.url:String(input||''));
  if(url.indexOf(OLD_PRODUCTS)===0){
    url=NEW_PRODUCTS+url.slice(OLD_PRODUCTS.length);
    init=Object.assign({},init||{});
    var h=new Headers(init.headers||{});
    h.delete('X-Brico-Token');
    h.delete('Authorization');
    init.headers=h;
    return realFetch(url,init);
  }
  return realFetch(input,init);
};

function parse(v){try{return typeof v==='string'?JSON.parse(v):(v||{})}catch(e){return{}}}
function dispatch(){try{window.dispatchEvent(new CustomEvent('brico-auth-change',{detail:auth}))}catch(e){}}
function apply(state){
  state=state||{};
  auth.verified=!!state.verified;
  auth.loggedIn=!!state.loggedIn;
  auth.permission=String(state.permission||'none');
  auth.user=state.user||auth.user||null;
  seedLegacyCompat();
  refreshAccountPanel();
  dispatch();
}
function block(message){
  try{if(window.NativeScanner&&typeof window.NativeScanner.stopScanner==='function')window.NativeScanner.stopScanner()}catch(e){}
  var o=document.getElementById('bricoAuthLostV57');
  if(!o){
    o=document.createElement('div');o.id='bricoAuthLostV57';
    o.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#0b0d10;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
    o.innerHTML='<div style="max-width:420px;text-align:center"><div style="font-size:25px;font-weight:950">BricoLab — sesja wygasła</div><div id="bricoAuthLostTextV57" style="margin-top:12px;color:#b4bcc5;line-height:1.45"></div><button id="bricoAuthLostLogoutV57" style="width:100%;height:48px;margin-top:18px;border:0;border-radius:10px;background:#1e7d47;color:#fff;font-weight:900">WRÓĆ DO LOGOWANIA</button></div>';
    document.body.appendChild(o);
    document.getElementById('bricoAuthLostLogoutV57').onclick=function(){try{window.BricoAuth.logout()}catch(e){location.reload()}};
  }
  var t=document.getElementById('bricoAuthLostTextV57');if(t)t.textContent=message||'Uruchom ponownie logowanie do BricoLab.';
  o.style.display='flex';
}
function unblock(){var o=document.getElementById('bricoAuthLostV57');if(o)o.style.display='none'}

window.onBricoAuthResult=function(result){
  result=result||{};apply(result.state||{});
  if(result.action==='logout')return;
  if(result.ok&&auth.loggedIn){unblock();return}
  var e=String(result.error||'auth_error');
  var msg=e==='scanner_forbidden'?'Konto nie ma dostępu do modułu Skaner.':
    e==='account_inactive'?'Konto zostało wyłączone w ACCESSIS.':
    e==='credentials_changed'?'Hasło zostało zmienione. Zaloguj się ponownie.':
    e==='password_change_required'?'Najpierw zmień hasło pierwszego logowania w BricoLab.':
    'Sesja BricoLab jest nieważna. Zaloguj się ponownie.';
  block(msg);
};

function verify(){
  if(!(window.BricoAuth&&typeof window.BricoAuth.verify==='function'))return;
  try{window.BricoAuth.verify()}catch(e){}
}
function displayName(){
  var u=auth.user||{};
  return String(u.login||u.name||u.displayName||'BricoLab');
}
function permissionLabel(){
  return auth.permission==='edit'?'EDYCJA':auth.permission==='view'?'PODGLĄD':'BRAK DOSTĘPU';
}
function logout(){
  var b=document.getElementById('bricoLogoutBtnV58');
  if(b){b.disabled=true;b.textContent='WYLOGOWYWANIE…'}
  try{
    if(window.BricoAuth&&typeof window.BricoAuth.logout==='function')window.BricoAuth.logout();
    else location.reload();
  }catch(e){location.reload()}
}
function ensureAccountPanel(){
  var actions=document.querySelector('#settingsModal .settingsActions');
  if(!actions)return null;
  var box=document.getElementById('bricoAccountBoxV58');
  if(!box){
    box=document.createElement('section');
    box.className='settingSec';box.id='bricoAccountBoxV58';
    box.innerHTML='<div class="settingTitle">Konto BricoLab</div><div class="bricoAccountLineV58" id="bricoAccountLineV58">Sprawdzam konto…</div><button type="button" id="bricoLogoutBtnV58">WYLOGUJ</button>';
    actions.parentNode.insertBefore(box,actions);
    document.getElementById('bricoLogoutBtnV58').onclick=logout;
  }
  return box;
}
function refreshAccountPanel(){
  var box=ensureAccountPanel();if(!box)return;
  var line=document.getElementById('bricoAccountLineV58');
  if(line)line.textContent=auth.loggedIn?(displayName()+' · '+permissionLabel()):'Brak aktywnej sesji BricoLab';
  var b=document.getElementById('bricoLogoutBtnV58');if(b){b.disabled=!auth.loggedIn;b.textContent='WYLOGUJ'}
}
function hideLegacyConnection(){
  seedLegacyCompat();
  installAuthUiStyle();
  var box=document.getElementById('bricoUploadSettingsBox');if(box)box.style.setProperty('display','none','important');
  var status=document.getElementById('bricoUploadStatus');
  if(status){
    status.textContent=auth.loggedIn?('Wysyłanie przez konto '+displayName()+' • '+permissionLabel()):'Brak aktywnej sesji BricoLab';
  }
  refreshAccountPanel();
}
function watchSettings(){
  if(!('MutationObserver' in window))return;
  var obs=new MutationObserver(function(){hideLegacyConnection()});
  obs.observe(document.documentElement,{childList:true,subtree:true});
}
function boot(){
  seedLegacyCompat();
  installAuthUiStyle();
  if(window.BricoAuth&&typeof window.BricoAuth.getState==='function')apply(parse(window.BricoAuth.getState()));
  verify();
  hideLegacyConnection();
  watchSettings();
  setTimeout(hideLegacyConnection,150);
  setTimeout(hideLegacyConnection,700);
  setInterval(function(){verify();hideLegacyConnection()},60000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){verify();hideLegacyConnection()}});
  window.addEventListener('brico-auth-change',function(){setTimeout(hideLegacyConnection,0)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
