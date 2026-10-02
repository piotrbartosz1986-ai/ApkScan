(function(){
'use strict';
var auth={verified:false,loggedIn:false,permission:'none',user:null};
window.BricoScannerAuth=auth;
try{localStorage.setItem('brico.upload.token','BRICOLAB_SESSION_AUTH')}catch(e){}
function parse(v){try{return typeof v==='string'?JSON.parse(v):(v||{})}catch(e){return{}}}
function dispatch(){try{window.dispatchEvent(new CustomEvent('brico-auth-change',{detail:auth}))}catch(e){}}
function apply(state){state=state||{};auth.verified=!!state.verified;auth.loggedIn=!!state.loggedIn;auth.permission=String(state.permission||'none');auth.user=state.user||null;try{localStorage.setItem('brico.upload.token','BRICOLAB_SESSION_AUTH')}catch(e){}dispatch()}
window.onBricoAuthResult=function(result){result=result||{};apply(result.state||{});if(!result.ok&&result.action!=='logout'){var e=String(result.error||'auth_error');if(e==='scanner_forbidden')alert('Konto nie ma dostępu do modułu Skaner.');else if(e==='credentials_changed'||e==='no_saved_session'||e==='invalid_refresh_token')alert('Sesja BricoLab wygasła. Uruchom aplikację ponownie.')}};
function verify(){try{if(window.BricoAuth&&typeof window.BricoAuth.verify==='function')window.BricoAuth.verify()}catch(e){}}
function boot(){try{if(window.BricoAuth&&typeof window.BricoAuth.getState==='function')apply(parse(window.BricoAuth.getState()))}catch(e){}verify();setInterval(verify,60000);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')verify()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
