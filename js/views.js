/* ===== Вкладки, Журнал, Заготовки, Отчёты, Логи, Админ-панель и Старт ===== */
function openTab(t){
 tab=t;
 ["journal","drafts","reports","logs","admin"].forEach(x=>{
  $("nav-"+x).classList.toggle("active",x===t);
  show("tab-"+x,x===t);
 });
 render();
}

function render(){
 if(!me)return;
 const a=document.activeElement;
 if(a&&a.closest&&a.closest("#journal-box")&&/INPUT|SELECT/.test(a.tagName)){pend=true;return}
 const r=me.role,duty=dutyOf(),m=S.meta;
 $("user-name").textContent=me.role==="station"?`${me.name} • ${SN[me.code]}`:me.name;
 const pl=$("role-pill");
 pl.textContent={founder:"ОСНОВАТЕЛЬ",chief:"СТАРШИЙ ДЦХ",dch:"ДЦХ"}[r]||me.stationFull||SN[me.code];
 pl.className="pill "+({founder:"p-founder",chief:"p-chief",station:"p-station"}[r]||"");
 show("shift-banner",shiftWindow()&&(r==="dch"||r==="chief"||r==="founder"));
 $("shift-window").textContent=r==="station"?"":shiftText();
 $("active-dch").textContent=r==="station"?`📍 ${SN[me.code]||""}`:`На дежурстве ДЦХ: ${m.activeDch} (сдал: ДЦХ ${m.prevDch})`;
 $("my-duty").textContent=r==="station"?`👤 ${me.name}`:(duty?`👤 Дежурный текущей смены: ${duty}`:"⚠️ Укажите фамилию дежурного");
 $("next-num").textContent=r==="station"?"":`Следующий номер приказа: № ${m.next}`;
 const canIssue=r==="dch"||r==="chief"||r==="founder";
 show("btn-shift",canIssue);show("btn-new",canIssue);
 show("nav-drafts",canIssue);show("nav-reports",canIssue);show("nav-logs",r==="chief"||r==="founder");show("nav-admin",r==="founder");
 $("drafts-cnt").textContent=Object.values(S.orders).filter(o=>o.draft&&(r==="founder"||r==="chief"||o.by===me.login||o.by===me.uid)).length;
 if(tab==="journal")renderJournal();
 else if(tab==="drafts")renderDrafts();
 else if(tab==="reports")renderReports();
 else if(tab==="logs")renderLogs();
 else if(tab==="admin")renderAdmin();
}
document.addEventListener("focusout",()=>{if(pend)setTimeout(()=>{pend=false;render()},250)});

/* ===== Журнал приказов ===== */
const openDet=new Set();
function renderJournal(){
 const box=$("journal-box"),flt=$("feed-filter").value;
 let list=pubs().reverse();
 const isSt=me.role==="station";
 if(isSt){
  list=list.filter(o=>!o.noSt&&o.stations.includes(me.code));
  $("feed-title").textContent=`📥 Приказы для станции «${SN[me.code]}»`;
  $("feed-filter").style.display="none";
 }else{
  $("feed-title").textContent="📖 Единый журнал диспетчерских приказов";
  $("feed-filter").style.display="";
 }
 const q=($("feed-q").value||"").trim().toLowerCase();
 list=list.filter(o=>(isSt||((flt!=="unapproved"||!o.utvAt)&&(flt!=="uncopied"||!o.paper)))&&(!q||`${o.num} ${dmy(o.at)} ${o.subTitle} ${o.dch} ${o.f["hoz-train"]||""}`.toLowerCase().includes(q)));
 if(isSt)list.sort((a,b)=>{const ac=!a.canceled&&!a.acks[me.code]?0:1,bc=!b.canceled&&!b.acks[me.code]?0:1;return ac-bc||b.at-a.at});
 const total=list.length;list=list.slice(0,jLimit);
 const last=lastPubId();let h="";
 list.forEach(o=>{
  if(flt==="unapproved"&&o.utvAt)return;if(flt==="uncopied"&&o.paper)return;
  h+=`<div class="glass" id="card-${o.id}" style="border-left:6px solid ${o.utvAt?"var(--success)":"var(--warning)"}">${stamp(o)}${o.canceled?`<div style="margin-top:8px;font-weight:800;color:#991b1b">⛔ Отменён: ${esc(o.cancel.reason)} (${esc(o.cancel.by)}, ${hm(o.cancel.at)})</div>`:""}${o.hist?`<div class="muted" style="margin-top:6px">✏️ Правки времени: ${Object.values(o.hist).map(x=>`${esc(x.from)}→${esc(x.to)} (${esc(x.who)})`).join("; ")}</div>`:""}`;
  if(me.role==="station"&&!o.canceled&&!o.noSt&&!o.acks[me.code])
   h+=`<div class="alert"><b style="color:#991b1b">🔔 НОВЫЙ ПРИКАЗ № ${esc(o.num)}! Подтвердите получение:</b><span style="font-weight:800">${esc(me.name)}</span><button type="button" class="btn btn-success" onclick="stConfirm(${o.id})">✅ Принял / Ознакомился</button></div>`;
  else if(me.role==="station"&&o.acks[me.code])
   h+=`<div style="margin-top:8px;padding:8px 12px;background:rgba(220,252,231,.9);border-radius:var(--rm);font-weight:800;color:#166534;font-size:13px">✅ Вы подтвердили: ${esc(o.acks[me.code].by)} (${hm(o.acks[me.code].t)})</div>`;
  const canCtrl=!o.canceled&&(me.role==="founder"||me.role==="chief"||(me.role==="dch"&&!o.utvAt&&(!o.by||o.by===me.login||o.by===me.uid)));
  if(canCtrl)h+=ctrl(o,last);
  let stBtn="",stList="";
  if(me.role!=="station"&&!o.noSt){
   const ok=o.stations.filter(c=>o.acks[c]).length;
   stBtn=`<button type="button" class="btn btn-soft btn-sm" onclick="toggleDet(${o.id})">👁 Статус станций (${ok}/${o.stations.length})</button>`;
   stList=`<div id="det-${o.id}" class="${openDet.has(o.id)?"":"hidden"}" style="margin-top:10px;background:rgba(255,255,255,.9);border-radius:var(--rm);padding:8px 12px">`+o.stations.map(c=>{const a=o.acks[c];return`<div class="row" style="padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.25);font-size:13px"><div><b>${esc(SN[c])}</b> ${o.obrSt===c?'<span class="pill p-station" style="padding:2px 8px;font-size:11px">🗣 Обратно</span>':""}</div><div>${a?`<span style="color:#166534;font-weight:800">🟢 Принял: ${esc(a.by)} (${hm(a.t)})</span>`:'<span style="color:#dc2626;font-weight:800">🔴 Ожидание...</span>'}</div></div>`}).join("")+`</div>`;
  }else if(me.role!=="station"&&o.noSt) stBtn=`<span style="font-size:12px;font-weight:800;color:#b45309">⚡ Приказ энергодиспетчеру (без отправки на станции)</span>`;
  const paper=me.role!=="station"?`<button type="button" class="btn ${o.paper?"btn-success":"btn-soft"} btn-sm" onclick="togglePaper(${o.id})">${o.paper?"✅ Внесено в книгу":"✍️ Отметить перенос в книгу"}</button>`:"";
  const canCancel=!o.canceled&&(me.role==="founder"||me.role==="chief"||(me.role==="dch"&&!o.utvAt&&(!o.by||o.by===me.login||o.by===me.uid)));
  const del=(me.role!=="station"?`<button type="button" class="btn btn-soft btn-sm" onclick="printOrder(${o.id})">🖨 Печать</button>`:"")+
   (canCancel?`<button type="button" class="btn btn-danger btn-sm" onclick="cancelOrder(${o.id})">⛔ Отменить</button>`:"");
  if(me.role==="station")
   h+=`<div class="row foot" style="justify-content:flex-end"><button type="button" class="btn btn-soft btn-sm" onclick="printOrder(${o.id})">🖨 Печать</button></div>`;
  else
   h+=`<div class="row foot">${stBtn}<div style="display:flex;gap:8px;flex-wrap:wrap">${paper}${del}</div></div>${stList}`;
  h+=`</div>`;
 });
 box.innerHTML=(h||`<div class="glass muted" style="text-align:center;font-weight:700">Приказов не найдено.</div>`)+(total>jLimit?`<button type="button" class="btn btn-soft btn-block" onclick="jLimit+=30;renderJournal()">Показать ещё (${total-jLimit})</button>`:"");
}
function ctrl(o,last){
 const isBoss=me.role==="founder"||me.role==="chief",canT=(!o.utvAt&&o.id===last)||isBoss;
 const te=canT?`<div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.85);padding:5px 10px;border-radius:var(--rp)"><span style="font-size:12px;font-weight:800">Время выдачи:</span><input type="time" id="ed-${o.id}" value="${hm(o.at)}" style="width:112px;padding:4px 8px;font-size:14px"><button type="button" class="btn btn-primary" style="padding:5px 12px;font-size:12px" onclick="updIssue(${o.id})" aria-label="Сохранить время">💾</button></div>`:"";
 if(o.noObr){
  const u=hm(o.utvAt||o.at+6e4);
  return`<div class="ctrl row">${te}<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:13px;font-weight:800;color:#1e3a8a">«Утверждено» (+1 мин):</span><input type="time" id="uo-${o.id}" value="${u}" style="width:120px;padding:6px 10px"><button type="button" class="btn btn-success" onclick="apprNo(${o.id})">✅ Утвердить № ${esc(o.num)}</button></div></div>`;
 }
 const opts=o.stations.map(c=>`<option value="${esc(c)}" ${o.obrSt===c?"selected":""}>${esc(SN[c])}</option>`).join("");
 const ob=hm(o.obr||o.at+6e4),ut=hm(o.utvAt||(o.obr||o.at+6e4)+6e4);
 return`<div class="ctrl"><div class="row" style="margin-bottom:8px"><span style="font-size:13px;font-weight:800;color:#1e3a8a">⏱ «Обратно» и «Утверждено»:</span>${te}</div>
  <div class="g4" style="align-items:end"><div><label class="lbl" for="os-${o.id}">Станция («Обратно»):</label><select id="os-${o.id}" style="padding:7px;font-size:13px">${opts}</select></div>
  <div><label class="lbl" for="ot-${o.id}">Время «Обратно»:</label><input type="time" id="ot-${o.id}" value="${ob}" style="padding:7px;font-size:14px" oninput="obrInput(${o.id})"></div>
  <div><label class="lbl" for="ut-${o.id}">«Утверждено» (+1 мин):</label><input type="time" id="ut-${o.id}" value="${ut}" style="padding:7px;font-size:14px"></div>
  <div><button type="button" class="btn btn-success" style="width:100%;padding:9px" onclick="apprObr(${o.id})">✅ Утвердить</button></div></div></div>`;
}
function toggleDet(id){openDet.has(id)?openDet.delete(id):openDet.add(id);$("det-"+id).classList.toggle("hidden",!openDet.has(id))}
function obrInput(id){const v=$("ot-"+id).value;if(v){const o=S.orders[id];$("ut-"+id).value=hm(atAfter(v,o.at)+6e4)}}
function updIssue(id){
 const o=S.orders[id];if(!o)return;
 if(o.utvAt&&me.role!=="founder"&&me.role!=="chief"){toast("⚠️ Приказ утверждён — изменение заблокировано");return}
 const v=$("ed-"+id).value;if(!v)return;
 const t=atNear(v,o.at),fl=floorTs(id);
 if(fl&&t<fl){toast(`⚠️ Время (${hm(t)}) раньше утверждения предыдущего приказа (${hm(fl)})`);beep(300,.4);return}
 const old=hm(o.at);W("orders/"+id,{at:t},true);W(`orders/${id}/hist/${Date.now()}`,{who:dutyOf(),from:old,to:hm(t)});
 log(`Изменено время выдачи приказа № ${o.num}: ${old} ➔ ${hm(t)}`);toast(`✅ Время выдачи изменено на ${hm(t)}`);
}
function apprNo(id){
 const o=S.orders[id];if(!o||(o.utvAt&&me.role!=="founder"&&me.role!=="chief"))return;
 const v=$("uo-"+id).value;if(!v){toast("⚠️ Укажите время");return}
 const t=atAfter(v,o.at);if(t-o.at>432e5){toast("⚠️ Время утверждения слишком далеко от выдачи");return}
 W("orders/"+id,{utvAt:t},true);log(`Приказ № ${o.num} утверждён в ${hm(t)}`);beep(1000,.25);toast(`✅ Приказ № ${o.num} утверждён и заблокирован`);
}
function apprObr(id){
 const o=S.orders[id];if(!o||(o.utvAt&&me.role!=="founder"&&me.role!=="chief"))return;
 const st=$("os-"+id).value,a=$("ot-"+id).value,b=$("ut-"+id).value;
 if(!a||!b){toast("⚠️ Укажите время «Обратно» и «Утверждено»");return}
 const ta=atAfter(a,o.at);if(ta-o.at>432e5){toast("⚠️ Время «Обратно» слишком далеко от выдачи");return}
 const tb=atAfter(b,ta);if(tb-ta>432e5){toast("⚠️ Время «Утверждено» слишком далеко от «Обратно»");return}
 W("orders/"+id,{obrSt:st,obr:ta,utvAt:tb},true);
 log(`Приказ № ${o.num}: «Обратно» ст. ${SN[st]} (${hm(ta)}), утверждён в ${hm(tb)}`);beep(1000,.25);toast(`✅ Приказ № ${o.num} утверждён (${hm(tb)})`);
}
function stConfirm(id){
 const fam=me.name;
 const o=S.orders[id];if(!o)return;
 W(`orders/${id}/acks/${me.code}`,{by:fam,uid:me.uid,t:Date.now()});
 log(`Станция «${SN[me.code]}» (${fam}) подтвердила приказ № ${o.num}`);beep(1000,.2);toast(`✅ Приказ № ${o.num} подтверждён`);
}
function togglePaper(id){const o=S.orders[id];if(o)W(`orders/${id}/paper`,!o.paper)}
function cancelOrder(id){
 const o=S.orders[id];if(!o||o.canceled)return;
 if(o.utvAt&&me.role!=="founder"&&me.role!=="chief"){toast("⚠️ Утверждённый приказ может отменить только старший ДЦХ или основатель");return}
 ask(`Причина отмены приказа № ${o.num}:`,"",r=>{
  if(!r||r.length<3){toast("⚠️ Укажите причину отмены (минимум 3 символа)");return}
  W(`orders/${id}/cancel`,{reason:r,by:dutyOf()||me.name,at:Date.now()});
  W(`orders/${id}/canceled`,true,true);
  if(o.cat==="SHIFT_HANDOVER")toast(`⛔ Приказ № ${o.num} отменён. Фамилия дежурного в meta не изменена — оформите новый приём смены при необходимости.`);
  else toast(`⛔ Приказ № ${o.num} отменён`);
  log(`Отменён приказ № ${o.num}: ${r}`);
 });
}
function printOrder(id){const c=$("card-"+id);if(!c)return;c.classList.add("pt");window.print();setTimeout(()=>c.classList.remove("pt"),800)}
async function delOrder(id){
 const o=S.orders[id];if(!o)return;
 const go=await askConfirm(o.draft?"Удаление заготовки":(`Удаление приказа № ${o.num}`+(o.utvAt?" (УТВЕРЖДЁН)":"")),o.draft?"Заготовка будет удалена безвозвратно.":"Приказ будет удалён безвозвратно. Отменить это действие нельзя.",o.draft?"Удалить":"Удалить приказ");
 if(!go)return;
 W("orders/"+id,null);log(`Удалена запись: ${o.draft?"заготовка":"приказ № "+o.num} (${o.subTitle||CAT_RU[o.cat]||o.cat})`);toast("🗑 Запись удалена");
}

/* ===== Заготовки ===== */
function renderDrafts(){
 const b=$("drafts-box");
 const ds=Object.values(S.orders).filter(o=>o.draft&&(me.role==="founder"||me.role==="chief"||o.by===me.login||o.by===me.uid)).sort((a,b)=>b.created-a.created);
 b.innerHTML=ds.length?ds.map(d=>`<div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid rgba(148,163,184,.35)">${stamp(d)}
  <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn btn-danger" onclick="delOrder(${d.id})">🗑 Удалить</button><button type="button" class="btn btn-soft" onclick="editDraft(${d.id})">✏️ Изменить</button><button type="button" class="btn btn-success" onclick="publishDraft(${d.id})">🚀 Выдать как № ${S.meta.next}</button></div></div>`).join(""):`<div class="muted" style="padding:16px;text-align:center;font-weight:700">Нет сохранённых заготовок.</div>`;
}
function editDraft(id){const o=S.orders[id];if(o)openBuilder(o.cat,o)}
async function publishDraft(id){
 const o=S.orders[id];if(!o||PB){if(PB)toast("⏳ Уже идёт выдача…");return}
 const er=validate(o);if(er){toast("⚠️ "+er);return}
 const doPub=async()=>{
  PB=true;toast("⏳ Регистрация приказа…");
  try{
   const n=await claimNum();
   const fl=floorTs(id);let t=Math.floor(Date.now()/6e4)*6e4;if(fl&&t<fl)t=fl;
   const f=Object.assign({},o.f,{"b-time":hm(t)});
   const meta={};
   if(o.cat==="SHIFT_HANDOVER"){meta.activeDch=f["sh-accepted"]||S.meta.activeDch;meta.prevDch=f["sh-handed"]||S.meta.prevDch}
   W("orders/"+id,{draft:false,num:n,at:t,f,dch:dutyOf(),by:me.uid,created:Date.now()},true);if(Object.keys(meta).length)W("meta",meta,true);
   log(`Выдана заготовка как приказ № ${n} в ${hm(t)}`);beep(880,.35);openTab("journal");toast(`🚀 Приказ № ${n} выдан`);
  }catch(e){console.error(e);toast("⚠️ Ошибка выдачи: "+(e.message||"сеть"));beep(300,.3)}
  finally{PB=false}
 };
 if(DANGER_CATS.includes(o.cat))confirmDanger("Подтверждение опасной операции",DANGER_TEXT[o.cat]+" Нажмите «Подтвердить», чтобы выдать приказ.",doPub);
 else doPub();
}

/* ===== Логи и Панель основателя ===== */
function renderLogs(){
 const q=($("logs-q").value||"").trim().toLowerCase();
 const rows=Object.values(S.logs).sort((a,b)=>b.t-a.t).filter(l=>!q||`${dmy(l.t)} ${hm(l.t)} ${l.who} ${l.act}`.toLowerCase().includes(q)).slice(0,300);
 $("logs-body").innerHTML=rows.map(l=>`<tr><td style="white-space:nowrap;font-weight:800">${dmy(l.t)} ${hm(l.t)}</td><td style="font-weight:800;color:#1e3a8a">${esc(l.who)}</td><td>${esc(l.act)}</td></tr>`).join("");
}
function renderAdmin(){
 const ns=$("na-st");if(!ns.options.length)STN.forEach(s=>ns.add(new Option(s.full,s.code)));
 if(document.activeElement!==$("adm-num"))$("adm-num").value=S.meta.next;
 const rl={station:"Станция",dch:"ДЦХ",chief:"Старший ДЦХ",founder:"Основатель"};
 $("acc-list").innerHTML="<table><thead><tr><th>Сотрудник</th><th>Роль</th><th>Станция</th><th></th></tr></thead><tbody>"+Object.entries(S.users).map(([uid,u])=>`<tr><td><b>${esc(u.name)}</b><br><span class="muted">${esc(u.email)}</span></td><td>${esc(rl[u.role]||u.role)}</td><td>${esc(SN[u.code]||"—")}</td><td style="white-space:nowrap"><button type="button" class="btn btn-soft btn-sm" onclick="admToggle('${esc(uid)}')">${u.active===false?"Включить":"Отключить"}</button> <button type="button" class="btn btn-soft btn-sm" onclick="admReset('${esc(uid)}')">✉ Сброс пароля</button></td></tr>`).join("")+"</tbody></table>";
 $("tpl-list").innerHTML=CATS.flatMap(c=>(S.subs[c]||[]).filter(x=>String(x.id).startsWith("custom_")).map(x=>`<div class="row" style="padding:6px 0;border-bottom:1px solid rgba(148,163,184,.3)"><span><b>${esc(x.title)}</b> <span class="muted">(${CAT_RU[c]||c})</span></span><button type="button" class="btn btn-danger btn-sm" onclick="admDelTpl('${c}','${esc(x.id)}')" aria-label="Удалить шаблон">🗑</button></div>`)).join("");
}
function admDelTpl(c,id){W("subs/"+c,(S.subs[c]||[]).filter(x=>x.id!==id));log("Удалён пользовательский шаблон");toast("🗑 Шаблон удалён")}
async function admCreate(){
 const em=$("na-email").value.trim(),pw=$("na-pass").value,nm=$("na-name").value.trim(),role=$("na-role").value,code=$("na-st").value;
 if(!em||pw.length<6||!nm){toast("⚠️ Заполните электронную почту, пароль (от 6 символов) и фамилию");return}
 try{
  const j=await authCall("signUp",{email:em,password:pw,returnSecureToken:false});
  const prof={role,name:nm,email:em,active:true};if(role==="station")prof.code=code;
  W("users/"+j.localId,prof);log(`Создан аккаунт: ${nm} (${role})`);
  ["na-email","na-pass","na-name"].forEach(i=>$(i).value="");toast("✅ Аккаунт создан");
 }catch(e){toast("⚠️ "+(/EMAIL_EXISTS/.test(e.message)?"Такой адрес уже существует":e.message))}
}
function admToggle(uid){const u=S.users[uid];if(!u||uid===me.uid)return;W(`users/${uid}/active`,u.active===false);log(`${u.active===false?"Включён":"Отключён"} аккаунт: ${u.name}`)}
async function admReset(uid){const u=S.users[uid];if(!u)return;try{await authCall("sendOobCode",{requestType:"PASSWORD_RESET",email:u.email});toast("✉️ Письмо отправлено: "+u.email)}catch(e){toast("⚠️ "+e.message)}}
function admAddTpl(){
 const c=$("adm-cat").value,t=$("adm-title").value.trim(),b=$("adm-body").value.trim();
 if(!t||!b){toast("⚠️ Заполните название и текст");return}
 const arr=(S.subs[c]||[]).concat([{id:"custom_"+Date.now(),title:t,text:b}]);
 W("subs/"+c,arr);log(`Добавлен шаблон «${t}»`);$("adm-title").value="";$("adm-body").value="";toast("➕ Шаблон добавлен");
}
async function admSaveNum(){
 if(me.role!=="founder"){toast("⛔ Только основатель может задавать номер");return}
 const n=parseInt($("adm-num").value,10);
 if(!n||n<1||n>999999){toast("⚠️ Номер должен быть от 1 до 999999");return}
 if(n<S.meta.next){
  const go=await askConfirm("Изменение нумерации",`Новый номер (${n}) меньше текущего (${S.meta.next}). Продолжить?`,"Продолжить");
  if(!go)return;
 }
 W("meta",{next:n},true);log(`Установлен следующий номер приказа: № ${n}`);toast(`✅ Следующий номер: № ${n}`);
}
async function cleanup(manual){
 if(me.role!=="founder")return;
 if(manual){
  const go=await askConfirm("Очистка старых приказов","Удалить утверждённые приказы старше 5 дней? Сначала скачайте архив CSV — это действие необратимо.","Удалить");
  if(!go)return;
 }
 const lim=Date.now()-5*864e5;let n=0;
 Object.values(S.orders).forEach(o=>{if(!o.draft&&o.utvAt&&o.at<lim){W("orders/"+o.id,null);n++}});
 Object.entries(S.logs).sort((a,b)=>b[1].t-a[1].t).slice(300).forEach(([k])=>W("logs/"+k,null));
 if(n)log(`Очистка 5 дней: удалено утверждённых приказов — ${n}`);
 if(manual)toast(`🧹 Удалено: ${n}`);
}
function exportCSV(){
 const q=v=>{let s=String(v??"-");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return`"${s.replace(/"/g,'""')}"`};
 const d=t=>t?new Date(t).toLocaleString("ru-RU"):"-";
 let csv="\uFEFFПриказ №;Выдан;Обратно станция;Обратно время;Утверждено;ДЦХ;Раздел;Станции\n";
 pubs().forEach(o=>{csv+=[o.num,d(o.at),SN[o.obrSt]||"-",d(o.obr),d(o.utvAt),o.dch,CAT_RU[o.cat]||o.cat,o.stations.map(c=>SN[c]).join(", ")].map(q).join(";")+"\n"});
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
 a.download=`archive_chilanzar_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}

/* ===== Отчёты и аналитика ===== */
function reportList(){
 const shift=$("rp-shift").value,st=$("rp-station").value,ct=$("rp-cat").value,dch=$("rp-dch").value;
 const from=$("rp-from").value?new Date($("rp-from").value+"T00:00:00").getTime():null;
 const to=$("rp-to").value?new Date($("rp-to").value+"T23:59:59").getTime():null;
 return pubs().filter(o=>{
  if(shift!=="all"){const h=new Date(o.at).getHours();const day=h>=8&&h<20;if(shift==="day"&&!day)return false;if(shift==="night"&&day)return false}
  if(st!=="all"&&!o.stations.includes(st))return false;
  if(ct!=="all"&&o.cat!==ct)return false;
  if(dch!=="all"&&o.dch!==dch)return false;
  if(from&&o.at<from)return false;
  if(to&&o.at>to)return false;
  return true;
 });
}
function initReportFilters(){
 const st=$("rp-station");if(!st.options.length){st.add(new Option("Все станции","all"));STN.forEach(s=>st.add(new Option(s.full,s.code)))}
 const ct=$("rp-cat");if(!ct.options.length){ct.add(new Option("Все типы","all"));CATS.forEach(c=>ct.add(new Option(CAT_RU[c]||c,c)))}
 const dch=$("rp-dch");const names=[...new Set(pubs().map(o=>o.dch).filter(Boolean))].sort();
 const cur=dch.value;dch.innerHTML="";dch.add(new Option("Все сотрудники","all"));names.forEach(n=>dch.add(new Option(n,n)));
 if(cur&&[...dch.options].some(o=>o.value===cur))dch.value=cur;
}
function renderReports(){
 initReportFilters();
 const list=reportList();
 const cnt=k=>list.filter(o=>statusOf(o).k===k).length;
 $("rp-stats").innerHTML=[
  ["Всего приказов",list.length,"var(--primary)"],
  ["На утверждении",cnt("pending"),"var(--warning)"],
  ["Выдано",cnt("issued"),"var(--primary)"],
  ["Внесено в журнал",cnt("journal"),"var(--success)"],
  ["Отменено",cnt("canceled"),"var(--danger)"]
 ].map(([t,v,c])=>`<div class="stat" style="border-left-color:${c}"><b>${v}</b><span>${t}</span></div>`).join("");
 const rows=list.slice().reverse();
 $("rp-body").innerHTML=rows.map(o=>{const s=statusOf(o);return`<tr><td style="font-weight:900">${o.num}</td><td style="white-space:nowrap">${dmy(o.at)} ${hm(o.at)}</td><td>${esc(CAT_RU[o.cat]||o.cat)}</td><td>${esc(o.dch||"—")}</td><td>${esc(o.stations.map(c=>SN[c]).join(", ")||"—")}</td><td><span class="st ${s.c}">${s.t}</span></td></tr>`}).join("");
 show("rp-empty",!rows.length);
}
function exportReportCSV(){
 const list=reportList();
 const q=v=>{let s=String(v??"-");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return`"${s.replace(/"/g,'""')}"`};
 const d=t=>t?new Date(t).toLocaleString("ru-RU"):"-";
 let csv="\uFEFF№;Дата и время;Тип приказа;ДЦХ;Станции;Статус;Обратно;Утверждено\n";
 list.forEach(o=>{const s=statusOf(o);csv+=[o.num,d(o.at),CAT_RU[o.cat]||o.cat,o.dch||"-",o.stations.map(c=>SN[c]).join(", ")||"-",s.t,d(o.obr),d(o.utvAt)].map(q).join(";")+"\n"});
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
 a.download=`otchet_chilanzar_${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
 toast(`📥 Отчёт выгружен (${list.length} записей)`);
}

/* ===== Старт приложения ===== */
net(true);
(async()=>{
 try{
  const sv=JSON.parse(localStorage.getItem(AK)||"null"),pf=JSON.parse(localStorage.getItem(LSP)||"null");
  if(!sv||!pf)return;
  TOK={ref:sv.ref,uid:pf.uid,exp:0};
  try{await refresh()}catch(e){if(e.auth){clearSess();TOK=null;return}}
  enter(mk(pf),false);
 }catch(e){}
})();
