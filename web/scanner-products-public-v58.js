(function(){
'use strict';

var LEGACY_PRODUCTS='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_products.php';
var CURRENT_PRODUCTS='https://bricolab.pl/BricoLab/api/products.php';
var COMPAT_TOKEN='BRICOLAB_PRODUCTS_PUBLIC';

// v3.3.11 sprawdza tylko, czy istnieje dawny klucz zanim rozpocznie synchronizację.
// Nie używamy tu sekretu: aktualny endpoint produktów jest publicznym endpointem odczytu.
try{
  if(!String(localStorage.getItem('brico.upload.token')||'').trim()){
    localStorage.setItem('brico.upload.token',COMPAT_TOKEN);
  }
}catch(e){}

var realFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url?input.url:String(input||''));
  if(url.indexOf(LEGACY_PRODUCTS)===0){
    url=CURRENT_PRODUCTS+url.slice(LEGACY_PRODUCTS.length);
    init=Object.assign({},init||{});
    var headers=new Headers(init.headers||{});
    headers.delete('X-Brico-Token');
    headers.delete('Authorization');
    init.headers=headers;
    return realFetch(url,init);
  }
  return realFetch(input,init);
};

window.__BRICO_PRODUCTS_PUBLIC_COMPAT=true;
})();
