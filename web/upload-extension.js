(function(){
  'use strict';
  var ENDPOINT_KEY='brico.upload.endpoint';
  var TOKEN_KEY='brico.upload.token';

  function status(msg, ok){
    var e=document.getElementById('bricoUploadStatus');
    if(e){e.textContent=msg;e.style.color=ok===true?'#36d27f':ok===false?'#ff6969':'#9aa5b1';}
  }

  function collectVisibleItems(){
    var rows=[].slice.call(document.querySelectorAll('#scanList .item'));
    return rows.map(function(row){
      var ean=(row.querySelector('.code')||{}).textContent||'';
      var qtyInput=row.querySelector('[data-act=qty]');
      var qty=Math.max(1,parseInt(qtyInput?qtyInput.value:'1',10)||1);
      return [ean.trim(),qty];
    }).filter(function(x){return /^\d{8}$|^\d{13}$/.test(x[0]);});
  }

  async function send(){
    var endpoint=localStorage.getItem(ENDPOINT_KEY)||'';
    if(!endpoint){endpoint=(prompt('Adres wysyłania BricoLab (HTTPS):','')||'').trim();if(endpoint)localStorage.setItem(ENDPOINT_KEY,endpoint);}
    if(!endpoint)return;
    var token=localStorage.getItem(TOKEN_KEY)||'';
    if(!token){token=(prompt('Klucz wysyłania BricoLab:','')||'').trim();if(token)localStorage.setItem(TOKEN_KEY,token);}
    if(!token)return;
    var items=collectVisibleItems();
    if(!items.length){status('Lista jest pusta.',false);return;}
    if(!confirm('Wysłać '+items.length+' pozycji do generatora etykiet?'))return;

    var btn=document.getElementById('bricoUploadBtn');
    btn.disabled=true;btn.textContent='WYSYŁAM…';status('Wysyłanie…',null);
    try{
      var res=await fetch(endpoint,{method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({type:'LABELS',device:'BricoScanner',created:new Date().toISOString(),items:items})});
      var text=await res.text(),data={};try{data=JSON.parse(text)}catch(e){}
      if(!res.ok||!data.ok)throw new Error(data.error||('HTTP '+res.status));
      status('Wysłano '+data.items+' pozycji / '+data.qty+' szt. • '+data.file,true);btn.textContent='WYSŁANO ✓';
    }catch(e){status('Błąd: '+(e.message||e),false);btn.textContent='BŁĄD — SPRÓBUJ';}
    setTimeout(function(){btn.disabled=false;btn.textContent='WYŚLIJ DO GENERATORA ETYKIET';},2400);
  }

  function install(){
    if(document.getElementById('bricoUploadBtn'))return;
    var exportBtn=document.getElementById('exportJsonBtn');
    if(!exportBtn)return;
    var grid=exportBtn.parentElement;
    var btn=document.createElement('button');btn.id='bricoUploadBtn';btn.className='primary';btn.style.gridColumn='1/-1';btn.textContent='WYŚLIJ DO GENERATORA ETYKIET';btn.onclick=send;grid.appendChild(btn);
    var line=document.createElement('div');line.style.cssText='display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px';
    var s=document.createElement('div');s.id='bricoUploadStatus';s.className='small';s.textContent='Serwer: nie skonfigurowano na tym telefonie';line.appendChild(s);
    var reset=document.createElement('button');reset.textContent='USTAWIENIA';reset.style.cssText='min-height:32px;font-size:10px;padding:4px 8px';reset.onclick=function(){localStorage.removeItem(ENDPOINT_KEY);localStorage.removeItem(TOKEN_KEY);status('Ustawienia wysyłania wyczyszczone.',null);};line.appendChild(reset);
    grid.parentElement.appendChild(line);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
