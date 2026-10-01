(function(){
'use strict';

var AUTH_TOKEN='BRICOLAB_SESSION_AUTH';
var OLD_PRODUCTS='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_products.php';
var NEW_PRODUCTS='https://bricolab.pl/BricoLab/api/products.php';
var auth={verified:false,loggedIn:false,permission:'none',user:null};
window.BricoScannerAuth=auth;

function seedLegacyCompat(){
  try{
    localStorage.setItem('brico.upload.token',AUTH_TOKEN);
    localStorage.setItem('brico.upload.endpoint','https://bricolab.pl/BricoLab/api/scanner_upload_v5.php');
  }catch(e){}
}
seedLegacyCompat();

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
function hideLegacyConnection(){
  seedLegacyCompat();
  var box=document.getElementById('bricoUploadSettingsBox');if(box)box.style.display='none';
  var status=document.getElementById('bricoUploadStatus');
  if(status){
    var name=(auth.user&&(auth.user.login||auth.user.name))||'BricoLab';
    status.textContent='Wysyłanie przez konto '+name+(auth.permission?(' • '+auth.permission.toUpperCase()):'');
  }
}
function boot(){
  seedLegacyCompat();
  if(window.BricoAuth&&typeof window.BricoAuth.getState==='function')apply(parse(window.BricoAuth.getState()));
  verify();
  hideLegacyConnection();
  setTimeout(hideLegacyConnection,500);
  setInterval(function(){verify();hideLegacyConnection()},60000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){verify();hideLegacyConnection()}});
  window.addEventListener('brico-auth-change',function(){setTimeout(hideLegacyConnection,0)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
