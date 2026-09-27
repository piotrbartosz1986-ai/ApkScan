(function(){
  'use strict';

  var BTN_ID='bricoManualCodeBtnV47';
  var MODAL_ID='bricoManualCodeModalV47';
  var INPUT_ID='bricoManualCodeInputV47';
  var ERR_ID='bricoManualCodeErrV47';

  function ensureStyle(){
    if(document.getElementById('bricoManualCodeStyleV47'))return;
    var s=document.createElement('style');
    s.id='bricoManualCodeStyleV47';
    s.textContent='\
      #'+BTN_ID+'{min-height:24px!important;height:24px!important;padding:2px 7px!important;font-size:8px!important;font-weight:950!important;border-radius:8px!important;flex:0 0 auto!important;white-space:nowrap!important}\
      #'+MODAL_ID+'{position:fixed;inset:0;z-index:2600;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.76);padding:16px}\
      #'+MODAL_ID+'.show{display:flex}\
      #'+MODAL_ID+' .bricoManualBoxV47{width:min(390px,100%);background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:12px}\
      #'+MODAL_ID+' .bricoManualTitleV47{font-size:14px;font-weight:950;margin-bottom:8px}\
      #'+INPUT_ID+'{width:100%;height:50px;border-radius:10px;border:1px solid var(--line);background:#0b0f13;color:var(--text);font:900 20px/1 ui-monospace,SFMono-Regular,Consolas,monospace;padding:8px;text-align:center}\
      #'+ERR_ID+'{min-height:18px;margin-top:5px;font-size:9px;font-weight:800;color:var(--red)}\
      #'+MODAL_ID+' .bricoManualBtnsV47{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:5px}\
    ';
    document.head.appendChild(s);
  }

  function ensureButton(){
    var head=document.querySelector('.listHead');
    if(!head)return false;
    var badge=document.getElementById('bricoDbBadgeV40');
    if(!badge)return false;
    if(document.getElementById(BTN_ID))return true;
    var btn=document.createElement('button');
    btn.type='button';
    btn.id=BTN_ID;
    btn.textContent='⌨ KOD';
    btn.title='Wpisz kod ręcznie';
    btn.addEventListener('click',openModal);
    badge.parentNode.insertBefore(btn,badge);
    return true;
  }

  function ensureModal(){
    if(document.getElementById(MODAL_ID))return;
    var modal=document.createElement('div');
    modal.id=MODAL_ID;
    modal.innerHTML=''
      +'<div class="bricoManualBoxV47">'
      +'<div class="bricoManualTitleV47">Wpisz kod ręcznie</div>'
      +'<input id="'+INPUT_ID+'" type="text" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="EAN-8 lub EAN-13">'
      +'<div id="'+ERR_ID+'"></div>'
      +'<div class="bricoManualBtnsV47"><button type="button" id="bricoManualCancelV47">ANULUJ</button><button type="button" class="primary" id="bricoManualAddV47">DODAJ</button></div>'
      +'</div>';
    document.body.appendChild(modal);
    document.getElementById('bricoManualCancelV47').onclick=closeModal;
    document.getElementById('bricoManualAddV47').onclick=submitManual;
    var input=document.getElementById(INPUT_ID);
    input.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();submitManual()}
      if(e.key==='Escape'){e.preventDefault();closeModal()}
    });
    modal.addEventListener('click',function(e){if(e.target===modal)closeModal()});
  }

  function openModal(){
    ensureModal();
    var modal=document.getElementById(MODAL_ID),input=document.getElementById(INPUT_ID),err=document.getElementById(ERR_ID);
    if(err)err.textContent='';
    if(input)input.value='';
    modal.classList.add('show');
    setTimeout(function(){try{input.focus();input.select()}catch(e){}},40);
  }

  function closeModal(){
    var modal=document.getElementById(MODAL_ID);
    if(modal)modal.classList.remove('show');
  }

  function submitManual(){
    var input=document.getElementById(INPUT_ID),err=document.getElementById(ERR_ID);
    var code=String((input&&input.value)||'').replace(/\D/g,'');
    if(!/^(\d{8}|\d{13})$/.test(code)){
      if(err)err.textContent='Wpisz dokładnie 8 albo 13 cyfr.';
      try{input.focus()}catch(e){}
      return;
    }
    if(typeof window.onNativeBarcode!=='function'){
      if(err)err.textContent='Interfejs listy nie jest jeszcze gotowy.';
      return;
    }
    closeModal();
    window.onNativeBarcode({code:code,format:'MANUAL',timestamp:Date.now()});
  }

  function boot(){
    ensureStyle();
    ensureModal();
    if(ensureButton())return;
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(ensureButton()||tries>80)clearInterval(timer);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
