(function(){
  'use strict';
  var originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      var url=typeof input==='string'?input:(input&&input.url?input.url:String(input));
      if(url.indexOf('/BricoLab/api/products.php')!==-1){
        var next=Object.assign({},init||{});
        var headers=new Headers(next.headers||(input instanceof Request?input.headers:undefined)||{});
        headers.delete('X-Brico-Token');
        headers.delete('Authorization');
        next.headers=headers;
        return originalFetch(url,next);
      }
    }catch(e){}
    return originalFetch(input,init);
  };
})();