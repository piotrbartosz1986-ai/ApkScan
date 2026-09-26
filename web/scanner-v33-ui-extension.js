(function(){
  'use strict';

  function install(){
    if(document.documentElement.dataset.v33ui==='1')return;
    document.documentElement.dataset.v33ui='1';

    var style=document.createElement('style');
    style.textContent='\
      .top{height:40px!important;display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:5px!important}\
      .brand{font-size:15px!important;white-space:nowrap!important}\
      .topQuick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;min-width:0}\
      .topQuick button{min-height:30px!important;height:30px!important;padding:2px 4px!important;font-size:10px!important;border-radius:8px!important;white-space:nowrap!important}\
      .topQuick button.sel{background:#213229!important;border-color:#355845!important;color:var(--green)!important}\
      .gear{width:34px!important;height:32px!important;min-height:0!important}\
      .quick{display:none!important}\
      #clearTopBtn{display:none!important}\
      #exportPanel{display:none!important}\
      .listActionsV33{display:grid;grid-template-columns:.9fr 1.55fr;gap:5px;margin-top:6px}\
      .listActionsV33 button{min-height:34px!important;font-size:9.5px!important}\
      .listActionsV33 #clearBottomBtn{display:block!important;margin:0!important;width:auto!important;min-height:34px!important}\
      .listActionsV33 #bricoUploadBtn{grid-column:auto!important;margin:0!important}\
      #bricoUploadStatus{margin-top:4px!important}\
      @media(max-width:380px){.brand{font-size:14px!important}.topQuick button{font-size:9px!important;padding:1px 2px!important}.top{gap:3px!important}}\
    ';
    document.head.appendChild(style);

    var brand=document.querySelector('.brand');
    if(brand)brand.textContent='Skaner';

    var top=document.querySelector('.top');
    var quick=document.querySelector('.quick');
    var gear=document.getElementById('settingsBtn');
    var continuous=document.getElementById('modeContinuous');
    var single=document.getElementById('modeSingle');
    var autoQty=document.getElementById('qtyAuto');
    var askQty=document.getElementById('qtyAsk');

    if(top && continuous && single && autoQty && askQty){
      var topQuick=document.createElement('div');
      topQuick.className='topQuick';

      continuous.textContent='∞';
      continuous.title='Tryb ciągły';
      continuous.setAttribute('aria-label','Tryb ciągły');

      single.textContent='1×';
      single.title='Tryb pojedynczy';
      single.setAttribute('aria-label','Tryb pojedynczy');

      autoQty.textContent='+1 szt.';
      autoQty.title='Dodawaj po jednej sztuce';
      autoQty.setAttribute('aria-label','Dodawaj po jednej sztuce');

      askQty.textContent='(× szt.)';
      askQty.title='Pytaj o ilość';
      askQty.setAttribute('aria-label','Pytaj o ilość');

      topQuick.appendChild(continuous);
      topQuick.appendChild(single);
      topQuick.appendChild(autoQty);
      topQuick.appendChild(askQty);
      if(gear)top.insertBefore(topQuick,gear);else top.appendChild(topQuick);
    }
    if(quick)quick.style.display='none';

    var clearTop=document.getElementById('clearTopBtn');
    if(clearTop)clearTop.style.display='none';

    var list=document.getElementById('scanList');
    var clearBottom=document.getElementById('clearBottomBtn');
    var upload=document.getElementById('bricoUploadBtn');
    var uploadStatus=document.getElementById('bricoUploadStatus');
    var listPanel=list?list.closest('.panel'):null;

    if(listPanel && clearBottom && upload){
      clearBottom.textContent='WYCZYŚĆ';
      clearBottom.className='danger';

      var actions=document.createElement('div');
      actions.className='listActionsV33';
      actions.appendChild(clearBottom);
      actions.appendChild(upload);
      listPanel.appendChild(actions);
      if(uploadStatus)listPanel.appendChild(uploadStatus);
    }

    var exportJson=document.getElementById('exportJsonBtn');
    var exportExcel=document.getElementById('exportExcelBtn');
    var exportPanel=document.getElementById('exportPanel');
    if(exportJson)exportJson.style.display='none';
    if(exportExcel)exportExcel.style.display='none';
    if(exportPanel)exportPanel.style.display='none';
  }

  function boot(){setTimeout(install,0);setTimeout(install,120);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
