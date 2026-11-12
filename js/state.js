/* ===== Состояние, время, валидация и UI-утилиты ===== */
const clone=x=>JSON.parse(JSON.stringify(x));
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const show=(id,on)=>$(id).classList.toggle("hidden",!on);

function defaults(){
 return{users:{},subs:clone(DEF_SUBS),meta:{next:201,activeDch:"Икрамов Д.",prevDch:"Исмоилов А."},duties:{},orders:{},logs:{}};
}
function norm(r){
 const d=defaults();
 const s={users:r.users||d.users,subs:r.subs||d.subs,meta:Object.assign(d.meta,r.meta||{}),duties:r.duties||{},orders:r.orders||{},logs:r.logs||{}};
 Object.values(s.orders).forEach(o=>{o.stations=o.stations||[];o.acks=o.acks||{};o.f=o.f||{};o.canceled=!!o.cancel});
 CATS.forEach(c=>{if(!s.subs[c])s.subs[c]=clone(DEF_SUBS[c])});
 return s;
}

let S,OUT=[],me=null,cat="HOZ_WRONG_DIR",sel=[],lastRaw="",loginGrp="disp";
let R=null,es=null,ready=false,PB=false,jLimit=30,tab="journal",pend=false;
try{
 S=norm(JSON.parse(localStorage.getItem(LS)||"null")||defaults());
 OUT=JSON.parse(localStorage.getItem(LSO)||"[]");
}catch(e){
 S=defaults();OUT=[];
}

/* ===== Время (полные метки; переход через полночь) ===== */
const _dn=Date.now.bind(Date);
let OFF=0;
Date.now=()=>Math.round(_dn()+OFF);

const p2=n=>String(n).padStart(2,"0");
const hm=t=>{const d=new Date(t);return p2(d.getHours())+":"+p2(d.getMinutes())};
const dmy=t=>{const d=new Date(t);return p2(d.getDate())+"/"+p2(d.getMonth()+1)};
const nowHM=()=>hm(Date.now());

function atNear(s,ref=Date.now()){
 const[h,m]=s.split(":").map(Number);
 const d=new Date(ref);d.setHours(h,m,0,0);
 let t=d.getTime();
 if(t>ref+432e5)t-=864e5;else if(t<ref-432e5)t+=864e5;
 return t;
}
function atAfter(s,base){
 const[h,m]=s.split(":").map(Number);
 const d=new Date(base);d.setHours(h,m,0,0);
 let t=d.getTime();
 if(t<base)t+=864e5;
 return t;
}
const pubs=()=>Object.values(S.orders).filter(o=>!o.draft).sort((a,b)=>a.at-b.at||(a.num||0)-(b.num||0));
function floorTs(ex){
 let f=0;
 pubs().forEach(o=>{if(o.id!==ex&&!o.canceled)f=Math.max(f,o.utvAt||o.obr||o.at)});
 return f||null;
}
const lastPubId=()=>{const p=pubs();return p.length?p[p.length-1].id:null};
function shiftText(){
 const h=new Date(Date.now()).getHours();
 return h>=8&&h<20?"☀️ Дневная смена (08:00 — 20:00)":"🌙 Ночная смена (20:00 — 08:00)";
}
function shiftWindow(){
 const d=new Date(Date.now()),m=d.getHours()*60+d.getMinutes();
 return((m>=465&&m<=510)||(m>=1185&&m<=1230))&&!Object.values(S.orders).some(o=>!o.draft&&!o.canceled&&o.cat==="SHIFT_HANDOVER"&&Date.now()-o.at<36e5);
}
function statusOf(o){
 if(o.canceled)return{k:"canceled",t:"ОТМЕНЁН",c:"st-canceled"};
 if(o.draft)return{k:"draft",t:"ЧЕРНОВИК",c:"st-draft"};
 if(!o.utvAt)return{k:"pending",t:"НА УТВЕРЖДЕНИИ",c:"st-pending"};
 if(!o.paper)return{k:"issued",t:"ВЫДАН",c:"st-issued"};
 return{k:"journal",t:"ВНЕСЁН В ЖУРНАЛ",c:"st-journal"};
}
function dutyOf(){return me?me.name:""}

/* ===== Валидация ===== */
function validate(o){
 const f=o.f;
 if(!dutyOf())return"Укажите фамилию дежурного (при входе или кнопкой смены)";
 if(!f["b-time"])return"Укажите время выдачи приказа";
 if(!/^\d{1,2}:\d{2}$/.test(f["b-time"]))return"Некорректный формат времени выдачи";
 if(o.cat==="HOZ_WRONG_DIR"){
  if(!f["hoz-train"])return"Укажите номер хозяйственного поезда";
  if(!/^\d{3,6}$/.test(f["hoz-train"]))return"Номер хоз. поезда должен содержать 3–6 цифр";
  if(f["hoz-dep-type"]==="station"&&f["hoz-dep-station"]===f["hoz-dest-station"])return"Станции отправления и назначения совпадают";
  if(f["hoz-oth-mode"]!=="none"&&!f["hoz-oth-num"])return"Укажите номер другого поезда";
  if(f["hoz-oth-mode"]!=="none"&&!/^\d{3,6}$/.test(f["hoz-oth-num"]))return"Номер другого поезда должен содержать 3–6 цифр";
 }
 if(o.cat==="SHIFT_HANDOVER"&&(!f["sh-accepted"]||!f["sh-handed"]))return"Укажите, кто принял и кто сдал дежурство";
 if(!["SHIFT_HANDOVER","HOZ_WRONG_DIR"].includes(o.cat)&&!f["tech-section"])return"Укажите участок";
 if(!o.noSt&&!o.stations.length)return"Выберите хотя бы одну станцию";
 return"";
}
function markErr(ids){
 ids.forEach(id=>{const e=$(id);if(e)e.classList.add("err")});
 setTimeout(()=>ids.forEach(id=>{const e=$(id);if(e)e.classList.remove("err")}),2500);
}

/* ===== Модальные окна, звук, экран, уведомления ===== */
function confirmDanger(title,text,onOk){
 $("c-title").textContent=title;
 $("c-body").innerHTML=`<div class="danger-box"><p>${esc(text)}</p></div>
  <label class="chk"><input type="checkbox" id="c-chk"><span>Я осознаю последствия и подтверждаю выполнение операции</span></label>`;
 show("confirm",true);
 const ok=$("c-ok"),chk=$("c-chk");
 ok.disabled=true;
 chk.onchange=()=>{ok.disabled=!chk.checked};
 ok.onclick=()=>{if(!chk.checked)return;show("confirm",false);onOk()};
 $("c-no").onclick=()=>show("confirm",false);
}

let AC;
function beep(f=860,d=.25){
 try{
  AC=AC||new(window.AudioContext||window.webkitAudioContext)();
  if(AC.state==="suspended")AC.resume();
  const o=AC.createOscillator(),g=AC.createGain();
  o.frequency.value=f;g.gain.value=.2;
  o.connect(g);g.connect(AC.destination);
  o.start();o.stop(AC.currentTime+d);
 }catch(e){}
}
async function wake(){
 try{if("wakeLock"in navigator&&document.visibilityState==="visible")await navigator.wakeLock.request("screen")}catch(e){}
}
document.addEventListener("click",()=>{
 try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();AC.resume()}catch(e){}
 wake();
},{once:true});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")wake()});

let tt;
function toast(t){
 const e=$("toast");e.textContent=t;show("toast",true);
 clearTimeout(tt);tt=setTimeout(()=>show("toast",false),3800);
}
function ask(title,def,cb){
 $("m-title").textContent=title;$("m-inp").value=def||"";show("modal",true);$("m-inp").focus();
 const done=v=>{show("modal",false);if(v)cb(v)};
 $("m-ok").onclick=()=>done($("m-inp").value.trim());
 $("m-no").onclick=()=>done(null);
 $("m-inp").onkeydown=e=>{if(e.key==="Enter")done($("m-inp").value.trim())};
}
function askConfirm(title,text,okText){
 return new Promise(res=>{
  $("c-title").textContent=title||"Подтверждение";
  $("c-body").innerHTML=`<div class="danger-box" style="border-color:#f59e0b;background:#fffbeb"><p>${esc(text||"")}</p></div>`;
  const ok=$("c-ok"),no=$("c-no");
  ok.textContent=okText||"Подтвердить";ok.disabled=false;
  show("confirm",true);
  const done=v=>{show("confirm",false);ok.onclick=null;no.onclick=null;ok.textContent="Подтвердить";ok.disabled=true;res(v)};
  ok.onclick=()=>done(true);
  no.onclick=()=>done(false);
 });
}
function askNotif(){
 try{if("Notification"in window&&Notification.permission==="default")Notification.requestPermission()}catch(e){}
}
let tb=null;
const baseTitle=document.title;
function alertNew(list){
 beep(880,.35);
 try{navigator.vibrate&&navigator.vibrate([300,150,300,150,300])}catch(e){}
 const txt="Новый приказ № "+list.map(o=>o.num).join(", ");
 try{if(document.hidden&&"Notification"in window&&Notification.permission==="granted")new Notification("АРМ ДЦХ",{body:txt,requireInteraction:true})}catch(e){}
 if(document.hidden&&!tb){
  let on=false;
  tb=setInterval(()=>{document.title=(on=!on)?"🔔 "+txt:baseTitle},900);
  const stop=()=>{if(!document.hidden){clearInterval(tb);tb=null;document.title=baseTitle;document.removeEventListener("visibilitychange",stop)}};
  document.addEventListener("visibilitychange",stop);
 }
}
setInterval(()=>{
 if(!me||me.role!=="station")return;
 if(Object.values(S.orders).some(o=>!o.draft&&!o.canceled&&!o.noSt&&o.stations.includes(me.code)&&!o.acks[me.code])){
  beep(940,.4);setTimeout(()=>beep(680,.4),300);
 }
},60000);
