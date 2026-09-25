(function(){
  'use strict';
  var originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      var url=typeof input==='string'?input:(input&&input.url?input.url:String(input));
      if(url.indexOf('/BricoLab/api/scanner_products.php')!==-1){
        var next=Object.assign({},init||{});
        var headers=new Headers(next.headers||(input instanceof Request?input.headers:undefined)||{});
        var token=(headers.get('X-Brico-Token')||localStorage.getItem('brico.upload.token')||'').trim();
        headers.delete('X-Brico-Token');
        next.headers=headers;
        if(token&&url.indexOf('&k=')===-1&&url.indexOf('?k=')===-1){
          url+=(url.indexOf('?')===-1?'?':'&')+'k='+encodeURIComponent(token);
        }
        return originalFetch(url,next);
      }
    }catch(e){}
    return originalFetch(input,init);
  };
})();