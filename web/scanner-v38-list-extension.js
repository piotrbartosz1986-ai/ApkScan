(function(){
  'use strict';

  var LIST_NAME_KEY='brico.list.name';

  function ensureStyle(){
    if(document.getElementById('bricoListV38Style')) return;
    var style=document.createElement('style');
    style.id='bricoListV38Style';
    style.textContent='\
      .bricoListNameV38{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:7px;margin:2px 0 7px}\
      .bricoListNameV38 label{font-size:8px;font-weight:900;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;white-space:nowrap}\
      .bricoListNameV38 input{width:100%;height:31px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);padding:4px 8px;font-size:11px;font-weight:750;outline:none}\
      .bricoListNameV38 input:focus{border-color:var(--green)}\
      html[data-brico-theme="light"] .bricoListNameV38 input{background:#fff!important;color:var(--text)!important;border-color:var(--line)!important}\
    ';
    document.head.appendChild(style);
  }

  function ensureListName(){
    if(document.getElementById('bricoListNameV38')) return;
    var list=document.getElementById('scanList');
    if(!list) return;
    var panel=list.closest('.panel');
    var head=panel&&panel.querySelector('.listHead');
    if(!panel||!head) return;
    var row=document.createElement('div');
    row.className='bricoListNameV38';
    row.innerHTML='<label for="bricoListNameV38">Nazwa listy</label><input id="bricoListNameV38" type="text" maxlength="80" placeholder="Lista" autocomplete="off">';
    head.insertAdjacentElement('afterend',row);
    var input=row.querySelector('input');
    try{ input.value=localStorage.getItem(LIST_NAME_KEY)||''; }catch(e){}
    input.addEventListener('input',function(){ try{ localStorage.setItem(LIST_NAME_KEY,this.value.slice(0,80)); }catch(e){} });
  }

  function prepare(){ensureStyle();ensureListName();}

  function boot(){prepare();setTimeout(prepare,120);setTimeout(prepare,500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
