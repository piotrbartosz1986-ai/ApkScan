(function(){
'use strict';

var MODE_KEY='brico.workMode.v48';
var STORE_KEY='brico.converters.items.v48';
var TOKEN_KEY='brico.upload.token';
var SUBJECT_KEY='brico.converters.subject.v56';
var WORKER_KEY='brico.converters.worker.v56';
var DEPT_KEY='brico.converters.department.v56';
var SHOP='08042';
var ENDPOINT='https://gahbowq.cluster129.hosting.ovh.net/BricoLab/api/scanner_converters.php';
var busy=false;
var restoreHandler=null;
var timer=0;
var DEPARTMENTS=['Dekoracja','Majsterkowanie','Budowlanka','Ogród','Kasy'];

function clean(v){return String(v==null?'':v).trim()}
function mode(){try{return localStorage.getItem(MODE_KEY)==='converters'?'converters':'scanner'}catch(e){return'scanner'}}
function isConverters(){return mode()==='converters'}
function read(key){try{return clean(localStorage.getItem(key)||'')}catch(e){return''}}
function write(key,value){try{localStorage.setItem(key,String(value||''))}catch(e){}}
function token(){return read(TOKEN_KEY)}
function items(){try{var a=JSON.parse(localStorage.getItem(STORE_KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function displayedName(code,fallback){
  var rows=[].slice.call(document.querySelectorAll('#bricoConverterListV48 .bricoConvRowV48'));
  for(var i=0;i<rows.length;i++){
    var meta=rows[i].querySelector('.bricoConvMetaV48');
    if(clean(meta&&meta.textContent)===String(code)){
      var name=rows[i].querySelector('.bricoConvNameV48');
      if(clean(name&&name.textContent))return clean(name.textContent);
    }
  }
  return clean(fallback||'');
}
function setStatus(text,state){
  var e=document.getElementById('bricoConverterSendStatusV52');if(!e)return;
  e.textContent=text||'';
  e.style.color=state==='ok'?'#36d27f':state==='error'?'#ff6969':'var(--muted)';
}
function metadata(){
  var subject=clean((document.getElementById('bricoConvSubjectV56')||{}).value||read(SUBJECT_KEY));
  var worker=clean((document.getElementById('bricoConvWorkerV56')||{}).value||read(WORKER_KEY));
  var department=clean((document.getElementById('bricoConvDepartmentV56')||{}).value||read(DEPT_KEY));
  return {subject:subject,worker:worker,department:department,title:[subject,worker,department].filter(Boolean).join(' — ')};
}
function validateMetadata(){
  var m=metadata(), missing=[];
  if(!m.subject)missing.push('REGAŁ / OPIS');
  if(!m.worker)missing.push('IMIĘ I NAZWISKO');
  if(DEPARTMENTS.indexOf(m.department)<0)missing.push('DZIAŁ');
  if(!missing.length)return m;
  setStatus('Uzupełnij: '+missing.join(', ')+'.','error');
  var id=!m.subject?'bricoConvSubjectV56':!m.worker?'bricoConvWorkerV56':'bricoConvDepartmentV56';
  var el=document.getElementById(id);if(el){el.focus();el.scrollIntoView({behavior:'smooth',block:'center'})}
  return null;
}
function payload(m){
  return {
    type:'UNIT_CONVERTERS',version:2,shop:SHOP,device:'BricoScanner',created:new Date().toISOString(),
    subject:m.subject,worker:m.worker,department:m.department,title:m.title,
    items:items().map(function(x){return {ean:String(x.ean||''),name:displayedName(x.ean,x.name),unit:clean(x.unit||''),content:Number(x.content),changedAt:new Date(Number(x.lastAt)||Date.now()).toISOString()}})
  };
}
function resetNative(){
  if(timer){clearTimeout(timer);timer=0}
  window.onNativeUploadResult=restoreHandler;
  restoreHandler=null;
  busy=false;
}
function send(){
  if(busy)return;
  var list=items(),m=validateMetadata(),t=token(),btn=document.getElementById('bricoConverterSendV56');
  if(!m)return;
  if(!list.length){setStatus('Lista przeliczników jest pusta.','error');return}
  if(!t){setStatus('Brak sesji BricoLab / Accessis.','error');return}
  if(!window.BricoUpload||typeof window.BricoUpload.uploadJson!=='function'){setStatus('Brak natywnego modułu wysyłania.','error');return}
  busy=true;if(btn){btn.disabled=true;btn.textContent='WYSYŁAM…'};setStatus('Wysyłanie '+list.length+' pozycji…','');
  restoreHandler=typeof window.onNativeUploadResult==='function'?window.onNativeUploadResult:null;
  window.onNativeUploadResult=function(result){
    var server=result&&result.server?result.server:{};
    if(server&&(server.kind==='UNIT_CONVERTERS'||server.converterUpload===true)){
      var ok=!!(result&&result.ok&&server.ok);
      var err=(result&&result.error)||(server&&server.error)||(result&&result.body)||'Błąd wysyłania';
      resetNative();
      if(ok){
        setStatus('Wysłano: '+(server.title||m.title)+' ✓','ok');
        if(btn){btn.textContent='WYSŁANO ✓';setTimeout(function(){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'},1600)}
      }else{
        setStatus('BŁĄD: '+err,'error');
        if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}
      }
      return;
    }
    if(typeof restoreHandler==='function')restoreHandler(result);
  };
  try{
    window.BricoUpload.uploadJson(ENDPOINT,t,JSON.stringify(payload(m)));
    timer=setTimeout(function(){resetNative();setStatus('Brak odpowiedzi serwera przeliczników.','error');if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}},20000);
  }catch(e){resetNative();setStatus('BŁĄD: '+(e.message||e),'error');if(btn){btn.disabled=false;btn.textContent='WYŚLIJ PRZELICZNIKI'}}
}
function ensureStyle(){
  if(document.getElementById('bricoConverterMetaStyleV56'))return;
  var s=document.createElement('style');s.id='bricoConverterMetaStyleV56';
  s.textContent='\
    #bricoConverterMetaV56{display:none;margin:4px 0 8px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel2)}\
    #bricoConverterMetaV56.show{display:block}\
    #bricoConverterMetaV56 .metaGridV56{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.95fr);gap:4px;align-items:end}\
    #bricoConverterMetaV56 .metaFieldV56{min-width:0}\
    #bricoConverterMetaV56 .metaFieldV56 label{display:block;margin:0 0 3px;font-size:7px;font-weight:950;letter-spacing:.03em;color:var(--muted);white-space:nowrap}\
    #bricoConverterMetaV56 input,#bricoConverterMetaV56 select{width:100%;min-width:0;height:34px;border:1px solid var(--line);border-radius:8px;background:#0b0f13;color:var(--text);padding:4px 5px;font-size:9.5px;font-weight:800;outline:none}\
    #bricoConverterMetaV56 .wideV56{grid-column:auto}\
    #bricoConverterMetaV56 .reqV56{color:#ff6969}\
    #bricoConverterSendV56{width:100%;min-height:42px;font-size:11px;font-weight:950}\
    html[data-brico-theme="light"] #bricoConverterMetaV56 input,html[data-brico-theme="light"] #bricoConverterMetaV56 select{background:#fff!important;color:var(--text)!important}\
  ';
  document.head.appendChild(s);
}
function ensureMetaUi(){
  var list=document.getElementById('bricoConverterListV48');if(!list)return;
  var listPanel=list.closest('.panel'),head=listPanel&&listPanel.querySelector('.listHead');if(!head)return;
  var box=document.getElementById('bricoConverterMetaV56');
  if(!box){
    box=document.createElement('div');box.id='bricoConverterMetaV56';
    box.innerHTML='<div class="metaGridV56">'
      +'<div class="metaFieldV56 wideV56"><label>REGAŁ / OPIS <span class="reqV56">*</span></label><input id="bricoConvSubjectV56" type="text" maxlength="100" placeholder="np. Regał 14 / nowe ceny farb" autocomplete="off"></div>'
      +'<div class="metaFieldV56"><label>IMIĘ I NAZWISKO <span class="reqV56">*</span></label><input id="bricoConvWorkerV56" type="text" maxlength="100" placeholder="Imię i nazwisko" autocomplete="name"></div>'
      +'<div class="metaFieldV56"><label>DZIAŁ <span class="reqV56">*</span></label><select id="bricoConvDepartmentV56"><option value="">WYBIERZ DZIAŁ</option>'+DEPARTMENTS.map(function(x){return '<option value="'+x+'">'+x+'</option>'}).join('')+'</select></div>'
      +'</div>';
    head.insertAdjacentElement('afterend',box);
    var subject=document.getElementById('bricoConvSubjectV56'),worker=document.getElementById('bricoConvWorkerV56'),dept=document.getElementById('bricoConvDepartmentV56');
    subject.value=read(SUBJECT_KEY);worker.value=read(WORKER_KEY);dept.value=read(DEPT_KEY);
    subject.addEventListener('input',function(){write(SUBJECT_KEY,this.value)});
    worker.addEventListener('input',function(){write(WORKER_KEY,this.value)});
    dept.addEventListener('change',function(){write(DEPT_KEY,this.value)});
  }
}
function ensureSendButton(){
  var actions=document.getElementById('bricoConverterActionsV52');if(!actions)return;
  var old=document.getElementById('bricoConverterSendV52');
  if(old){old.id='bricoConverterSendLegacyV56';old.style.display='none'}
  if(!document.getElementById('bricoConverterSendV56')){
    var b=document.createElement('button');b.type='button';b.className='primary';b.id='bricoConverterSendV56';b.textContent='WYŚLIJ PRZELICZNIKI';b.addEventListener('click',send);
    actions.appendChild(b);
  }
}
function refresh(){
  ensureStyle();ensureMetaUi();ensureSendButton();
  var conv=isConverters();
  var generic=document.querySelector('.bricoListNameV38');if(generic)generic.style.display=conv?'none':'';
  var box=document.getElementById('bricoConverterMetaV56');if(box)box.classList.toggle('show',conv);
}
function boot(){
  refresh();
  document.addEventListener('click',function(){setTimeout(refresh,0)},true);
  setTimeout(refresh,200);setTimeout(refresh,700);setInterval(refresh,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
