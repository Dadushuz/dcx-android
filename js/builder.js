/* ===== Конструктор приказов и генерация штампа ===== */
function initBuilder(){
 ["b-from-st","b-to-st"].forEach(id=>{const s=$(id);s.innerHTML="";STN.forEach((st,i)=>s.add(new Option(st.full,i)))});
 ["hoz-dep-station","hoz-dest-station"].forEach(id=>{const s=$(id);s.innerHTML="";STN.forEach(st=>s.add(new Option(st.full,st.code)))});
 const p=$("hoz-dep-peregon");p.innerHTML="";PER.forEach((x,i)=>p.add(new Option(x.name,i)));
}
function openBuilder(c,edit){
 show("box-builder",true);
 const fl=floorTs(edit?edit.id:null);
 $("floor-hint").textContent=fl?`Не ранее утверждения предыдущего приказа (${hm(fl)})`:"Ограничений по времени нет";
 if(edit){
  $("edit-id").value=edit.id;
  $("builder-pill").textContent="Редактирование заготовки";
  FIELDS.forEach(id=>{if(edit.f[id]!==undefined)$(id).value=edit.f[id]});
  $("b-time").value=hm(edit.at);
  $("tech-section").dataset.manual=1;
  sel=[...edit.stations];
  cat=edit.cat;selectCat(cat,edit.f["b-subtemplate"],true);
 }else{
  $("edit-id").value="";
  $("builder-pill").textContent=`Приказ № ${S.meta.next}`;
  let t=nowHM();if(fl&&atNear(t)<fl)t=hm(fl);
  $("b-time").value=t;
  $("sh-accepted").value=dutyOf()||S.meta.activeDch;$("sh-handed").value=S.meta.activeDch;
  $("hoz-train").value="11236";$("hoz-oth-num").value="";$("tech-extra").value="";
  $("tech-section").dataset.manual="";
  $("b-from-st").value=0;$("b-to-st").value=3;
  onRange(true);
  selectCat(c||"HOZ_WRONG_DIR");
 }
 $("box-builder").scrollIntoView({behavior:"smooth",block:"start"});
}
function closeBuilder(){show("box-builder",false)}
function selectCat(c,presetSub,keep){
 cat=c;CATS.forEach(x=>$("cat-"+x).classList.toggle("active",x===c));
 const s=$("b-subtemplate"),prev=presetSub||s.value;s.innerHTML="";
 (S.subs[c]||[]).forEach(i=>s.add(new Option(i.title,i.id)));
 if(prev&&[...s.options].some(o=>o.value===prev))s.value=prev;
 $("tech-extra-lbl").textContent=c==="ENERGY_DCH"?"Фамилия энергодиспетчера (ЭЧЦ):":"Основание / причина / примечание:";
 $("tech-extra").placeholder=c==="ENERGY_DCH"?"Например: Смирнов":"Например: плановые работы / приказ ЭЧЦ №14";
 const dg=DANGER_CATS.includes(c);
 show("danger-warn",dg);if(dg)$("danger-text").textContent=DANGER_TEXT[c];
 renderChips();preview();
}
function vis(){
 show("fields-SH",cat==="SHIFT_HANDOVER");show("fields-HOZ",cat==="HOZ_WRONG_DIR");
 show("fields-TECH",!["SHIFT_HANDOVER","HOZ_WRONG_DIR"].includes(cat));
 show("b-stations-section",cat!=="ENERGY_DCH"&&cat!=="SHIFT_HANDOVER");
 const dt=$("hoz-dep-type").value;show("w-dep-st",dt==="station");show("w-dep-per",dt==="peregon");
 show("w-lim",$("hoz-lim-mode").value!=="none");show("w-oth",$("hoz-oth-mode").value!=="none");
}
function onRange(silent){
 const i1=+$("b-from-st").value||0,i2=+$("b-to-st").value||0,st=i1<=i2?1:-1;
 sel=[];for(let i=i1;i!==i2+st;i+=st)sel.push(STN[i].code);
 $("hoz-dep-station").value=STN[i1].code;$("hoz-dest-station").value=STN[i2].code;
 const ts=$("tech-section");if(!ts.dataset.manual)ts.value=`${STN[i1].full} — ${STN[i2].full}`;
 renderChips();if(!silent)preview();
}
function allStations(){sel=STN.map(s=>s.code);renderChips();preview()}
function renderChips(){
 const b=$("chips");b.innerHTML="";
 STN.forEach(s=>{
  const c=document.createElement("div");
  c.className="chip"+(sel.includes(s.code)?" active":"");
  c.textContent=s.full;c.tabIndex=0;
  const tg=()=>{if(sel.includes(s.code)){if(sel.length>1)sel=sel.filter(x=>x!==s.code)}else sel.push(s.code);renderChips();preview()};
  c.onclick=tg;c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tg()}};
  b.appendChild(c);
 });
}
function onPeregon(){
 const p=PER[+$("hoz-dep-peregon").value||0];
 if(p){[p.a,p.b].forEach(c=>{if(!sel.includes(c))sel.push(c)});renderChips()}
 preview();
}
function collect(asDraft){
 const f={};FIELDS.forEach(id=>f[id]=$(id).value.trim());
 const list=S.subs[cat]||[];const sub=list.find(x=>x.id===f["b-subtemplate"])||list[0]||{};
 const en=cat==="ENERGY_DCH",sh=cat==="SHIFT_HANDOVER";
 const ord=STN.map(s=>s.code).filter(c=>sel.includes(c));
 return{
  id:Date.now(),cat,draft:asDraft,noSt:en,noObr:sh||en,num:asDraft?null:S.meta.next,at:atNear(f["b-time"]||nowHM()),
  subTitle:sub.title||"",subText:sub.text||"",stations:en?[]:sh?STN.map(s=>s.code):ord,acks:{},
  dch:dutyOf(),by:me.uid,paper:false,created:Date.now(),f
 };
}
function preview(){vis();$("builder-preview").innerHTML=stamp(collect(false))}

/* ===== Штамп (весь динамический текст экранируется) ===== */
function fill(tpl,f){
 const v=x=>`<span class="v">${esc(x)}</span>`;
 return esc(tpl).replace(/\{путь\}/g,()=>v(f["tech-track"])).replace(/\{участок\}/g,()=>v(f["tech-section"]||"Чиланзарская линия")).replace(/\{доп\}/g,()=>v(f["tech-extra"]||"—"));
}
function stamp(o){
 const f=o.f||{},v=x=>`<span class="v">${esc(x)}</span>`,dch=`<div style="text-align:center;margin-top:10px" class="big">Диспетчер ${v(o.dch)}</div>`;
 const stl=o.stations.map(c=>SN[c]||c).join(", ");
 const num=o.draft?"ЧЕРНОВИК":`№ ${esc(o.num)}`;
 const obr=o.noObr?"":(o.obr?`<div class="trow">ОБР: ${hm(o.obr)}<small>${esc(SN[o.obrSt]||"")}</small></div>`:`<div class="trow" style="color:#d97706">ОБР: ожид.</div>`);
 const utv=o.utvAt?`<div class="trow" style="color:#16a34a">УТВ: ${hm(o.utvAt)}</div>`:`<div class="trow" style="color:#dc2626">УТВ: ожид.</div>`;
 let body="";
 if(o.cat==="SHIFT_HANDOVER"){
  body=`<div class="stop"><div class="big">Всем ДС!</div></div><div style="margin:6px 0">Дежурство принял(а)<br>ДЦХ ${v(f["sh-accepted"]||o.dch)}</div><div style="margin:6px 0">Дежурство сдал(а)<br>ДЦХ ${v(f["sh-handed"]||"___")}</div>`;
 }else if(o.cat==="HOZ_WRONG_DIR"){
  const st=f["hoz-dep-type"]==="station";
  const dep=st?SN[f["hoz-dep-station"]]:(PER[f["hoz-dep-peregon"]]||{}).name;
  const dw=st?`со станции <span class="strike">(с перегона)</span>`:`<span class="strike">со станции</span> (с перегона)`;
  const lt=v(f["hoz-lim-txt"]||"___"),lm=f["hoz-lim-mode"];
  const lw=lm==="do"?`до <span class="strike">/ за</span> ${lt}`:lm==="za"?`<span class="strike">до /</span> за ${lt}`:`<span class="strike">до / за</span>`;
  const om=f["hoz-oth-mode"],on=v(f["hoz-oth-num"]||"___");
  const ow=om==="ahead"?`<div>Впереди Вас <span class="strike">(за Вами)</span> следует хозяйственный поезд № ${on}</div>`:om==="behind"?`<div><span class="strike">Впереди Вас</span> (за Вами) следует хозяйственный поезд № ${on}</div>`:`<div class="strike">Впереди Вас (за Вами) следует хозяйственный поезд № ______</div>`;
  const tr=v(f["hoz-train"]||"___");
  body=`<div class="stop"><div>Станции ${v(stl)}</div><div class="big" style="flex-shrink:0">ДС!</div></div>
   <div>Копия машинисту хозяйственного поезда № ${tr}</div><div>Разрешается хозяйственному поезду № ${tr}</div>
   <div>следовать в неправильном направлении по ${v(f["hoz-tr1"])} главному</div><div>пути ${dw} ${v(dep||"")}</div>
   <div>на ${v(f["hoz-tr2"])} главный путь ${lw}</div><div style="text-align:right;padding-right:10px">станции: ${v(SN[f["hoz-dest-station"]]||"")}</div>
   <div style="margin-top:4px">${ow}</div>${dch}`;
 }else if(o.cat==="ENERGY_DCH"){
  body=`<div class="stop"><div style="font-weight:900">Энергодиспетчеру (ЭЧЦ) ${v(f["tech-extra"]||"—")}</div><div style="font-size:12px;font-weight:800;color:#b45309">Только в журнале ДЦХ</div></div><div style="margin:8px 0">${fill(o.subText||"Энергодиспетчеру (ЭЧЦ) {доп}. На участке {участок} по {путь}.",f)}</div>${dch}`;
 }else{
  body=`<div class="stop"><div>Станции ${v(stl)}</div><div class="big" style="flex-shrink:0">ДС!</div></div><div style="margin:8px 0">${fill(o.subText||"По {путь} на участке {участок}. Основание: {доп}.",f)}</div>${dch}`;
 }
 const st=statusOf(o);
 const html=`<div class="stamp"><div class="sl"><div class="slt"><div class="cdate">${dmy(o.at)}<small style="display:block;font-size:11px">${new Date(o.at).getFullYear()}</small></div><div class="cnum">${num}</div></div>
  <div class="times"><div class="trow">ВЫД: ${hm(o.at)}</div>${obr}${utv}</div></div><div class="sr">${body}</div></div>`;
 const badge=`<div style="margin-bottom:8px"><span class="st ${st.c}">${st.t}</span></div>`;
 const full=badge+html;
 return o.canceled?`<div class="cx">${full}</div>`:full;
}

/* ===== Сохранение черновика и выдача приказа ===== */
function saveDraft(){
 const id=$("edit-id").value,o=collect(true);
 if(id){const old=S.orders[id];if(old){o.id=old.id;o.created=old.created}}
 W("orders/"+o.id,o);log(`Сохранена заготовка (${o.subTitle||CAT_RU[o.cat]||o.cat})`);
 closeBuilder();openTab("drafts");toast("📁 Заготовка сохранена");
}
async function publish(){
 if(PB){toast("⏳ Уже идёт выдача, подождите…");return}
 const id=$("edit-id").value;
 if(!$("b-time").value){toast("⚠️ Укажите время выдачи");markErr(["b-time"]);return}
 const o=collect(false),fl=floorTs(id?+id:null);
 const er=validate(o);if(er){toast("⚠️ "+er);beep(300,.3);return}
 if(fl&&o.at<fl){toast(`⚠️ Ошибка хронологии: время (${hm(o.at)}) раньше утверждения предыдущего приказа (${hm(fl)})`);beep(300,.4);return}
 if(id&&S.orders[id]){o.id=S.orders[id].id;o.created=S.orders[id].created}
 const doPublish=async()=>{
  PB=true;
  toast("⏳ Регистрация приказа…");
  try{
   o.num=await claimNum();
   o.by=me.uid;
   const meta={};
   if(o.cat==="SHIFT_HANDOVER"){meta.activeDch=o.f["sh-accepted"]||S.meta.activeDch;meta.prevDch=o.f["sh-handed"]||S.meta.prevDch;}
   W("orders/"+o.id,o);if(Object.keys(meta).length)W("meta",meta,true);
   log(`Выдан приказ № ${o.num} в ${hm(o.at)} (${o.subTitle||CAT_RU[o.cat]||o.cat})`);
   closeBuilder();beep(880,.35);openTab("journal");
   toast(`🚀 Приказ № ${o.num} зарегистрирован`);
  }catch(e){
   console.error("publish",e);
   toast("⚠️ Ошибка выдачи: "+(e.message==="нет авторизации"?"сессия истекла, войдите снова":e.name==="AbortError"?"таймаут сети, данные сохранены локально":e.message||"сеть"));
   beep(300,.3);
  }finally{PB=false}
 };
 if(DANGER_CATS.includes(o.cat)){
  confirmDanger("Подтверждение опасной операции",DANGER_TEXT[o.cat]+" Нажмите «Подтвердить», чтобы выдать приказ.",doPublish);
 }else doPublish();
}
