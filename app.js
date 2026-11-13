/* ==========================================================================
   app.js — Чистый Журнал ДУ-58 1:1, Модальное окно штампа, Действия по клику
   ========================================================================== */

const clone = x => JSON.parse(JSON.stringify(x));
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const show = (id, on) => { const el = $(id); if (el) el.classList.toggle("hidden", !on); };

function defaults() {
  const nowD = new Date();
  const ym = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0");
  return {
    users: {},
    subs: {},
    meta: { next: 1, month: ym, activeDch: "Икрамов Д.", prevDch: "Исмоилов А." },
    duties: {},
    orders: {},
    logs: {}
  };
}

function norm(r) {
  const d = defaults();
  const s = {
    users: r.users || d.users,
    subs: r.subs || d.subs,
    meta: Object.assign(d.meta, r.meta || {}),
    duties: r.duties || {},
    orders: r.orders || {},
    logs: r.logs || {}
  };
  Object.values(s.orders).forEach(o => {
    o.stations = o.stations || [];
    o.acks = o.acks || {};
    o.f = o.f || {};
    o.canceled = !!(o.cancel || o.canceled);
    if (o.cat === "HOZ_WRONG_DIR") o.cat = "STAMP_26";
    if (o.cat === "TRACK_CLOSE_TWOWAY") o.cat = "STAMP_14";
  });
  return s;
}

let S, OUT = [], me = null, activeDraft = null, selectedOrderId = null;
try {
  S = norm(JSON.parse(localStorage.getItem(LS) || "null") || defaults());
  OUT = JSON.parse(localStorage.getItem(LSO) || "[]");
} catch (e) {
  S = defaults();
  OUT = [];
}

/* Блокировка случайного зума на планшетах */
document.addEventListener("touchmove", function(e) {
  if (e.touches && e.touches.length > 1) e.preventDefault();
}, { passive: false });
document.addEventListener("dblclick", function(e) {
  e.preventDefault();
}, { passive: false });

/* ===== ВРЕМЯ И ФОРМАТИРОВАНИЕ ПОД КНИГУ ДУ-58 ===== */
const _dn = Date.now.bind(Date);
let OFF = 0;
Date.now = () => Math.round(_dn() + OFF);

const p2 = n => String(n).padStart(2, "0");
const hm = t => { const d = new Date(t); return p2(d.getHours()) + ":" + p2(d.getMinutes()); };
const dmy = t => { const d = new Date(t); return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + String(d.getFullYear()).slice(-2); };
const nowHM = () => hm(Date.now());
const curYearMonth = () => { const d = new Date(Date.now()); return d.getFullYear() + "-" + p2(d.getMonth() + 1); };

function penTimeHTML(hmStr) {
  return `<span class="pen-time">${esc(hmStr || "")}</span>`;
}

function atNear(s, ref = Date.now()) {
  const [h, m] = (s || "00:00").split(":").map(Number);
  const d = new Date(ref);
  d.setHours(h || 0, m || 0, 0, 0);
  let t = d.getTime();
  if (t > ref + 432e5) t -= 864e5;
  else if (t < ref - 432e5) t += 864e5;
  return t;
}
function atAfter(s, base) {
  const [h, m] = (s || "00:00").split(":").map(Number);
  const d = new Date(base);
  d.setHours(h || 0, m || 0, 0, 0);
  let t = d.getTime();
  if (t < base) t += 864e5;
  return t;
}

const pubsChrono = () => Object.values(S.orders).filter(o => !o.draft).sort((a, b) => a.at - b.at || (a.num || 0) - (b.num || 0));

function floorTs(ex) {
  let f = 0;
  pubsChrono().forEach(o => {
    if (o.id !== ex && !o.canceled) f = Math.max(f, o.utvAt || o.obr || o.at);
  });
  return f || null;
}

function shiftText() {
  const h = new Date(Date.now()).getHours();
  return h >= 8 && h < 20 ? "☀️ 08:00–20:00" : "🌙 20:00–08:00";
}

/* ===== КОМПАКТНАЯ ЛЕВАЯ ПАНЕЛЬ 20% (ШАБЛОНЫ) ===== */
function renderSidebarTemplates() {
  const box = $("tpl-buttons-box");
  if (!box) return;
  const q = ($("tpl-filter-inp")?.value || "").trim().toLowerCase();
  const filtered = STAMP_TEMPLATES.filter(t => !q || `${t.num} ${t.short} ${t.title}`.toLowerCase().includes(q));

  box.innerHTML = filtered.map(t => `<button type="button" class="tpl-btn ${t.color} ${activeDraft && activeDraft.cat === t.key ? 'active' : ''}" id="tbtn-${t.key}" onclick="openStampInJournal('${t.key}')" title="${esc(t.title)}">
    <span class="t-num">${esc(t.num)}</span>
    <span class="t-txt">${esc(t.short || t.title)}</span>
  </button>`).join("");
}

function openStampInJournal(catKey, editOrder = null) {
  if (me && me.role === "station") {
    toast("⛔ Дежурный по станции только принимает приказы");
    return;
  }
  activeDraft = createDefaultDraft(catKey, editOrder);
  renderSidebarTemplates();
  renderStampModal();
  show("stamp-modal", true);
}

function closeLiveStamp() {
  activeDraft = null;
  show("stamp-modal", false);
  renderSidebarTemplates();
}

function scrollToBottom(smooth = false) {
  const sc = $("journal-scroll");
  if (!sc) return;
  const behavior = smooth ? "smooth" : "auto";
  sc.scrollTo({ top: sc.scrollHeight, behavior });
  const rows = document.querySelectorAll("#du58-tbody tr.du58-row");
  if (rows.length) {
    rows[rows.length - 1].scrollIntoView({ behavior, block: "end" });
  }
}

/* ===== СИНХРОНИЗАЦИЯ И СЕССИЯ ===== */
function net(ok) {
  const dot = $("net-dot");
  if (!dot) return;
  const isOk = ok && navigator.onLine !== false;
  dot.className = "net-dot" + (isOk ? "" : " offline");
  dot.title = isOk ? "Онлайн — синхронизировано с Firebase" : "Оффлайн — сохранение в память планшета";
}

function persist() {
  try {
    localStorage.setItem(LS, JSON.stringify(S));
    localStorage.setItem(LSO, JSON.stringify(OUT));
  } catch (e) {}
}

function setPath(root, p, v, m) {
  const k = p.split("/");
  let o = root;
  for (let i = 0; i < k.length - 1; i++) {
    if (typeof o[k[i]] !== "object" || o[k[i]] === null) o[k[i]] = {};
    o = o[k[i]];
  }
  const l = k[k.length - 1];
  if (v === null) delete o[l];
  else if (m) o[l] = Object.assign(typeof o[l] === "object" && o[l] ? o[l] : {}, v);
  else o[l] = v;
}

function W(p, v, m) {
  setPath(S, p, v, m);
  Object.values(S.orders).forEach(o => { o.canceled = !!(o.cancel || o.canceled); });
  OUT.push({ p, v, m: !!m, ts: Date.now() });
  if (OUT.length > 200) OUT = OUT.slice(-150);
  persist();
  flush();
  render();
}

let TOK = null, R = null, INIT = {}, streams = [], flushing = false, PB = false;

async function authCall(ep, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${ep}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || "ERROR");
  return j;
}

function saveRef() {
  try { localStorage.setItem(AK, JSON.stringify({ ref: TOK.ref })); } catch (e) {}
}
function setTok(j) {
  TOK = { id: j.idToken, ref: j.refreshToken, uid: j.localId, exp: _dn() + (+j.expiresIn - 120) * 1000 };
  saveRef();
}
async function refresh() {
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(TOK.ref)
  });
  const j = await r.json();
  if (!r.ok) { const er = new Error("auth"); er.auth = true; throw er; }
  TOK.id = j.id_token;
  TOK.ref = j.refresh_token;
  TOK.exp = _dn() + (+j.expires_in - 120) * 1000;
  saveRef();
}
async function tok() {
  if (!TOK) return null;
  if (!TOK.id || _dn() >= TOK.exp) {
    try { await refresh(); } catch (e) { return null; }
  }
  return TOK.id;
}
async function dbf(p, o = {}) {
  const t = await tok();
  if (!t) throw new Error("нет авторизации");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeout || 10000);
  try {
    const opts = { ...o, signal: ctrl.signal };
    delete opts.timeout;
    return await fetch(`${BASE}/${p}.json?auth=${t}`, opts);
  } finally {
    clearTimeout(timer);
  }
}

async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const t = await tok();
    if (!t) { net(false); return; }
    while (OUT.length) {
      const o = OUT[0];
      const r = await dbf(o.p, {
        method: o.v === null ? "DELETE" : o.m ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: o.v === null ? undefined : JSON.stringify(o.v)
      });
      if (!r.ok && r.status < 500) {
        OUT.shift();
        persist();
        continue;
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      OUT.shift();
      persist();
      if (R) setPath(R, o.p, o.v, o.m);
    }
    net(true);
  } catch (e) {
    net(false);
  } finally {
    flushing = false;
  }
}

function node(root, path, create) {
  let o = root;
  for (const k of path.split("/").filter(Boolean)) {
    if (typeof o[k] !== "object" || o[k] === null) {
      if (!create) return null;
      o[k] = {};
    }
    o = o[k];
  }
  return o;
}

function rebuild() {
  const old = S;
  S = norm(clone(R || {}));
  OUT.forEach(o => setPath(S, o.p, o.v, o.m));
  return old;
}

function onEv(ev, base) {
  try {
    const d = JSON.parse(ev.data), full = base + (d.path === "/" ? "" : d.path), first = !INIT[base];
    INIT[base] = 1;
    R = R || {};
    if (ev.type === "patch") {
      const t = node(R, full, true);
      for (const k in d.data) {
        if (d.data[k] === null) delete t[k];
        else t[k] = d.data[k];
      }
    } else {
      setPath(R, full, d.data, false);
    }
    const old = rebuild();
    persist();
    if (me) {
      const nw = Object.values(S.orders).filter(o => !o.draft && !old.orders[o.id] && (me.role !== "station" || (!o.noSt && o.stations.includes(me.code))));
      if (!first && nw.length) beep(880, 0.35);
      render();
      if ((first && base === "orders") || (!first && nw.length)) {
        setTimeout(() => scrollToBottom(false), 80);
      }
    }
  } catch (e) {}
}

async function connect() {
  streams.forEach(e => e.close());
  streams = [];
  INIT = {};
  const t = await tok();
  if (!me || !t) return;
  const ps = ["orders", "meta", "subs"];
  if (me.role === "chief" || me.role === "founder") ps.push("logs");
  if (me.role === "founder") ps.push("users");
  ps.forEach(b => {
    const e = new EventSource(`${BASE}/${b}.json?auth=${t}`);
    e.onopen = () => net(true);
    e.onerror = () => net(false);
    e.addEventListener("put", ev => onEv(ev, b));
    e.addEventListener("patch", ev => onEv(ev, b));
    streams.push(e);
  });
}

/* ===== АВТОСБРОС НУМЕРАЦИИ С 1-ГО ЧИСЛА КАЖДОГО МЕСЯЦА ===== */
async function claimNum() {
  const curYM = curYearMonth();
  for (let i = 0; i < 4; i++) {
    try {
      const r = await dbf("meta", { headers: { "X-Firebase-ETag": "true" }, timeout: 6000 });
      if (!r.ok) break;
      const et = r.headers.get("ETag"), metaData = (await r.json()) || {};
      const serverYM = metaData.month || "";
      let n = typeof metaData.next === "number" && metaData.next >= 1 ? metaData.next : 1;
      if (serverYM !== curYM) n = 1;

      const updatedMeta = {
        next: n + 1,
        month: curYM,
        activeDch: metaData.activeDch || S.meta.activeDch || "—",
        prevDch: metaData.prevDch || S.meta.prevDch || "—"
      };
      const w = await dbf("meta", {
        method: "PUT",
        headers: et ? { "If-Match": et, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
        body: JSON.stringify(updatedMeta),
        timeout: 6000
      });
      if (w.ok) {
        S.meta.next = n + 1;
        S.meta.month = curYM;
        persist();
        return n;
      }
      if (w.status !== 412) break;
    } catch (e) { break; }
  }
  const serverYM = S.meta.month || "";
  let n = S.meta.next || 1;
  if (serverYM !== curYM) n = 1;
  S.meta.next = n + 1;
  S.meta.month = curYM;
  OUT.push({
    p: "meta",
    v: { next: n + 1, month: curYM, activeDch: S.meta.activeDch || "—", prevDch: S.meta.prevDch || "—" },
    m: true,
    ts: Date.now()
  });
  persist();
  return n;
}

/* ===== УВЕДОМЛЕНИЯ И МОДАЛЫ ===== */
let AC, tt;
function beep(f = 860, d = 0.25) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.value = f;
    g.gain.value = 0.2;
    o.connect(g);
    g.connect(AC.destination);
    o.start();
    o.stop(AC.currentTime + d);
  } catch (e) {}
}
function toast(t) {
  const e = $("toast");
  if (!e) return;
  e.textContent = t;
  show("toast", true);
  clearTimeout(tt);
  tt = setTimeout(() => show("toast", false), 3400);
}
function ask(title, def, cb) {
  $("m-title").textContent = title;
  $("m-inp").value = def || "";
  show("modal", true);
  $("m-inp").focus();
  const done = v => { show("modal", false); if (v) cb(v); };
  $("m-ok").onclick = () => done($("m-inp").value.trim());
  $("m-no").onclick = () => done(null);
}
function confirmDanger(title, text, onOk) {
  $("c-title").textContent = title;
  $("c-body").innerHTML = `<div style="background:#fef2f2;border:2px solid #dc2626;padding:12px;border-radius:10px;color:#7f1d1d;font-weight:700;font-size:13.5px">${esc(text)}</div>`;
  show("confirm", true);
  $("c-ok").onclick = () => { show("confirm", false); onOk(); };
  $("c-no").onclick = () => show("confirm", false);
}

function dutyOf() { return me ? me.name : ""; }
function log(a) {
  const t = Date.now();
  W(`logs/${t}_${Math.random().toString(36).slice(2, 6)}`, { t, uid: me ? me.uid : "", who: me ? me.name : "Система", act: a });
}

/* ===== ВХОД / ВЫХОД ===== */
const mk = p => ({
  uid: p.uid,
  login: p.uid,
  role: p.role,
  code: p.code || "",
  name: p.name || p.email,
  stationFull: SN[p.code] || ""
});

async function doLogin() {
  const em = $("inp-login").value.trim(), pw = $("inp-pass").value;
  if (!em || !pw) {
    $("login-err").textContent = "Введите электронную почту и пароль";
    show("login-err", true);
    return;
  }
  try {
    setTok(await authCall("signInWithPassword", { email: em, password: pw, returnSecureToken: true }));
    const r = await dbf("users/" + TOK.uid), p = await r.json();
    if (!r.ok || !p || !p.role || p.active === false) throw new Error("NOACCESS");
    try { localStorage.setItem(LSP, JSON.stringify(Object.assign({ uid: TOK.uid }, p))); } catch (e) {}
    enter(mk(Object.assign({ uid: TOK.uid }, p)), true);
  } catch (e) {
    $("login-err").textContent = "❌ Неверная почта/пароль или нет доступа (" + e.message + ")";
    show("login-err", true);
    beep(300, 0.3);
  }
}

async function resetPass() {
  const em = $("inp-login").value.trim();
  if (!em) {
    $("login-err").textContent = "Введите почту и нажмите «Забыли пароль?»";
    show("login-err", true);
    return;
  }
  try {
    await authCall("sendOobCode", { requestType: "PASSWORD_RESET", email: em });
    toast("✉️ Письмо для сброса пароля отправлено");
  } catch (e) {
    toast("⚠️ Ошибка: " + e.message);
  }
}

function enter(u, fresh) {
  me = u;
  if (fresh) log("Вход в систему (Журнал ДУ-58)");
  show("view-login", false);
  show("view-app", true);
  renderSidebarTemplates();
  connect();
  render();
  scrollToBottom(false);
  setTimeout(() => scrollToBottom(false), 150);
  setTimeout(() => scrollToBottom(false), 500);
}

function doLogout() {
  streams.forEach(e => { try { e.close(); } catch (_) {} });
  streams = [];
  me = null;
  TOK = null;
  activeDraft = null;
  [AK, LSP].forEach(k => localStorage.removeItem(k));
  show("stamp-modal", false);
  show("order-act-modal", false);
  show("view-app", false);
  show("view-login", true);
  toast("✅ Вы вышли из системы");
}

/* ===== МОДАЛЬНОЕ ОКНО ОФОРМЛЕНИЯ ШТАМПА (УДОБНОЕ И ПРОСТОРНОЕ) ===== */
function toggleDraftStation(code) {
  if (!activeDraft) return;
  const idx = activeDraft.stations.indexOf(code);
  if (idx >= 0) {
    if (activeDraft.stations.length > 1) activeDraft.stations.splice(idx, 1);
  } else {
    activeDraft.stations.push(code);
    activeDraft.stations = STN.map(s => s.code).filter(c => activeDraft.stations.includes(c));
  }
  renderStampModal();
}

function selectStationRange(i1, i2, forcedTrack = null) {
  if (!activeDraft) return;
  activeDraft.fromIdx = i1;
  activeDraft.toIdx = i2;

  const st = i1 <= i2 ? 1 : -1;
  const arr = [];
  for (let i = i1; i !== i2 + st; i += st) arr.push(STN[i].code);
  activeDraft.stations = arr;

  let track = forcedTrack;
  if (!track) {
    if (i1 > i2) track = "II";
    else if (i1 < i2) track = "I";
    else track = activeDraft.f["c-track"] || "II";
  }

  if (activeDraft.cat === "STAMP_26") {
    activeDraft.f["hoz-dep-station"] = STN[i1].code;
    activeDraft.f["hoz-dest-station"] = STN[i2].code;
    activeDraft.f["hoz-tr1"] = i1 < i2 ? "II" : "I";
    activeDraft.f["hoz-tr2"] = activeDraft.f["hoz-tr1"];
    renderStampModal();
    return;
  }

  applyDirectionalUpdate(track);
  renderStampModal();
}

function setFullChilonzorLine(trackMode) {
  if (!activeDraft) return;
  if (trackMode === "I") {
    selectStationRange(0, 16, "I");
    activeDraft.stations = STN.map(s => s.code);
  } else if (trackMode === "II") {
    selectStationRange(16, 0, "II");
    activeDraft.stations = STN.map(s => s.code);
  } else {
    selectStationRange(16, 0, "I и II");
    activeDraft.stations = STN.map(s => s.code);
  }
  renderStampModal();
}

function switchActiveTrackDirection(trackMode) {
  if (!activeDraft) return;
  const hi = Math.max(activeDraft.fromIdx ?? 16, activeDraft.toIdx ?? 0);
  const lo = Math.min(activeDraft.fromIdx ?? 16, activeDraft.toIdx ?? 0);
  if (trackMode === "I") {
    selectStationRange(lo, hi, "I");
  } else if (trackMode === "II") {
    selectStationRange(hi, lo, "II");
  } else {
    selectStationRange(hi, lo, "I и II");
  }
}

function renderStampModal() {
  if (!activeDraft) return;
  const d = activeDraft, f = d.f;
  const metaTpl = TPL_MAP[d.cat] || STAMP_TEMPLATES[0];
  const nextNum = (S.meta.month && S.meta.month !== curYearMonth()) ? 1 : (S.meta.next || 1);
  const numPreview = d.editId ? (S.orders[d.editId]?.num || nextNum) : nextNum;

  $("sm-title").innerHTML = `<span style="color:#fde047;margin-right:6px">[${esc(metaTpl.num)}]</span> ${esc(metaTpl.title)} — <span style="color:#93c5fd">Приказ № ${esc(numPreview)}</span>`;
  $("sm-pub-btn").textContent = `🚀 Выдать приказ № ${numPreview} в книгу ДУ-58`;

  const curFrom = d.fromIdx ?? 16;
  const curTo = d.toIdx ?? 0;
  const curTrack = f["c-track"] || f["s11-put"] || "II";

  let cancelPickerHTML = "";
  if (["STAMP_13", "STAMP_19"].includes(d.cat)) {
    const prevOrders = pubsChrono().filter(o => !o.canceled).slice().reverse();
    if (prevOrders.length) {
      const cOpts = prevOrders.map(o => `<option value="${o.id}" ${String(o.num) === String(f["c-cancel-num"]) ? "selected" : ""}>Приказ № ${o.num} от ${dmy(o.at)} (${esc(o.f?.["c-section"] || o.subTitle)})</option>`).join("");
      cancelPickerHTML = `<div style="padding:8px 12px;background:#dcfce7;border:1px solid #16a34a;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;font-weight:800;color:#14532d">
        <span>🔗 Автозаполнение из отменяемого приказа:</span>
        <select class="inp" style="width:auto;padding:4px 10px;font-size:12.5px" onchange="pickCancelOrder(this.value)">${cOpts}</select>
      </div>`;
    }
  }

  let stPicker = "";
  if (d.cat !== "SHIFT_HANDOVER") {
    const optsA = STN.slice(0, 17).map((s, idx) => `<option value="${idx}" ${curFrom === idx ? "selected" : ""}>${esc(s.full)}</option>`).join("");
    const optsB = STN.slice(0, 17).map((s, idx) => `<option value="${idx}" ${curTo === idx ? "selected" : ""}>${esc(s.full)}</option>`).join("");
    const chips = !metaTpl.noSt
      ? `<div class="st-chips">` + STN.map(s => `<span class="st-chip ${d.stations.includes(s.code) ? 'active' : ''}" onclick="toggleDraftStation('${s.code}')">${esc(s.full)}</span>`).join("") + `</div>`
      : "";

    stPicker = `<div class="st-picker-bar">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:800;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <span>🕒 Время выдачи:</span>
          <input type="time" class="inp" style="width:105px;padding:3px 6px;font-size:13px;text-align:center" value="${esc(f["b-time"])}" oninput="setDF('b-time',this.value)">
          <button type="button" class="btn btn-soft btn-xs" onclick="setDF('b-time',nowHM(),true)">⏱ Сейчас</button>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button type="button" class="btn ${curTrack === 'II' ? 'btn-primary' : 'btn-soft'} btn-xs" onclick="switchActiveTrackDirection('II')">⬅️ II путь (Чинор ➔ БИЙ)</button>
          <button type="button" class="btn ${curTrack === 'I' ? 'btn-primary' : 'btn-soft'} btn-xs" onclick="switchActiveTrackDirection('I')">➡️ I путь (БИЙ ➔ Чинор)</button>
          <button type="button" class="btn ${curTrack === 'I и II' ? 'btn-primary' : 'btn-soft'} btn-xs" onclick="setFullChilonzorLine('I и II')">🛤 Вся линия: Чинор — БИЙ</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:800">
        <span>📍 Участок (от станции ➔ до станции):</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <select id="rng-a" class="inp" style="width:auto;padding:4px 8px;font-size:12px" onchange="selectStationRange(+this.value, +$('rng-b').value)">${optsA}</select>
          <span>➔</span>
          <select id="rng-b" class="inp" style="width:auto;padding:4px 8px;font-size:12px" onchange="selectStationRange(+$('rng-a').value, +this.value)">${optsB}</select>
          ${!metaTpl.noSt ? `<button type="button" class="btn btn-warning btn-xs" onclick="activeDraft.stations=STN.map(s=>s.code);renderStampModal()">Всем станциям</button>` : ""}
        </div>
      </div>
      ${chips}
    </div>`;
  } else {
    stPicker = `<div class="st-picker-bar" style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12.5px;font-weight:800">🕒 Время выдачи приказа о смене ДЦХ:</span>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="time" class="inp" style="width:110px;padding:4px 8px;font-size:13px;text-align:center" value="${esc(f["b-time"])}" oninput="setDF('b-time',this.value)">
        <button type="button" class="btn btn-soft btn-xs" onclick="setDF('b-time',nowHM(),true)">⏱ Сейчас</button>
      </div>
    </div>`;
  }

  $("sm-body").innerHTML = `
    ${cancelPickerHTML}
    ${stPicker}
    <div style="background:#fff;padding:16px;border:1px solid #cbd5e1;border-radius:10px;display:flex;flex-direction:column;align-items:center">
      <div style="width:100%;max-width:640px">
        <div style="font-size:11px;font-weight:800;color:#475569;margin-bottom:6px;display:flex;justify-content:space-between">
          <span>ПРЕДПРОСМОТР И ЗАПОЛНЕНИЕ ШТАМПА 1:1:</span>
          <span style="color:#2563eb">Нажмите на слово в скобках, чтобы зачеркнуть</span>
        </div>
        ${buildStampHTML(d, true)}
      </div>
    </div>
  `;
}

/* ===== СОХРАНЕНИЕ И ВЫДАЧА ПРИКАЗА ===== */
function buildOrderFromActiveDraft(asDraft) {
  const d = activeDraft, f = d.f;
  const metaTpl = TPL_MAP[d.cat] || STAMP_TEMPLATES[0];

  return {
    id: d.editId || Date.now(),
    cat: d.cat,
    fromIdx: d.fromIdx ?? 16,
    toIdx: d.toIdx ?? 0,
    draft: asDraft,
    noSt: !!metaTpl.noSt,
    noObr: !!metaTpl.noObr,
    num: asDraft ? null : S.meta.next,
    at: atNear(f["b-time"] || nowHM()),
    subTitle: `${metaTpl.num} ${metaTpl.title}`,
    stations: metaTpl.noSt ? [] : d.cat === "SHIFT_HANDOVER" ? STN.map(s => s.code) : d.stations,
    acks: {},
    dch: dutyOf(),
    by: me.uid,
    paper: false,
    created: Date.now(),
    f: clone(f)
  };
}

function saveLiveDraft() {
  if (!activeDraft) return;
  const o = buildOrderFromActiveDraft(true);
  W("orders/" + o.id, o);
  log(`Сохранена заготовка (${o.subTitle})`);
  closeLiveStamp();
  toast("📁 Заготовка сохранена");
  render();
}

async function publishLiveStamp() {
  if (!activeDraft || PB) return;
  const o = buildOrderFromActiveDraft(false);
  const metaTpl = TPL_MAP[o.cat] || STAMP_TEMPLATES[0];
  const fl = floorTs(activeDraft.editId);

  if (!o.noSt && !o.stations.length) {
    toast("⚠️ Выберите хотя бы одну станцию");
    return;
  }
  if (fl && o.at < fl) {
    toast(`⚠️ Ошибка хронологии: время выдачи (${hm(o.at)}) раньше утверждения предыдущего приказа (${hm(fl)})`);
    beep(300, 0.35);
    return;
  }

  const execPublish = async () => {
    PB = true;
    try {
      o.num = await claimNum();
      const meta = {};
      if (o.cat === "SHIFT_HANDOVER") {
        meta.activeDch = o.f["sh-accepted"] || S.meta.activeDch;
        meta.prevDch = o.f["sh-handed"] || S.meta.prevDch;
      }
      W("orders/" + o.id, o);
      if (Object.keys(meta).length) W("meta", meta, true);
      log(`Выдан приказ № ${o.num} в ${hm(o.at)} (${o.subTitle})`);
      closeLiveStamp();
      beep(880, 0.35);
      toast(`🚀 Приказ № ${o.num} внесён в журнал ДУ-58`);
      render();
      setTimeout(() => scrollToBottom(true), 100);
    } finally {
      PB = false;
    }
  };

  if (metaTpl.danger) {
    confirmDanger(
      `⚠️ Подтверждение ответственного приказа (${metaTpl.num})`,
      `Вы выдаёте «${metaTpl.title}». Проверьте правильность пути, участка и времени перед записью в книгу ДУ-58.`,
      execPublish
    );
  } else {
    execPublish();
  }
}

/* ===== ОТРИСОВКА КНИГИ ДУ-58 (80% ЭКРАНА — ЧИСТЫЙ БУМАЖНЫЙ ВИД 1:1) ===== */
function render() {
  if (!me) return;
  const r = me.role, m = S.meta;
  const nextDisp = (m.month && m.month !== curYearMonth()) ? 1 : (m.next || 1);

  $("user-name").textContent = r === "station" ? `${me.name} (${SN[me.code]})` : me.name;
  const pl = $("role-pill");
  pl.textContent = { founder: "ОСНОВАТЕЛЬ", chief: "СТАРШИЙ ДЦХ", dch: "ДЦХ" }[r] || SN[me.code];
  pl.className = "pill " + ({ founder: "p-founder", chief: "p-chief", station: "p-station" }[r] || "");
  $("top-shift-info").textContent = shiftText();

  $("sb-dch").innerHTML = `ДЦХ: <b>${esc(m.activeDch)}</b>`;
  $("sb-next").innerHTML = `След: <b>№ ${esc(nextDisp)}</b>`;

  const draftList = Object.values(S.orders).filter(o => o.draft && (r === "founder" || r === "chief" || o.by === me.uid));
  $("drafts-cnt").textContent = draftList.length;

  show("sb-btn-logs", r === "chief" || r === "founder");
  show("sb-btn-admin", r === "founder");
  show("sidebar-panel", r !== "station");

  renderJournal();
}

function renderJournal() {
  if (!me) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest("#du58-tbody") && (a.tagName === "INPUT" || a.tagName === "SELECT")) {
    return;
  }

  const tbody = $("du58-tbody");
  const flt = $("feed-filter").value;
  const q = ($("feed-q").value || "").trim().toLowerCase();
  const isSt = me.role === "station";

  let list = pubsChrono();
  if (isSt) {
    list = list.filter(o => !o.noSt && o.stations.includes(me.code));
  } else {
    if (flt === "unapproved") list = list.filter(o => !o.utvAt && !o.canceled);
    if (flt === "uncopied") list = list.filter(o => !o.paper && !o.canceled);
  }
  if (q) {
    list = list.filter(o => `${o.num} ${dmy(o.at)} ${o.subTitle} ${o.dch} ${JSON.stringify(o.f)}`.toLowerCase().includes(q));
  }

  let html = "";
  list.forEach(o => {
    const canCtrl = !o.canceled && (me.role === "founder" || me.role === "chief" || (me.role === "dch" && !o.utvAt));

    /* Колонка 4: Станция и время обратной контрольной передачи */
    let colObr = "";
    if (o.noObr) {
      colObr = "";
    } else if (o.obr) {
      colObr = `<div class="pen" style="text-align:center;padding-top:4px;line-height:22px">
        <div style="font-size:13px">${esc(SN[o.obrSt] || "")}</div>
        ${penTimeHTML(hm(o.obr))}
      </div>`;
    } else if (canCtrl) {
      const stOpts = o.stations.map(c => `<option value="${c}" ${o.obrSt === c ? "selected" : ""}>${esc(SN[c])}</option>`).join("");
      const defObr = hm(o.at + 60000);
      colObr = `<div class="no-print" style="padding:3px" onclick="event.stopPropagation()">
        <select id="os-${o.id}" class="inp" style="padding:2px 4px;font-size:11px;margin-bottom:3px">${stOpts}</select>
        <input type="time" id="ot-${o.id}" class="inp" style="padding:2px 4px;font-size:11.5px;text-align:center" value="${defObr}" oninput="syncUtvTime(${o.id})">
      </div>`;
    }

    /* Колонка 5: Время утверждения */
    let colUtvT = "";
    if (o.utvAt) {
      colUtvT = `<div class="pen" style="text-align:center;padding-top:6px">${penTimeHTML(hm(o.utvAt))}</div>`;
    } else if (canCtrl) {
      const defUtv = hm(o.at + (o.noObr ? 60000 : 120000));
      colUtvT = `<div class="no-print" style="padding:3px" onclick="event.stopPropagation()">
        <input type="time" id="ut-${o.id}" class="inp" style="padding:2px 4px;font-size:11.5px;margin-bottom:3px;text-align:center" value="${defUtv}">
        <button type="button" class="btn btn-success btn-xs" style="width:100%;padding:3px" onclick="${o.noObr ? `apprNo(${o.id})` : `apprObr(${o.id})`}">✓ Утв.</button>
      </div>`;
    }

    /* Колонка 6: Фамилия диспетчера */
    const colUtvD = `<div class="pen" style="text-align:center;padding-top:6px;font-size:14px">${esc(o.dch || "")}</div>`;

    /* Колонка 7: Фамилия лиц, принявших приказ (только подтвердившие по порядку станций; до этого пустая клетка) */
    let colAcks = "";
    if (!o.noSt) {
      const orderedStations = STN.map(s => s.code).filter(c => (o.stations || []).includes(c));
      const ackLines = orderedStations
        .filter(c => o.acks && o.acks[c] && o.acks[c].by)
        .map(c => {
          const ack = o.acks[c];
          return `<div class="pen" style="font-size:13.5px;line-height:24px;padding:0 4px" title="${esc(SN[c])} (${hm(ack.t)})">${esc(ack.by)}</div>`;
        }).join("");

      const stBtn = (isSt && !o.canceled && !(o.acks && o.acks[me.code]))
        ? `<div class="no-print" style="padding:3px" onclick="event.stopPropagation()"><button type="button" class="btn btn-success btn-xs" style="width:100%" onclick="stConfirm(${o.id})">✅ Принял</button></div>`
        : "";
      colAcks = (ackLines || stBtn) ? `<div style="padding:2px 3px">${ackLines}${stBtn}</div>` : "";
    }

    html += `<tr class="du58-row ${o.canceled ? 'cx-mark' : ''} ${!o.utvAt && !o.canceled ? 'unapproved-row' : ''}" id="row-${o.id}" onclick="openOrderActions(${o.id}, event)" title="Нажмите на запись для просмотра статуса ДСП и действий">
      <td style="padding:5px 3px">
        <span class="pen pen-date">${dmy(o.at)}</span>
        <div class="pen">${penTimeHTML(hm(o.at))}</div>
      </td>
      <td style="padding:5px 3px">
        <span class="pen-num">${esc(o.num)}</span>
      </td>
      <td class="stamp-cell">
        ${buildStampHTML(o, false)}
        ${o.canceled ? `<div style="color:#991b1b;font-weight:800;font-size:11.5px;margin-top:3px">⛔ ОТМЕНЁН: ${esc(o.cancel?.reason || "")} (${esc(o.cancel?.by || "")})</div>` : ""}
      </td>
      <td>${colObr}</td>
      <td>${colUtvT}</td>
      <td>${colUtvD}</td>
      <td>${colAcks}</td>
    </tr>`;
  });

  if (!html) {
    html = `<tr><td colspan="7" style="padding:32px;text-align:center;color:#64748b;font-weight:700">
      Книга ДУ-58 пуста. Нажмите на нужный шаблон штампа в левой панели (20%), чтобы выдать приказ.
    </td></tr>`;
  }

  tbody.innerHTML = html;
}

/* ===== МОДАЛЬНОЕ ОКНО ДЕЙСТВИЙ ПО ПРИКАЗУ (ПО КЛИКУ НА ШТАМП В ЖУРНАЛЕ) ===== */
function openOrderActions(id, ev) {
  if (ev && (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT" || ev.target.tagName === "BUTTON")) return;
  const o = S.orders[id];
  if (!o) return;
  selectedOrderId = id;

  const isSt = me.role === "station";
  const isFounder = me.role === "founder";
  const canCtrl = !o.canceled && (me.role === "founder" || me.role === "chief" || (me.role === "dch" && !o.utvAt));

  $("oa-title").textContent = `Приказ № ${o.num} от ${dmy(o.at)} (${hm(o.at)}) — ${o.subTitle || o.cat}`;

  let stStatusHTML = "";
  if (!o.noSt) {
    const orderedStations = STN.map(s => s.code).filter(c => (o.stations || []).includes(c));
    const okCount = orderedStations.filter(c => o.acks && o.acks[c]).length;
    stStatusHTML = `<div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:800;margin-bottom:6px;color:#1e293b">
        📍 Ознакомление дежурных по станциям (ДСП): ${okCount} из ${orderedStations.length}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:220px;overflow-y:auto;background:#f8fafc;padding:8px;border:1px solid #cbd5e1;border-radius:8px">
        ${orderedStations.map(c => {
          const ack = o.acks && o.acks[c];
          return `<div style="padding:5px 8px;border-radius:6px;font-size:12px;background:${ack ? '#dcfce7' : '#fee2e2'};color:${ack ? '#14532d' : '#7f1d1d'};font-weight:700">
            <div>${esc(SN[c])}</div>
            <div style="font-size:11px;margin-top:2px">${ack ? `✓ ${esc(ack.by)} (${hm(ack.t)})` : '⏳ Ожидание'}</div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  let btns = "";
  if (isSt && !o.canceled && !o.noSt && !(o.acks && o.acks[me.code])) {
    btns += `<button class="btn btn-success" onclick="stConfirm(${o.id});closeOrderActions()">✅ Подтвердить получение приказа</button>`;
  }
  if (!isSt) {
    btns += `<button class="btn ${o.paper ? 'btn-success' : 'btn-soft'}" onclick="togglePaper(${o.id});openOrderActions(${o.id})">
      ${o.paper ? "✓ Внесено в бумажную книгу ДУ-58" : "✍️ Отметить перенос в бумажную книгу"}
    </button>`;
    if (canCtrl) {
      btns += `<button class="btn btn-warning" onclick="closeOrderActions();cancelOrder(${o.id})">⛔ Отменить приказ</button>`;
    }
    if (isFounder) {
      btns += `<button class="btn btn-danger" onclick="closeOrderActions();delOrder(${o.id})">🗑 Удалить навсегда (Основатель)</button>`;
    }
  }

  $("oa-body").innerHTML = `
    <div style="margin-bottom:12px;padding:10px;background:#f1f5f9;border-radius:8px;font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span><b>Диспетчер (ДЦХ):</b> ${esc(o.dch)}</span>
      <span><b>Статус:</b> ${o.canceled ? '<b style="color:#dc2626">ОТМЕНЁН</b>' : o.utvAt ? `<b style="color:#16a34a">Утверждён в ${hm(o.utvAt)}</b>` : '<b style="color:#d97706">Ожидает утверждения</b>'}</span>
      ${o.obr ? `<span><b>Обратно:</b> ст. ${esc(SN[o.obrSt] || "")} в ${hm(o.obr)}</span>` : ""}
    </div>
    ${stStatusHTML}
    <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid #e2e8f0">
      ${btns}
    </div>
  `;
  show("order-act-modal", true);
}

function closeOrderActions() {
  selectedOrderId = null;
  show("order-act-modal", false);
}

/* ===== ДЕЙСТВИЯ В ЖУРНАЛЕ ===== */
function syncUtvTime(id) {
  const ot = $("ot-" + id), ut = $("ut-" + id), o = S.orders[id];
  if (ot && ut && o && ot.value) {
    ut.value = hm(atAfter(ot.value, o.at) + 60000);
  }
}

function apprNo(id) {
  const o = S.orders[id];
  if (!o) return;
  const v = $("ut-" + id)?.value;
  if (!v) return;
  const t = atAfter(v, o.at);
  W("orders/" + id, { utvAt: t }, true);
  log(`Приказ № ${o.num} утверждён в ${hm(t)}`);
  beep(1000, 0.2);
  toast(`✅ Приказ № ${o.num} утверждён`);
}

function apprObr(id) {
  const o = S.orders[id];
  if (!o) return;
  const st = $("os-" + id)?.value, a = $("ot-" + id)?.value, b = $("ut-" + id)?.value;
  if (!a || !b) { toast("⚠️ Укажите время «Обратно» и «Утверждено»"); return; }
  const ta = atAfter(a, o.at), tb = atAfter(b, ta);
  W("orders/" + id, { obrSt: st, obr: ta, utvAt: tb }, true);
  log(`Приказ № ${o.num}: «Обратно» ст. ${SN[st]} (${hm(ta)}), утверждён в ${hm(tb)}`);
  beep(1000, 0.2);
  toast(`✅ Приказ № ${o.num} утверждён (${hm(tb)})`);
}

function stConfirm(id) {
  const o = S.orders[id];
  if (!o) return;
  W(`orders/${id}/acks/${me.code}`, { by: me.name, uid: me.uid, t: Date.now() });
  log(`Станция «${SN[me.code]}» (${me.name}) подтвердила приказ № ${o.num}`);
  beep(1000, 0.2);
  toast(`✅ Приказ № ${o.num} подтверждён`);
}

function togglePaper(id) {
  const o = S.orders[id];
  if (o) W(`orders/${id}/paper`, !o.paper);
}

function cancelOrder(id) {
  const o = S.orders[id];
  if (!o || o.canceled) return;
  ask(`Причина отмены приказа № ${o.num}:`, "", r => {
    if (!r || r.length < 3) { toast("⚠️ Укажите причину отмены"); return; }
    W(`orders/${id}/cancel`, { reason: r, by: dutyOf(), at: Date.now() });
    W(`orders/${id}/canceled`, true, true);
    log(`Отменён приказ № ${o.num}: ${r}`);
    toast(`⛔ Приказ № ${o.num} отменён`);
  });
}

function delOrder(id) {
  const o = S.orders[id];
  if (!o) return;
  if (!o.draft && (!me || me.role !== "founder")) {
    toast("⛔ Удалять выданные приказы может только Основатель");
    return;
  }
  confirmDanger(
    o.draft ? "Удаление заготовки" : `Удаление приказа № ${o.num} (Основателем)`,
    o.draft ? "Заготовка будет удалена безвозвратно." : `Основатель полностью удаляет приказ № ${o.num} из базы ДУ-58. Действие необратимо.`,
    () => {
      W("orders/" + id, null);
      log(`Удалена запись: ${o.draft ? "заготовка" : "приказ № " + o.num + " (Основателем)"}`);
      toast("🗑 Запись полностью удалена");
    }
  );
}

/* ===== ДОПОЛНИТЕЛЬНЫЕ ОКНА (ЗАГОТОВКИ, ОТЧЁТЫ, ЛОГИ, АДМИН) ===== */
function closeOverlay() { show("overlay-modal", false); }

function openOverlay(type) {
  const title = $("ov-title"), box = $("ov-content");
  show("overlay-modal", true);

  if (type === "drafts") {
    title.textContent = "📁 Сохранённые заготовки приказов";
    const ds = Object.values(S.orders).filter(o => o.draft && (me.role === "founder" || me.role === "chief" || o.by === me.uid));
    box.innerHTML = ds.length ? ds.map(d => `<div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin-bottom:10px">
      ${buildStampHTML(d, false)}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-danger btn-xs" onclick="W('orders/${d.id}',null);openOverlay('drafts')">🗑 Удалить</button>
        <button class="btn btn-primary btn-xs" onclick="closeOverlay();openStampInJournal('${d.cat}', S.orders['${d.id}'])">✏️ Открыть и выдать</button>
      </div>
    </div>`).join("") : `<div style="padding:20px;text-align:center;color:#64748b;font-weight:700">Заготовок пока нет.</div>`;
  }

  else if (type === "reports") {
    title.textContent = "📊 Экспорт и статистика журнала ДУ-58";
    const all = pubsChrono();
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>Всего выданных приказов в журнале: <b>${all.length}</b></div>
      <button class="btn btn-primary btn-xs" onclick="exportCSV()">📥 Скачать архив ДУ-58 (CSV)</button>
    </div>
    <div style="max-height:380px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f1f5f9"><th style="padding:8px">№</th><th>Дата и время</th><th>Вид штампа</th><th>ДЦХ</th><th>Утв.</th></tr></thead>
        <tbody>${all.slice().reverse().map(o => `<tr style="border-bottom:1px solid #e2e8f0">
          <td style="padding:6px;font-weight:800">${esc(o.num)}</td>
          <td>${dmy(o.at)} ${hm(o.at)}</td>
          <td>${esc(o.subTitle || o.cat)}</td>
          <td>${esc(o.dch)}</td>
          <td>${o.utvAt ? hm(o.utvAt) : "—"}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
  }

  else if (type === "logs") {
    title.textContent = "📜 Системные логи действий";
    const rows = Object.values(S.logs).sort((a, b) => b.t - a.t).slice(0, 150);
    box.innerHTML = `<div style="max-height:420px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="background:#f1f5f9"><th style="padding:6px">Время</th><th>Сотрудник</th><th>Действие</th></tr></thead>
        <tbody>${rows.map(l => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:5px;white-space:nowrap">${dmy(l.t)} ${hm(l.t)}</td><td><b>${esc(l.who)}</b></td><td>${esc(l.act)}</td></tr>`).join("")}</tbody>
      </table>
    </div>`;
  }

  else if (type === "admin") {
    title.textContent = "🛠 Панель основателя (Управление аккаунтами и нумерацией)";
    const stOpts = STN.map(s => `<option value="${s.code}">${esc(s.full)}</option>`).join("");
    const rl = { station: "Станция", dch: "ДЦХ", chief: "Старший ДЦХ", founder: "Основатель" };
    const accRows = Object.entries(S.users || {}).map(([uid, u]) => `<tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:6px"><b>${esc(u.name)}</b><br><small style="color:#64748b">${esc(u.email)}</small></td>
      <td>${esc(rl[u.role] || u.role)}</td>
      <td>${esc(SN[u.code] || "—")}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-soft btn-xs" onclick="admToggle('${esc(uid)}')">${u.active === false ? "Включить" : "Отключить"}</button>
        <button class="btn btn-soft btn-xs" onclick="admReset('${esc(uid)}')">✉ Сброс пароля</button>
      </td>
    </tr>`).join("");

    box.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label style="font-size:12px;font-weight:800">Следующий номер приказа №:</label>
        <div style="display:flex;gap:6px;margin-top:4px">
          <input id="adm-next-inp" type="number" class="inp" value="${S.meta.next}">
          <button class="btn btn-primary" onclick="const n=+$('adm-next-inp').value;if(n>0){W('meta',{next:n,month:curYearMonth()},true);toast('✅ Номер обновлён')}">Задать</button>
        </div>
      </div>
      <div>
        <label style="font-size:12px;font-weight:800">Действующий ДЦХ на смене:</label>
        <div style="display:flex;gap:6px;margin-top:4px">
          <input id="adm-dch-inp" class="inp" value="${esc(S.meta.activeDch)}">
          <button class="btn btn-primary" onclick="W('meta',{activeDch:$('adm-dch-inp').value.trim()},true);toast('✅ ДЦХ обновлён')">Сохранить</button>
        </div>
      </div>
    </div>
    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin-bottom:14px">
      <h4 style="margin-bottom:10px;color:#1e3a8a">👤 Создать аккаунт сотрудника</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">
        <input id="na-email" class="inp" type="email" placeholder="Почта (email)">
        <input id="na-pass" class="inp" placeholder="Пароль (от 6 симв.)">
        <input id="na-name" class="inp" placeholder="Фамилия И.">
        <select id="na-role" class="inp" onchange="show('na-st-wrap',this.value==='station')">
          <option value="station">Станция (ДСП)</option>
          <option value="dch">ДЦХ</option>
          <option value="chief">Старший ДЦХ</option>
          <option value="founder">Основатель</option>
        </select>
      </div>
      <div id="na-st-wrap" style="margin-bottom:8px">
        <select id="na-st" class="inp">${stOpts}</select>
      </div>
      <button class="btn btn-purple btn-xs" onclick="admCreate()">➕ Создать аккаунт</button>
    </div>
    <div style="max-height:240px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Сотрудник</th><th>Роль</th><th>Станция</th><th>Действия</th></tr></thead>
        <tbody>${accRows}</tbody>
      </table>
    </div>`;
  }
}

async function admCreate() {
  const em = $("na-email").value.trim(), pw = $("na-pass").value, nm = $("na-name").value.trim(), role = $("na-role").value, code = $("na-st").value;
  if (!em || pw.length < 6 || !nm) { toast("⚠️ Заполните почту, пароль (от 6 симв.) и фамилию"); return; }
  try {
    const j = await authCall("signUp", { email: em, password: pw, returnSecureToken: false });
    const prof = { role, name: nm, email: em, active: true };
    if (role === "station") prof.code = code;
    W("users/" + j.localId, prof);
    log(`Создан аккаунт: ${nm} (${role})`);
    toast("✅ Аккаунт создан");
    openOverlay("admin");
  } catch (e) { toast("⚠️ Ошибка: " + e.message); }
}

function admToggle(uid) {
  const u = S.users[uid];
  if (!u || uid === me.uid) return;
  W(`users/${uid}/active`, u.active === false);
  openOverlay("admin");
}

async function admReset(uid) {
  const u = S.users[uid];
  if (!u) return;
  try {
    await authCall("sendOobCode", { requestType: "PASSWORD_RESET", email: u.email });
    toast("✉️ Письмо отправлено: " + u.email);
  } catch (e) { toast("⚠️ " + e.message); }
}

function exportCSV() {
  const q = v => `"${String(v ?? "-").replace(/"/g, '""')}"`;
  let csv = "\uFEFF№ приказа;Дата;Время выдачи;Обратно станция;Обратно время;Утверждено;ДЦХ;Штамп;Станции\n";
  pubsChrono().forEach(o => {
    csv += [
      o.num,
      dmy(o.at),
      hm(o.at),
      SN[o.obrSt] || "-",
      o.obr ? hm(o.obr) : "-",
      o.utvAt ? hm(o.utvAt) : "-",
      o.dch,
      o.subTitle || o.cat,
      (o.stations || []).map(c => SN[c]).join(", ")
    ].map(q).join(";") + "\n";
  });
  const fileName = `DU58_Chilanzar_${new Date().toISOString().slice(0, 10)}.csv`;
  if (window.AndroidBridge && window.AndroidBridge.saveCsv) {
    window.AndroidBridge.saveCsv(fileName, csv);
    toast("📥 Сохранено в Загрузки: " + fileName);
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = fileName;
    a.click();
  }
}

function checkGitHubOta() {
  if (window.AndroidBridge && window.AndroidBridge.checkUpdates) {
    toast("🔄 Проверка обновлений из GitHub...");
    window.AndroidBridge.checkUpdates();
  } else {
    location.reload();
  }
}

window.print = function() {
  if (window.AndroidBridge && window.AndroidBridge.printPage) {
    window.AndroidBridge.printPage("DU58_Chilanzar");
  } else {
    window.printNative && window.printNative();
  }
};

/* ===== АВТОСТАРТ СЕССИИ ===== */
net(true);
renderSidebarTemplates();
(async () => {
  try {
    const sv = JSON.parse(localStorage.getItem(AK) || "null");
    const pf = JSON.parse(localStorage.getItem(LSP) || "null");
    if (!sv || !pf) return;
    TOK = { ref: sv.ref, uid: pf.uid, exp: 0 };
    try { await refresh(); } catch (e) { if (e.auth) return; }
    enter(mk(pf), false);
  } catch (e) {}
})();

window.addEventListener("load", () => {
  if (me) setTimeout(() => scrollToBottom(false), 150);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && me && !activeDraft) {
    setTimeout(() => scrollToBottom(false), 120);
  }
});
