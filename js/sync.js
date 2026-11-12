/* ===== Синхронизация с Firebase и Авторизация ===== */
let TOK=null,INIT={},streams=[],flushing=false,lastFlushErr="",_loggingOut=false,_loginAttempts=0,_loginLockUntil=0;

function net(ok){
 const e=$("net");if(!e)return;
 const on=ok&&navigator.onLine!==false;
 e.className="net-bar "+(on?"net-online":"net-offline");
 e.textContent=on
  ?(OUT.length?`🟡 ОНЛАЙН (в очереди: ${OUT.length})`:"🟢 ОНЛАЙН")
  :`🔴 НЕТ СВЯЗИ С СЕРВЕРОМ — автономный режим${OUT.length?` (в очереди: ${OUT.length})`:""}${lastFlushErr?` [${lastFlushErr}]`:""}`;
}

function persist(){
 try{localStorage.setItem(LS,JSON.stringify(S));localStorage.setItem(LSO,JSON.stringify(OUT))}catch(e){}
}
function setPath(root,p,v,m){
 const k=p.split("/");let o=root;
 for(let i=0;i<k.length-1;i++){if(typeof o[k[i]]!=="object"||o[k[i]]===null)o[k[i]]={};o=o[k[i]]}
 const l=k[k.length-1];
 if(v===null)delete o[l];
 else if(m)o[l]=Object.assign(typeof o[l]=="object"&&o[l]?o[l]:{},v);
 else o[l]=v;
}
function W(p,v,m){
 if(p==="meta"&&v&&typeof v==="object"&&"next"in v&&me&&me.role!=="founder"&&v.next<(S.meta.next||1)){
  toast("⛔ Нельзя уменьшить номер приказа");return;
 }
 setPath(S,p,v,m);
 Object.values(S.orders).forEach(o=>{o.canceled=!!(o.cancel||o.canceled)});
 OUT.push({p,v,m:!!m,ts:Date.now()});
 if(OUT.length>200)OUT=OUT.slice(-150);
 persist();flush();render();
}
function log(a){
 const t=Date.now();
 W(`logs/${t}_${Math.random().toString(36).slice(2,6)}`,{t,uid:me?me.uid:"",who:me?me.name:"Система",act:a});
}

async function flush(){
 if(flushing)return;flushing=true;
 try{
  const t=await tok();
  if(!t){lastFlushErr="нет авторизации";net(false);return}
  let consecutiveFail=0;
  while(OUT.length){
   const o=OUT[0];
   let r;
   try{
    r=await dbf(o.p,{method:o.v===null?"DELETE":o.m?"PATCH":"PUT",headers:{"Content-Type":"application/json"},body:o.v===null?undefined:JSON.stringify(o.v),timeout:12000});
   }catch(netErr){
    lastFlushErr=netErr.name==="AbortError"?"таймаут сети":(netErr.message||"сеть недоступна");
    consecutiveFail++;
    if(consecutiveFail>=2)throw netErr;
    await new Promise(res=>setTimeout(res,1000));
    continue;
   }
   if(!r.ok&&r.status<500){
    let body="";try{body=await r.text()}catch(e){}
    console.warn("отклонено",o.p,r.status,body);
    lastFlushErr=r.status+" "+String(body).slice(0,100);
    if(r.status===401){
     try{await refresh();consecutiveFail=0;continue}catch(e){forceLogout("Сессия истекла. Войдите снова.");break}
    }
    toast(r.status===403?`⛔ Нет прав: ${o.p}`:`⚠️ Отклонено сервером (${r.status}): ${o.p}`);
    OUT.shift();persist();consecutiveFail=0;continue;
   }
   if(!r.ok){
    lastFlushErr="HTTP "+r.status;
    consecutiveFail++;
    if(consecutiveFail>=3)throw 0;
    await new Promise(res=>setTimeout(res,800));
    continue;
   }
   OUT.shift();persist();if(R)setPath(R,o.p,o.v,o.m);consecutiveFail=0;lastFlushErr="";
  }
  net(true);
 }catch(e){
  lastFlushErr=lastFlushErr||(e&&e.message)||"сбой связи";net(false);
 }finally{flushing=false}
}

const poll=()=>{flush();connect()};
window.addEventListener("online",()=>poll());
window.addEventListener("offline",()=>net(false));

async function forceSync(){
 toast("☁️ Синхронизация…");
 await flush();
 await connect();
 toast(OUT.length?"⚠️ Остались неотправленные данные":"✅ Синхронизировано");
}

function node(root,path,create){
 let o=root;
 for(const k of path.split("/").filter(Boolean)){
  if(typeof o[k]!=="object"||o[k]===null){if(!create)return null;o[k]={}}
  o=o[k];
 }
 return o;
}
function rebuild(){
 const old=S;S=norm(clone(R||{}));
 OUT.forEach(o=>setPath(S,o.p,o.v,o.m));
 return old;
}
function newForMe(old){
 return me?Object.values(S.orders).filter(o=>!o.draft&&!old.orders[o.id]&&(me.role!=="station"||(!o.noSt&&o.stations.includes(me.code)))):[];
}
function onEv(ev,base){
 try{
  const d=JSON.parse(ev.data),full=base+(d.path==="/"?"":d.path),first=!INIT[base];INIT[base]=1;
  R=R||{};
  if(ev.type==="patch"){
   const t=node(R,full,true);
   for(const k in d.data){if(d.data[k]===null)delete t[k];else t[k]=d.data[k]}
  }else setPath(R,full,d.data,false);
  const old=rebuild(),nw=newForMe(old);persist();
  if(me){if(!first&&nw.length)alertNew(nw);render()}
 }catch(e){console.error(e)}
}
async function connect(){
 streams.forEach(e=>e.close());streams=[];INIT={};
 const t=await tok();if(!me||!t)return;
 const ps=["orders","meta","subs"];
 if(me.role==="chief"||me.role==="founder")ps.push("logs");
 if(me.role==="founder")ps.push("users");
 ps.forEach(b=>{
  const e=new EventSource(`${BASE}/${b}.json?auth=${t}`);
  e.onopen=()=>net(true);
  e.onerror=()=>{net(false);if(e.readyState===2)setTimeout(()=>{if(streams.includes(e))connect()},5000)};
  e.addEventListener("put",ev=>onEv(ev,b));
  e.addEventListener("patch",ev=>onEv(ev,b));
  e.addEventListener("auth_revoked",()=>connect());
  streams.push(e);
 });
}
setInterval(()=>{if(me)connect()},3e6);

async function claimNum(){
 for(let i=0;i<4;i++){
  try{
   const r=await dbf("meta/next",{headers:{"X-Firebase-ETag":"true"},timeout:6000});
   if(!r.ok)break;
   const et=r.headers.get("ETag"),n=await r.json();
   if(typeof n!=="number"||n<1)break;
   const w=await dbf("meta/next",{method:"PUT",headers:et?{"If-Match":et,"Content-Type":"application/json"}:{"Content-Type":"application/json"},body:JSON.stringify(n+1),timeout:6000});
   if(w.ok){S.meta.next=n+1;persist();return n}
   if(w.status!==412)break;
  }catch(e){break}
 }
 const n=S.meta.next||1;
 S.meta.next=n+1;
 OUT.push({p:"meta",v:{next:n+1,activeDch:S.meta.activeDch||"—",prevDch:S.meta.prevDch||"—"},m:true,ts:Date.now()});
 persist();
 return n;
}

async function syncClock(){
 try{
  const a=_dn(),r=await dbf("ping/"+me.uid,{method:"PUT",body:'{".sv":"timestamp"}'}),t=await r.json(),b=_dn();
  if(typeof t==="number")OFF=Math.round(t-(a+b)/2);
 }catch(e){}
}
setInterval(()=>{if(me)syncClock()},6e5);

/* ===== Авторизация Firebase ===== */
async function authCall(ep,body){
 const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${ep}?key=${API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const j=await r.json();
 if(!r.ok)throw new Error((j.error&&j.error.message)||"ERROR");
 return j;
}
function saveRef(){try{localStorage.setItem(AK,JSON.stringify({ref:TOK.ref}))}catch(e){}}
function setTok(j){TOK={id:j.idToken,ref:j.refreshToken,uid:j.localId,exp:_dn()+(+j.expiresIn-120)*1000};saveRef()}
async function refresh(){
 let r,j;
 try{
  r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(TOK.ref)});
  j=await r.json();
 }catch(e){throw new Error("сеть")}
 if(!r.ok){const er=new Error("auth");er.auth=true;throw er}
 TOK.id=j.id_token;TOK.ref=j.refresh_token;TOK.exp=_dn()+(+j.expires_in-120)*1000;saveRef();
}
async function tok(){
 if(!TOK)return null;
 if(!TOK.id||_dn()>=TOK.exp){
  try{await refresh()}catch(e){if(e.auth)forceLogout("Сессия завершена. Войдите снова.");return null}
 }
 return TOK.id;
}
const dbf=async(p,o={})=>{
 const t=await tok();if(!t)throw new Error("нет авторизации");
 const ctrl=new AbortController();
 const ms=typeof o.timeout==="number"?o.timeout:10000;
 const timer=setTimeout(()=>ctrl.abort(),ms);
 try{
  const opts={...o,signal:ctrl.signal};delete opts.timeout;
  return await fetch(`${BASE}/${p}.json?auth=${t}`,opts);
 }finally{clearTimeout(timer)}
};
const mk=p=>({uid:p.uid,login:p.uid,role:p.role,code:p.code||"",name:p.name||p.email,title:p.name||p.email,stationFull:SN[p.code]||"",sur:""});
function clearSess(){try{[AK,LSP,LS,LSO,LSS].forEach(k=>localStorage.removeItem(k))}catch(e){}}
function clearRuntimeState(){
 streams.forEach(e=>{try{e.close()}catch(_){}});streams=[];INIT={};
 if(tb){clearInterval(tb);tb=null}
 try{document.title=baseTitle}catch(_){}
 me=null;TOK=null;OUT=[];R=null;PB=false;pend=false;jLimit=30;tab="journal";
 S=defaults();
 clearSess();
 try{sessionStorage.clear()}catch(_){}
}
async function firebaseSignOut(){
 try{
  if(TOK&&TOK.id)await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signOut?key=${API_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:TOK.id})});
  return true;
 }catch(e){return false}
}
function forceLogout(msg){
 clearRuntimeState();
 show("modal",false);show("confirm",false);closeBuilder();
 show("view-app",false);show("view-login",true);
 const le=$("login-err");
 if(msg){le.textContent=msg;show("login-err",true)}else{le.textContent="";show("login-err",false)}
 try{$("inp-pass").value="";$("inp-login").value=""}catch(_){}
 _loggingOut=false;
 const lb=$("btn-logout");if(lb){lb.disabled=false;lb.textContent="Выйти"}
}
async function doLogin(){
 const em=$("inp-login").value.trim(),pw=$("inp-pass").value;
 if(!em||!pw){$("login-err").textContent="Введите электронную почту и пароль";show("login-err",true);return}
 if(Date.now()<_loginLockUntil){toast("⏳ Слишком много попыток. Подождите немного.");return}
 try{
  setTok(await authCall("signInWithPassword",{email:em,password:pw,returnSecureToken:true}));
  const r=await dbf("users/"+TOK.uid),p=await r.json();
  if(!r.ok||!p||!p.role||p.active===false){TOK=null;clearSess();throw new Error("NOACCESS")}
  _loginAttempts=0;
  try{localStorage.setItem(LSP,JSON.stringify(Object.assign({uid:TOK.uid},p)))}catch(e){}
  enter(mk(Object.assign({uid:TOK.uid},p)),true);
 }catch(e){
  _loginAttempts++;
  if(_loginAttempts>=5){_loginLockUntil=Date.now()+30000;_loginAttempts=0}
  const m=String(e.message);
  $("login-err").textContent=/INVALID|EMAIL_NOT|PASSWORD|CREDENTIAL/.test(m)?"❌ Неверная электронная почта или пароль":/TOO_MANY/.test(m)?"⏳ Слишком много попыток, подождите":m==="NOACCESS"?"⛔ Нет доступа: профиль не создан или отключён":m==="сеть"?"📡 Нет связи с сервером. Проверьте интернет.":"❌ Ошибка входа: "+m;
  show("login-err",true);beep(300,.3);
 }
}
async function resetPass(){
 const em=$("inp-login").value.trim();
 if(!em){$("login-err").textContent="Введите электронную почту и нажмите «Забыли пароль?»";show("login-err",true);return}
 try{await authCall("sendOobCode",{requestType:"PASSWORD_RESET",email:em});toast("✉️ Письмо для сброса пароля отправлено")}catch(e){toast("⚠️ Не удалось отправить: "+e.message)}
}
function enter(u,fresh){
 me=u;if(fresh)log("Вход в систему");
 show("view-login",false);show("view-app",true);show("login-err",false);$("inp-pass").value="";
 initBuilder();connect();syncClock();askNotif();openTab("journal");
 if(u.role==="founder")setTimeout(()=>{if(me&&R){if(!R.meta)W("meta",S.meta);if(!R.subs)W("subs",S.subs);cleanup(false)}},4000);
}
async function doLogout(){
 if(_loggingOut)return;
 _loggingOut=true;
 const lb=$("btn-logout");if(lb){lb.disabled=true;lb.textContent="Выход…"}
 try{
  try{await Promise.race([flush(),new Promise(r=>setTimeout(r,4000))])}catch(e){}
  if(OUT.length){
   const go=await askConfirm("Выход из системы","Есть несохранённые изменения — связь с сервером отсутствует. Если выйти сейчас, они будут потеряны. Продолжить выход?","Выйти без сохранения");
   if(!go){_loggingOut=false;if(lb){lb.disabled=false;lb.textContent="Выйти"}return}
  }
  log("Выход из системы");
  try{await Promise.race([flush(),new Promise(r=>setTimeout(r,3000))])}catch(e){}
  const okSrv=await firebaseSignOut();
  forceLogout(okSrv?"":"⚠️ Вы вышли из приложения, но завершить сеанс на сервере не удалось (нет связи). При подозрении на чужой доступ смените пароль.");
  toast(okSrv?"✅ Вы вышли из системы":"✅ Вы вышли из системы (локально)");
 }catch(e){
  forceLogout("⚠️ Не удалось завершить выход: "+((e&&e.message)||"неизвестная ошибка")+". Попробуйте ещё раз.");
 }finally{
  _loggingOut=false;
  const b=$("btn-logout");if(b){b.disabled=false;b.textContent="Выйти"}
 }
}
