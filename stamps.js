/* ==========================================================================
   stamps.js — Умная логика 20 штампов ДУ-58 (Чиланзарская линия: Чинор ⟷ БИЙ)
   Каждый штамп настроен по смыслу ПТЭ и ИДП Метрополитена без лишних полей
   ========================================================================== */

function getAllDchNames() {
  const fromUsers = Object.values(S.users || {})
    .filter(u => u && (u.role === "dch" || u.role === "chief" || u.role === "founder") && u.name)
    .map(u => u.name);
  const cur = dutyOf();
  const active = S.meta && S.meta.activeDch;
  const prev = S.meta && S.meta.prevDch;
  return [...new Set([cur, active, prev, ...fromUsers, ...PRESETS.dchList].filter(Boolean))];
}

/* Автоматическое определение зачёркивания "перегона / (участка)" по числу перегонов:
   - Если между станциями ровно 1 перегон (|iA - iB| === 1) -> оставляем "перегона", зачёркиваем "(участка)" -> "uchastok"
   - Если между станциями 2 и более перегонов (|iA - iB| > 1) -> зачёркиваем "перегона", оставляем "(участка)" -> "peregon" */
function calcPerStrike(iA, iB) {
  return Math.abs((iA ?? 16) - (iB ?? 11)) === 1 ? "uchastok" : "peregon";
}

function getDirectionalSection(iA, iB, track) {
  const a = Math.max(0, Math.min(16, iA));
  const b = Math.max(0, Math.min(16, iB));
  const hi = Math.max(a, b); // Ближе к ст. Чинор (16)
  const lo = Math.min(a, b); // Ближе к ст. Буюк Ипак Йули (0)
  if (hi === lo) {
    const stName = STN[hi].full;
    return {
      startIdx: hi,
      endIdx: lo,
      startSt: stName,
      endSt: stName,
      section: stName,
      fromBound: `торца платформы ст. ${stName}`,
      toBound: `торца платформы ст. ${stName}`,
      perStrike: "peregon"
    };
  }
  /* I главный путь: Буюк Ипак Йули (lo) ➔ Чинор (hi)
     II главный путь (и общий участок I и II): Чинор (hi) ➔ Буюк Ипак Йули (lo) */
  const isTrackI = (track === "I" || track === "I главный" || track === "I главном");
  const startIdx = isTrackI ? lo : hi;
  const endIdx = isTrackI ? hi : lo;
  const startSt = STN[startIdx].full;
  const endSt = STN[endIdx].full;
  return {
    startIdx,
    endIdx,
    startSt,
    endSt,
    section: `${startSt} — ${endSt}`,
    fromBound: `торца платформы ст. ${startSt}`,
    toBound: `торца платформы ст. ${endSt}`,
    perStrike: calcPerStrike(startIdx, endIdx)
  };
}

function getSectionPresetsForTrack(track) {
  const isI = (track === "I" || track === "I главный" || track === "I главном");
  const base = isI ? [
    "Буюк Ипак Йули — Чинор",
    "Буюк Ипак Йули — Пахтакор",
    "Пахтакор — Олмазор",
    "Олмазор — Чинор",
    "Буюк Ипак Йули — Амир Темур Хиёбони",
    "Амир Темур Хиёбони — Пахтакор",
    "Пахтакор — Чиланзар",
    "Чиланзар — Олмазор",
    "Олмазор — Сергели",
    "Сергели — Чинор",
    "Чинор — Буюк Ипак Йули"
  ] : [
    "Чинор — Буюк Ипак Йули",
    "Чинор — Олмазор",
    "Олмазор — Пахтакор",
    "Пахтакор — Буюк Ипак Йули",
    "Чинор — Сергели",
    "Сергели — Олмазор",
    "Олмазор — Чиланзар",
    "Чиланзар — Пахтакор",
    "Пахтакор — Амир Темур Хиёбони",
    "Амир Темур Хиёбони — Буюк Ипак Йули",
    "Буюк Ипак Йули — Чинор"
  ];
  const peregons = (isI ? PER_I : PER_II).map(p => p.name);
  return [...new Set([...base, ...peregons])];
}

function getBoundaryPresets() {
  const bounds = [];
  const order = [16, 0, 11, 10, 5, 3, 14, 15, 13, 12, 9, 8, 7, 6, 4, 2, 1];
  order.forEach(idx => {
    const s = STN[idx];
    if (s) bounds.push(`торца платформы ст. ${s.full}`);
  });
  bounds.push(
    "светофора «В»",
    "светофора «Д»",
    "светофора «Е»",
    "тупикового упора ст. Чинор",
    "тупикового упора ст. Буюк Ипак Йули",
    "границы станции"
  );
  return bounds;
}

function findLastOrderByCats(cats) {
  const all = pubsChrono().filter(o => !o.canceled && cats.includes(o.cat));
  return all.length ? all[all.length - 1] : null;
}

/* ===== СОЗДАНИЕ УМНОГО ЧЕРНОВИКА ДЛЯ КАЖДОГО ИЗ 20 ШТАМПОВ ПО ЕГО СМЫСЛУ ===== */
function createDefaultDraft(catKey, editOrder = null) {
  if (editOrder) {
    return {
      editId: editOrder.id,
      cat: editOrder.cat,
      fromIdx: editOrder.fromIdx ?? 16,
      toIdx: editOrder.toIdx ?? 15,
      singleStCode: editOrder.singleStCode || "olma",
      peregonIdx: editOrder.peregonIdx ?? 0,
      customFields: {},
      stations: [...(editOrder.stations || [])],
      f: Object.assign({}, editOrder.f)
    };
  }

  const fl = floorTs(null);
  let t = nowHM();
  if (fl && atNear(t) < fl) t = hm(fl);
  const [hh, mm] = t.split(":");
  const nowD = new Date(Date.now());
  const curDay = p2(nowD.getDate());
  const curMonth = p2(nowD.getMonth() + 1);
  const curYear = String(nowD.getFullYear()).slice(-2);

  const metaTpl = TPL_MAP[catKey] || STAMP_TEMPLATES[0];
  const dchNames = getAllDchNames();
  const acceptedDch = dutyOf() || S.meta.activeDch || "Икрамов Д.";
  /* Сдающий смену ДЦХ никогда не должен совпадать с принимающим */
  let handedDch = (S.meta.activeDch && S.meta.activeDch !== acceptedDch)
    ? S.meta.activeDch
    : (S.meta.prevDch && S.meta.prevDch !== acceptedDch)
      ? S.meta.prevDch
      : (dchNames.find(n => n !== acceptedDch) || "Анишченко");

  /* Начальные индексы станций по смыслу каждого штампа */
  let defFromIdx = 16; // Чинор
  let defToIdx = 15;   // Янгихаёт (1 перегон по II пути: Чинор — Янгихаёт)
  let singleStCode = "olma"; // Олмазор (станция с путевым развитием)
  let defStations = [];

  if (catKey === "SHIFT_HANDOVER" || catKey === "STAMP_3") {
    defFromIdx = 16; defToIdx = 0;
    defStations = STN.map(s => s.code);
  } else if (metaTpl.noSt) {
    defFromIdx = 16; defToIdx = 0;
    defStations = [];
  } else if (metaTpl.uiMode === "single_st") {
    singleStCode = "olma";
    defFromIdx = 11; defToIdx = 11;
    defStations = catKey === "STAMP_27" ? ["olma", "depo"] : ["olma"];
  } else if (metaTpl.uiMode === "peregon") {
    defFromIdx = 16; defToIdx = 15; // Перегон Чинор — Янгихаёт
    defStations = ["chin", "yang"];
  } else if (catKey === "STAMP_26") {
    /* Хоз. поезд в неправильном направлении по II пути: от Олмазор (11) к Чинор (16) */
    defFromIdx = 11; defToIdx = 16;
    defStations = ["olma", "chosh", "uzg", "serg", "yang", "chin"];
  } else {
    /* Закрытие участка/перегона, двухстороннее движение, предупреждения: Чинор (16) — Олмазор (11) */
    defFromIdx = 16; defToIdx = 11;
    for (let i = 16; i >= 11; i--) defStations.push(STN[i].code);
  }

  const dirInfo = getDirectionalSection(defFromIdx, defToIdx, "II");
  const fullLineSec = "Чинор — Буюк Ипак Йули по I и II гл. пути";

  /* Умная связь с предыдущими приказами в книге ДУ-58 */
  const lastS1 = findLastOrderByCats(["STAMP_1"]);
  const lastS2 = findLastOrderByCats(["STAMP_2", "STAMP_1"]);
  const lastVsp = findLastOrderByCats(["STAMP_12", "STAMP_15", "STAMP_18", "STAMP_14", "STAMP_21"]);
  const lastClosure = findLastOrderByCats(["STAMP_18", "STAMP_14", "STAMP_21", "STAMP_12", "STAMP_15"]);

  const targetCancel = catKey === "STAMP_13" ? (lastVsp || lastClosure) : (lastClosure || lastVsp);
  const cancelNum = targetCancel ? String(targetCancel.num) : String(Math.max(1, (S.meta.next || 1) - 1));
  const cancelDate = targetCancel ? new Date(targetCancel.at) : nowD;
  const cancelDay = p2(cancelDate.getDate());
  const cancelMonth = p2(cancelDate.getMonth() + 1);
  const cancelYear = String(cancelDate.getFullYear()).slice(-2);
  const cancelTrack = (targetCancel && targetCancel.f && targetCancel.f["c-track"]) || "II";
  const cancelSec = (targetCancel && targetCancel.f && targetCancel.f["c-section"]) || dirInfo.section;
  const cancelFrom = (targetCancel && targetCancel.f && targetCancel.f["c-from"]) || dirInfo.fromBound;
  const cancelTo = (targetCancel && targetCancel.f && targetCancel.f["c-to"]) || dirInfo.toBound;
  const cancelPerStrike = (targetCancel && targetCancel.f && targetCancel.f["c-per-strike"]) || dirInfo.perStrike;

  if (["STAMP_13", "STAMP_19"].includes(catKey) && targetCancel && targetCancel.stations && targetCancel.stations.length) {
    defStations = [...targetCancel.stations];
  }

  const vUchastok = (lastS1 && lastS1.f && lastS1.f["v-uchastok"]) || fullLineSec;
  const vKrome = (lastS1 && lastS1.f && lastS1.f["v-krome"]) || "путей электродепо «Чиланзар»";
  const vEchNum = lastS1 ? String(lastS1.num) : "1";
  const vSnyatoH = (lastS2 && lastS2.f && (lastS2.f["v-zr-h"] || lastS2.f["v-snyato-h"])) || hh;
  const vSnyatoM = (lastS2 && lastS2.f && (lastS2.f["v-zr-m"] || lastS2.f["v-snyato-m"])) || mm;

  return {
    editId: null,
    cat: catKey,
    fromIdx: defFromIdx,
    toIdx: defToIdx,
    singleStCode,
    peregonIdx: 0,
    customFields: {},
    stations: defStations,
    f: {
      "b-time": t,
      /* ДЦХ: Приём и сдача дежурства */
      "sh-accepted": acceptedDch,
      "sh-handed": handedDch,

      /* №1, №2, №3, №4, №28 (Энергодиспетчер / Напряжение / ПД) */
      "v-uchastok": vUchastok,
      "v-krome": vKrome,
      "v-depo": "«Чиланзар»",
      "v-pds": "2",
      "v-snyato-h": vSnyatoH,
      "v-snyato-m": vSnyatoM,
      "v-podano-h": "04",
      "v-podano-m": "30",
      "v-ech-num": vEchNum,
      "v-uved-num": "1",
      "v-zr-h": hh,
      "v-zr-m": mm,
      "v-825-h": hh,
      "v-825-m": mm,
      "v-ech-name": (lastS2 && lastS2.f && lastS2.f["v-ech-name"]) || "Касимов",
      "v-zakorotki": "1, 2, 3",
      "v-zak-mode": "ne_prim", /* По умолчанию зачёркнуто "не применялись", активно "сняты," */
      "v-zk-uch": "I и II",
      "v-zk-num": "5",
      "v-pd-name": "Рахим ака",

      /* №10 (Запрещающий светофор на конкретной станции) */
      "s10-train": "41",
      "s10-mode": "otpr",      /* Зачёркнуто "(отправиться со станции)", активно "на станцию" */
      "s10-st": SN[singleStCode],
      "s10-in-num": "В",
      "s10-out-num": "—",
      "s10-als-mode": "next",  /* Зачёркнуто "(до следующего светофора)", активно "АЛС" */
      "s10-na-s": "s",         /* Зачёркнуто "(с)", активно "на" */
      "s10-put": "II главный",
      "s10-per-mode": "per",   /* Зачёркнуто "(перегона)", активно "станции" */
      "s10-dest": SN[singleStCode],

      /* №11 (Выдача предупреждений) */
      "s11-works": "проверка габарита и состояния пути",
      "s11-put": "II",
      "s11-place-mode": "st",  /* Зачёркнуто "станции", активно "(перегона, участка)" */
      "s11-place": dirInfo.section,
      "s11-speed": "35",
      "s11-st1": dirInfo.startSt,
      "s11-tr1": "всех чётных маршрутов",
      "s11-st2": "—",
      "s11-tr2": "—",

      /* №12, №13, №14, №15, №16, №17, №18, №19, №21 */
      "c-copy": "обходчика пути",
      "c-train": catKey === "STAMP_13" ? "всех" : "41",
      "c-route": "12",
      "c-ruk": "дорожному мастеру ПД",
      "c-zayavka": catKey === "STAMP_21" ? "записи в журнале ДУ-58" : "машиниста поезда",
      "c-osnov": catKey === "STAMP_21" ? "осмотра и текущего ремонта пути" : "неисправности подвижного состава",
      "c-h": hh,
      "c-m": mm,
      "c-day": curDay,
      "c-month": curMonth,
      "c-year": curYear,
      "c-cancel-num": cancelNum,
      "c-cancel-day": cancelDay,
      "c-cancel-month": cancelMonth,
      "c-cancel-year": cancelYear,
      "c-track": ["STAMP_13", "STAMP_19"].includes(catKey) ? cancelTrack : "II",
      "c-per-strike": ["STAMP_13", "STAMP_19"].includes(catKey) ? cancelPerStrike : dirInfo.perStrike,
      "c-section": ["STAMP_13", "STAMP_19"].includes(catKey) ? cancelSec : dirInfo.section,
      "c-from": ["STAMP_13", "STAMP_19"].includes(catKey) ? cancelFrom : dirInfo.fromBound,
      "c-to": ["STAMP_13", "STAMP_19"].includes(catKey) ? cancelTo : dirInfo.toBound,
      "c-krome-strike": "",
      "c-krome-num": "41",
      "c-2way-strike": "",
      "c-2way-sec": dirInfo.section,
      "c-entry-strike": "1",   /* По умолчанию зачёркнуто "с правом въезда на станции:" */
      "c-entry-st": "—",
      "c-dep-mode": "per",     /* По умолчанию зачёркнуто "(перегона)", активно "со станции" */
      "c-dep-name": dirInfo.endSt,
      "c-plat-st": dirInfo.startSt,
      "c-vsp-track": "II",
      "c-broken-train": "34",
      "c-broken-route": "08",
      "c-broken-place": ["STAMP_16", "STAMP_17"].includes(catKey) ? "Чинор — Янгихаёт" : dirInfo.section,
      "c-dest-st": ["STAMP_16", "STAMP_17"].includes(catKey) ? "Янгихаёт" : dirInfo.startSt,
      "c-open-cond": "по уведомлению руководителя работ",

      /* №20 (Маневровое передвижение при запрещающем светофоре) */
      "s20-mode": "hoz",       /* Зачёркнуто "(хозяйственному поезду №)", активно "маневровому составу поезду №" */
      "s20-train": "41",
      "s20-hoz": "—",
      "s20-svet-mode": "pogas",/* Зачёркнуто "(погасших огнях)", активно "запрещающем показании" */
      "s20-svet-nums": "М1, М3",
      "s20-from-put": "I станционного",
      "s20-from-svet": "М1",
      "s20-to-put": "II главный",
      "s20-to-svet": "М3",

      /* №26 (Следование хоз. поезда в неправильном направлении: по II пути от Олмазор к Чинор) */
      "hoz-train": "11236",
      "hoz-tr1": "II",
      "hoz-tr2": "II",
      "hoz-dep-type": "station",
      "hoz-dep-station": "olma",
      "hoz-dep-peregon": "0",
      "hoz-dest-station": "chin",
      "hoz-lim-mode": "do",
      "hoz-lim-txt": 'светофора "В"',
      "hoz-oth-mode": "none",
      "hoz-oth-num": "11405",

      /* №27 (Выезд АВС) */
      "s27-st": SN[singleStCode],
      "s27-put": "II главном",
      "s27-mode": "per",       /* Зачёркнуто "(перегона)", активно "станции" */
      "s27-place": SN[singleStCode]
    }
  };
}

/* ===== УМНОЕ ОБНОВЛЕНИЕ ПОЛЕЙ ПО ТИПУ ШТАМПА ===== */
function applyDirectionalUpdate(trackVal) {
  if (!activeDraft) return;
  const d = activeDraft, f = d.f;
  const tr = trackVal || f["c-track"] || f["s11-put"] || "II";
  const dir = getDirectionalSection(d.fromIdx ?? 16, d.toIdx ?? 11, tr);

  d.fromIdx = dir.startIdx;
  d.toIdx = dir.endIdx;

  f["c-track"] = (tr === "I" || tr === "II" || tr === "I и II") ? tr : f["c-track"];
  f["c-vsp-track"] = (tr === "I" || tr === "II") ? tr : f["c-vsp-track"];
  f["s11-put"] = (tr === "I" || tr === "II" || tr === "I и II") ? tr : f["s11-put"];
  f["c-per-strike"] = dir.perStrike;

  f["c-section"] = dir.section;
  f["c-2way-sec"] = dir.section;
  f["c-from"] = dir.fromBound;
  f["c-to"] = dir.toBound;
  f["v-uchastok"] = `${dir.section} по ${tr === "I и II" ? "I и II" : tr} гл. пути`;

  f["s11-place"] = dir.section;
  if (tr === "II") {
    f["s11-st1"] = dir.startSt;
    f["s11-tr1"] = "всех чётных маршрутов";
    f["s11-st2"] = "—";
    f["s11-tr2"] = "—";
  } else if (tr === "I") {
    f["s11-st1"] = dir.startSt;
    f["s11-tr1"] = "всех нечётных маршрутов";
    f["s11-st2"] = "—";
    f["s11-tr2"] = "—";
  } else {
    f["s11-st1"] = STN[16].full; // Чинор
    f["s11-tr1"] = "всех чётных маршрутов";
    f["s11-st2"] = STN[0].full;  // Буюк Ипак Йули
    f["s11-tr2"] = "всех нечётных маршрутов";
  }

  /* В неправильном направлении (№12, №15): отправление с конечной станции участка обратно к начальной */
  f["c-dep-name"] = dir.endSt;
  f["c-plat-st"] = dir.startSt;
  f["c-broken-place"] = dir.section;
  f["c-dest-st"] = dir.startSt;
}

/* Умный выбор одной станции для штампов №10, №20, №27 */
function selectSingleStationForStamp(stCode, trackVal = null) {
  if (!activeDraft) return;
  const d = activeDraft, f = d.f;
  d.singleStCode = stCode;
  const stFull = SN[stCode] || STN[0].full;
  const idx = SI[stCode] ?? 11;
  d.fromIdx = idx;
  d.toIdx = idx;

  if (d.cat === "STAMP_27") {
    d.stations = stCode === "depo" ? ["depo"] : [stCode, "depo"];
    f["s27-st"] = stFull;
    if (f["s27-mode"] === "per") {
      f["s27-place"] = stFull;
    }
    if (trackVal) f["s27-put"] = trackVal;
  } else if (d.cat === "STAMP_10") {
    d.stations = [stCode];
    f["s10-st"] = stFull;
    if (f["s10-per-mode"] === "per") {
      f["s10-dest"] = stFull;
    }
    if (trackVal) f["s10-put"] = trackVal;
  } else if (d.cat === "STAMP_20") {
    d.stations = [stCode];
  }
  renderStampModal();
}

/* Умный выбор перегона для штампов №16 и №17 (Помощь поезду на перегоне) */
function selectPeregonForHelp(perIdx, trackVal = null) {
  if (!activeDraft) return;
  const d = activeDraft, f = d.f;
  const tr = trackVal || f["c-track"] || "II";
  f["c-track"] = tr;
  const list = tr === "I" ? PER_I : PER_II;
  const p = list[Math.max(0, Math.min(list.length - 1, perIdx))] || list[0];
  d.peregonIdx = perIdx;
  d.stations = [p.a, p.b];
  f["c-broken-place"] = p.name;
  /* В правильном направлении (№16) поезд после сцепления следует на впередилежащую станцию перегона (p.b) */
  f["c-dest-st"] = SN[p.b] || STN[0].full;
  renderStampModal();
}

/* Быстрое переключение режима закороток в штампе №4 */
function setZakMode(mode) {
  if (!activeDraft) return;
  const f = activeDraft.f;
  if (mode === "snyaty_active") {
    /* Закоротки сняты -> зачёркиваем "не применялись" ("ne_prim") */
    f["v-zak-mode"] = "ne_prim";
    if (!f["v-zakorotki"] || f["v-zakorotki"] === "—") f["v-zakorotki"] = "1, 2, 3";
  } else {
    /* Закоротки не применялись -> зачёркиваем "сняты," ("snyaty") и ставим прочерк */
    f["v-zak-mode"] = "snyaty";
    f["v-zakorotki"] = "—";
  }
  renderStampModal();
}

function setDF(key, val, rerender = false) {
  if (!activeDraft) return;
  const f = activeDraft.f;
  if (val === "__custom__") {
    activeDraft.customFields = activeDraft.customFields || {};
    activeDraft.customFields[key] = true;
    renderStampModal();
    return;
  }
  f[key] = val;

  /* При смене принимающего ДЦХ проверяем, чтобы сдающий ДЦХ не был тем же человеком */
  if (key === "sh-accepted" && f["sh-handed"] === val) {
    const other = getAllDchNames().find(n => n !== val);
    if (other) f["sh-handed"] = other;
    rerender = true;
  }

  /* Авто-синхронизация времени выдачи (b-time) со временем внутри штампа */
  if (key === "b-time" && val && val.includes(":")) {
    const [hh, mm] = val.split(":");
    f["c-h"] = hh; f["c-m"] = mm;
    f["v-snyato-h"] = hh; f["v-snyato-m"] = mm;
    f["v-zr-h"] = hh; f["v-zr-m"] = mm;
    f["v-825-h"] = hh; f["v-825-m"] = mm;
    rerender = true;
  }
  if ((key === "c-h" || key === "c-m") && f["c-h"] && f["c-m"]) {
    f["b-time"] = `${p2(f["c-h"])}:${p2(f["c-m"])}`;
  }

  /* Авто-синхронизация номера поезда в штампах №12, №14, №15 */
  if (key === "c-train" && val !== "всех" && val !== "—") {
    f["c-krome-num"] = val;
    rerender = true;
  }

  /* Авто-синхронизация пути (I / II / I и II) */
  if (key === "c-track" || key === "s11-put") {
    if (["STAMP_16", "STAMP_17"].includes(activeDraft.cat)) {
      selectPeregonForHelp(activeDraft.peregonIdx || 0, val);
      return;
    }
    applyDirectionalUpdate(val);
    rerender = true;
  }
  if (key === "c-vsp-track") {
    f["c-track"] = val;
    applyDirectionalUpdate(val);
    rerender = true;
  }

  /* Авто-подстройка границ при выборе участка из выпадающего списка внутри штампа */
  if (key === "c-section" && val && val.includes(" — ")) {
    const [stA, stB] = val.split(" — ").map(s => s.trim());
    const objA = STN.find(s => s.full === stA);
    const objB = STN.find(s => s.full === stB);
    if (objA && objB) {
      activeDraft.fromIdx = objA.idx;
      activeDraft.toIdx = objB.idx;
      f["c-from"] = `торца платформы ст. ${objA.full}`;
      f["c-to"] = `торца платформы ст. ${objB.full}`;
      f["c-2way-sec"] = val;
      f["c-per-strike"] = calcPerStrike(objA.idx, objB.idx);
      const st = objA.idx <= objB.idx ? 1 : -1;
      const arr = [];
      for (let i = objA.idx; i !== objB.idx + st; i += st) arr.push(STN[i].code);
      activeDraft.stations = arr;
      rerender = true;
    }
  }

  /* Штамп №26: строгая синхронизация станций и направления неправильного пути */
  if (key === "hoz-tr1") {
    f["hoz-tr2"] = val;
    const i1 = SI[f["hoz-dep-station"]] ?? 11;
    const i2 = SI[f["hoz-dest-station"]] ?? 16;
    if ((val === "II" && i1 > i2) || (val === "I" && i1 < i2)) {
      const tmp = f["hoz-dep-station"];
      f["hoz-dep-station"] = f["hoz-dest-station"];
      f["hoz-dest-station"] = tmp;
    }
    syncHozStations();
    rerender = true;
  }
  if (key === "hoz-dep-station" || key === "hoz-dest-station") {
    const i1 = SI[f["hoz-dep-station"]] ?? 11;
    const i2 = SI[f["hoz-dest-station"]] ?? 16;
    if (i1 < i2) {
      /* От БИЙ в сторону Чинор в неправильном направлении = по II главному пути */
      f["hoz-tr1"] = "II";
      f["hoz-tr2"] = "II";
    } else if (i1 > i2) {
      /* От Чинор в сторону БИЙ в неправильном направлении = по I главному пути */
      f["hoz-tr1"] = "I";
      f["hoz-tr2"] = "I";
    }
    syncHozStations();
    rerender = true;
  }

  /* Штамп №4: выбор закороток */
  if (key === "v-zakorotki") {
    f["v-zak-mode"] = (val === "—" || val === "не устанавливались") ? "snyaty" : "ne_prim";
    rerender = true;
  }

  if (rerender) renderStampModal();
}

function syncHozStations() {
  if (!activeDraft) return;
  const f = activeDraft.f;
  const i1 = SI[f["hoz-dep-station"]] ?? 11;
  const i2 = SI[f["hoz-dest-station"]] ?? 16;
  activeDraft.fromIdx = i1;
  activeDraft.toIdx = i2;
  const st = i1 <= i2 ? 1 : -1;
  const arr = [];
  for (let i = i1; i !== i2 + st; i += st) arr.push(STN[i].code);
  activeDraft.stations = arr;
}

function disableCustomField(key) {
  if (!activeDraft || !activeDraft.customFields) return;
  delete activeDraft.customFields[key];
  renderStampModal();
}

function toggleStrike(key, val) {
  if (!activeDraft) return;
  const f = activeDraft.f;
  f[key] = f[key] === val ? "" : val;
  if (key === "v-zak-mode") {
    if (f[key] === "snyaty") f["v-zakorotki"] = "—";
    else if (f["v-zakorotki"] === "—") f["v-zakorotki"] = "1, 2, 3";
  }
  if (key === "s20-mode") {
    if (f[key] === "manevr") {
      f["s20-train"] = "—";
      if (f["s20-hoz"] === "—") f["s20-hoz"] = "11236";
    } else {
      f["s20-hoz"] = "—";
      if (f["s20-train"] === "—") f["s20-train"] = "41";
    }
  }
  if (key === "c-entry-strike") {
    f["c-entry-st"] = f[key] === "1" ? "—" : STN[activeDraft.toIdx ?? 11].full;
  }
  if (key === "c-krome-strike") {
    f["c-krome-num"] = f[key] === "1" ? "—" : (f["c-train"] || "41");
  }
  renderStampModal();
}

/* Быстрый выбор отменяемого приказа для штампов №13 и №19 */
function pickCancelOrder(orderId) {
  if (!activeDraft) return;
  const target = S.orders[orderId];
  if (!target) return;
  const f = activeDraft.f;
  const dt = new Date(target.at);
  f["c-cancel-num"] = String(target.num);
  f["c-cancel-day"] = p2(dt.getDate());
  f["c-cancel-month"] = p2(dt.getMonth() + 1);
  f["c-cancel-year"] = String(dt.getFullYear()).slice(-2);
  if (target.f) {
    if (target.f["c-track"]) f["c-track"] = target.f["c-track"];
    if (target.f["c-section"]) f["c-section"] = target.f["c-section"];
    if (target.f["c-from"]) f["c-from"] = target.f["c-from"];
    if (target.f["c-to"]) f["c-to"] = target.f["c-to"];
    if (target.f["c-per-strike"]) f["c-per-strike"] = target.f["c-per-strike"];
  }
  if (target.stations && target.stations.length) {
    activeDraft.stations = [...target.stations];
  }
  renderStampModal();
}

/* ===== ОТРИСОВКА ВСЕХ 20 ШТАМПОВ 1:1 ===== */
function buildStampHTML(o, isEdit) {
  const f = o.f || {};
  const cat = o.cat;
  const stl = (o.stations || []).map(c => SN[c] || c).join(", ");
  const dchName = isEdit ? dutyOf() : (o.dch || "");

  const u = (key, w = 55, ph = "") => isEdit
    ? `<input class="stamp-inp" style="width:${w}px" value="${esc(f[key] ?? "")}" placeholder="${esc(ph)}" oninput="setDF('${key}',this.value)">`
    : `<span class="stamp-u">${esc(f[key] || "—")}</span>`;

  const combo = (key, opts, maxW = 280, rerenderOnChange = true) => {
    const val = String(f[key] ?? "");
    if (!isEdit) return `<span class="stamp-u">${esc(val || "—")}</span>`;

    const isCustom = activeDraft && activeDraft.customFields && activeDraft.customFields[key];
    if (isCustom) {
      return `<span style="display:inline-flex;align-items:center;gap:2px">
        <input class="stamp-inp" style="min-width:110px;max-width:${maxW}px" value="${esc(val)}" oninput="setDF('${key}',this.value)" placeholder="Введите текст...">
        <button type="button" class="btn btn-soft btn-xs" style="padding:1px 5px;font-size:10px" title="Вернуться к списку" onclick="disableCustomField('${key}')">▾</button>
      </span>`;
    }

    const list = [...new Set([val, ...opts].filter(Boolean))];
    return `<select class="stamp-sel" style="max-width:${maxW}px" onchange="setDF('${key}',this.value,${rerenderOnChange})">` +
      list.map(v => `<option value="${esc(v)}" ${val === String(v) ? "selected" : ""}>${esc(v)}</option>`).join("") +
      `<option value="__custom__">✏️ Вручную...</option>` +
      `</select>`;
  };

  const sel = (key, opts, rerenderOnChange = true) => {
    const val = String(f[key] ?? opts[0]);
    if (!isEdit) return `<span class="stamp-u">${esc(val)}</span>`;
    return `<select class="stamp-sel" onchange="setDF('${key}',this.value,${rerenderOnChange})">` +
      opts.map(v => `<option value="${esc(v)}" ${val === String(v) ? "selected" : ""}>${esc(v)}</option>`).join("") +
      `</select>`;
  };

  const sw = (key, strikeVal, text) => {
    const struck = f[key] === strikeVal;
    if (!isEdit) return `<span class="${struck ? 's-strike' : ''}">${text}</span>`;
    return `<span class="s-word ${struck ? 's-strike' : ''}" title="Нажмите, чтобы зачеркнуть / вернуть" onclick="toggleStrike('${key}','${strikeVal}')">${text}</span>`;
  };

  const stNamesList = [
    "Чинор", "Буюк Ипак Йули", "Олмазор", "Пахтакор", "Амир Темур Хиёбони", "Чиланзар",
    ...STN.map(s => s.full)
  ];
  const curTrack = f["c-track"] || f["s11-put"] || "II";
  const secOptions = getSectionPresetsForTrack(curTrack);
  const boundOptions = getBoundaryPresets();
  const dchOptions = getAllDchNames();

  const stHeader = `<div class="stamp-line" style="justify-content:space-between">
    <div style="flex:1;display:flex;align-items:baseline;gap:6px"><b>Станции</b> <span class="stamp-u-full">${esc(stl || "Все станции")}</span></div>
    <b style="margin-left:8px">ДС!</b>
  </div>`;

  const footDch = (label = "Диспетчер") => `<div class="stamp-line" style="justify-content:center;margin-top:4px">
    <b>${label}</b> <span class="stamp-u" style="min-width:135px;text-align:center">${esc(dchName)}</span>
  </div>`;

  /* --- ШТАМП ДЦХ: ПРИЁМ И СДАЧА ДЕЖУРСТВА --- */
  if (cat === "SHIFT_HANDOVER") {
    return `<div class="real-stamp">
      <div class="stamp-line" style="justify-content:space-between"><b>Всем ДС!</b><span>Чиланзарская линия</span></div>
      <div class="stamp-line"><span>Дежурство принял(а) ДЦХ</span> ${combo("sh-accepted", dchOptions, 240)}</div>
      <div class="stamp-line"><span>Дежурство сдал(а) ДЦХ</span> ${combo("sh-handed", dchOptions.filter(n => n !== f["sh-accepted"]), 240)}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №1: ПРИКАЗ ЭНЕРГОДИСПЕТЧЕРУ НА СНЯТИЕ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_1") {
    const uchOpts = [
      "Чинор — Буюк Ипак Йули по I и II гл. пути",
      "Чинор — Буюк Ипак Йули по II гл. пути",
      "Буюк Ипак Йули — Чинор по I гл. пути",
      "Чинор — Олмазор по I и II гл. пути",
      "Олмазор — Пахтакор по I и II гл. пути",
      "Пахтакор — Буюк Ипак Йули по I и II гл. пути",
      ...secOptions.map(s => `${s} по I и II гл. пути`)
    ];
    return `<div class="real-stamp">
      <div class="stamp-line"><b>Энергодиспетчеру</b></div>
      <div class="stamp-line"><span>Снимите напряжение с контактного рельса на</span></div>
      <div class="stamp-line"><span>участке:</span> ${combo("v-uchastok", uchOpts, 420)}</div>
      <div class="stamp-line"><b>кроме:</b> ${combo("v-krome", PRESETS.kromeList, 380)}</div>
      ${footDch("ДЦХ")}
    </div>`;
  }

  /* --- №2: УВЕДОМЛЕНИЕ ПОЕЗДНОМУ ДИСПЕТЧЕРУ О СНЯТИИ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_2") {
    const uchOpts = [
      "Чинор — Буюк Ипак Йули по I и II гл. пути",
      "Чинор — Буюк Ипак Йули по II гл. пути",
      "Буюк Ипак Йули — Чинор по I гл. пути",
      ...secOptions.map(s => `${s} по I и II гл. пути`)
    ];
    return `<div class="real-stamp">
      <div class="stamp-line" style="justify-content:center"><b>Уведомление №</b> ${combo("v-uved-num", ["1","2","3","4","5"], 70)}</div>
      <div class="stamp-line"><span>Поездному диспетчеру</span></div>
      <div class="stamp-line"><span>По приказу №</span> ${u("v-ech-num", 50)} <span>снято напряжение с контактного</span></div>
      <div class="stamp-line"><span>рельса на участке:</span> ${combo("v-uchastok", uchOpts, 380)}</div>
      <div class="stamp-line"><b>кроме:</b> ${combo("v-krome", PRESETS.kromeList, 360)}</div>
      <div class="stamp-line"><span>в</span> ${u("v-zr-h", 38)} <span>ч.</span> ${u("v-zr-m", 38)} <span>мин. на тяговых подстанциях</span></div>
      <div class="stamp-line"><span>включены заземляющие разъединители на рабочей</span></div>
      <div class="stamp-line"><span>шине 825 В в</span> ${u("v-825-h", 38)} <span>ч.</span> ${u("v-825-m", 38)} <span>мин.</span></div>
      <div class="stamp-line" style="justify-content:center;margin-top:4px"><b>ЭЧЦ</b> ${combo("v-ech-name", PRESETS.echList, 180)}</div>
    </div>`;
  }

  /* --- №3: ПРИКАЗ НА ЛИНИЮ О СНЯТИИ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_3") {
    const uchOpts = [
      "Чинор — Буюк Ипак Йули по I и II гл. пути",
      "Чинор — Буюк Ипак Йули по II гл. пути",
      "Буюк Ипак Йули — Чинор по I гл. пути",
      ...secOptions.map(s => `${s} по I и II гл. пути`)
    ];
    return `<div class="real-stamp">
      <div class="stamp-line"><b>Всем ДСЦП, ДСП</b></div>
      <div class="stamp-line"><span>Дежурному по электродепо</span> ${combo("v-depo", ['«Чиланзар»'], 140)}, <span>ПДС №</span> ${combo("v-pds", ["2", "1", "1 и 2"], 75)}</div>
      <div class="stamp-line"><span>Напряжение с контактного рельса на участке:</span> ${combo("v-uchastok", uchOpts, 380)}</div>
      <div class="stamp-line"><b>Кроме:</b> ${combo("v-krome", PRESETS.kromeList, 360)}</div>
      <div class="stamp-line"><span>Снято в</span> ${u("v-snyato-h", 38)} <span>ч.</span> ${u("v-snyato-m", 38)} <span>мин. Напряжение будет</span></div>
      <div class="stamp-line"><span>подано в</span> ${u("v-podano-h", 38)} <span>ч.</span> ${u("v-podano-m", 38)} <span>мин. без предупреждения.</span></div>
      ${footDch("ДЦХ")}
    </div>`;
  }

  /* --- №4: ПРИКАЗ ЭНЕРГОДИСПЕТЧЕРУ НА ПОДАЧУ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_4") {
    const uchOpts = [
      "Чинор — Буюк Ипак Йули по I и II гл. пути",
      "Чинор — Буюк Ипак Йули по II гл. пути",
      "Буюк Ипак Йули — Чинор по I гл. пути",
      ...secOptions.map(s => `${s} по I и II гл. пути`)
    ];
    return `<div class="real-stamp">
      <div class="stamp-line"><b>Энергодиспетчеру</b></div>
      <div class="stamp-line">
        <span>Закоротки №</span> ${combo("v-zakorotki", PRESETS.zakorotkiList, 150)}
        ${sw("v-zak-mode", "snyaty", "сняты,")}
        ${sw("v-zak-mode", "ne_prim", "не применялись")}
      </div>
      <div class="stamp-line"><span>Подайте напряжение на контактный рельс участка:</span></div>
      <div class="stamp-line">${combo("v-uchastok", uchOpts, 420)}</div>
      <div class="stamp-line"><b>Кроме:</b> ${combo("v-krome", PRESETS.kromeList, 380)}</div>
      <div class="stamp-line" style="justify-content:center"><span>не позднее: в</span> ${u("v-podano-h", 38)} <span>ч.</span> ${u("v-podano-m", 38)} <span>мин.</span></div>
      ${footDch("ДЦХ")}
    </div>`;
  }

  /* --- №10: УСТНЫЙ ПРИКАЗ НА ПРАВО ПРОСЛЕДОВАНИЯ ЗАПРЕЩАЮЩЕГО СВЕТОФОРА --- */
  if (cat === "STAMP_10") {
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>Машинисту поезда №</span> ${combo("s10-train", PRESETS.trainNums, 90)}</div>
      <div class="stamp-line"><span>Разрешаю поезду №</span> <span class="stamp-u">${esc(f["s10-train"] || "41")}</span> <span>следовать</span></div>
      <div class="stamp-line">
        ${sw("s10-mode", "na", "на станцию")}
        ${sw("s10-mode", "otpr", "(отправиться со станции)")}
        ${combo("s10-st", stNamesList, 230)}
      </div>
      <div class="stamp-line"><span>При запрещающем показании (красный огонь, один</span></div>
      <div class="stamp-line"><span>красный и один жёлтый огни, погасших огнях, непонятное</span></div>
      <div class="stamp-line"><span>показание) входного (выходных) светофора (светофоров)</span></div>
      <div class="stamp-line"><span>№</span> ${combo("s10-in-num", ["—", ...PRESETS.entrySignals], 85)} <span>выходного (выходных)</span> ${combo("s10-out-num", PRESETS.exitSignals, 85)}</div>
      <div class="stamp-line"><span>со скоростью не более 20 км/ч до появления разрешающего</span></div>
      <div class="stamp-line">
        <span>сигнального показания</span>
        ${sw("s10-als-mode", "als", "АЛС")}
        ${sw("s10-als-mode", "next", "(до следующего светофора)")}
      </div>
      <div class="stamp-line">
        ${sw("s10-na-s", "na", "на")}
        ${sw("s10-na-s", "s", "(с)")}
        ${sel("s10-put", ["II главный", "I главный", "I станционный", "II станционный", "III станционный"])} <span>путь</span>
        ${sw("s10-per-mode", "st", "станции")}
        ${sw("s10-per-mode", "per", "(перегона)")}
        ${combo("s10-dest", [...stNamesList, ...secOptions], 260)}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №11: ПРИКАЗ НА ВЫДАЧУ ПРЕДУПРЕЖДЕНИЙ --- */
  if (cat === "STAMP_11") {
    const trOpts = ["всех чётных маршрутов", "всех нечётных маршрутов", "всех маршрутов", "—"];
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>Производились работы</span> ${combo("s11-works", PRESETS.worksList, 360)}</div>
      <div class="stamp-line">
        <span>по</span> ${sel("s11-put", ["II", "I", "I и II"])} <span>главному пути</span>
        ${sw("s11-place-mode", "st", "станции")}
        ${sw("s11-place-mode", "per", "(перегона, участка)")}
        ${combo("s11-place", [...secOptions, ...stNamesList], 320)}
      </div>
      <div class="stamp-line"><span>Следовать с особой бдительностью со скоростью</span></div>
      <div class="stamp-line"><span>не более</span> ${sel("s11-speed", ["35", "25", "20", "15", "40"])} <span>км/ч. На поезда выдавать письменные</span></div>
      <div class="stamp-line"><span>предупреждения:</span></div>
      <div class="stamp-line"><span>станции</span> ${combo("s11-st1", stNamesList, 200)} <span>поездам №№</span> ${combo("s11-tr1", trOpts, 230)}</div>
      <div class="stamp-line"><span>станции</span> ${combo("s11-st2", ["—", ...stNamesList], 200)} <span>поездам №№</span> ${combo("s11-tr2", trOpts, 230)}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №12: ОТПРАВЛЕНИЕ ЭЛЕКТРОПОЕЗДА В НЕПРАВИЛЬНОМ НАПРАВЛЕНИИ (ВОЗВРАЩЕНИЕ) --- */
  if (cat === "STAMP_12") {
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>машинисту поезда (маршрута) №</span> ${combo("c-train", PRESETS.trainNums, 90)}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин.</span>
        ${sel("c-track", ["II", "I"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${combo("c-section", secOptions, 320)}
      </div>
      <div class="stamp-line"><span>от</span> ${combo("c-from", boundOptions, 380)}</div>
      <div class="stamp-line"><span>до</span> ${combo("c-to", boundOptions, 380)}</div>
      <div class="stamp-line"><span>закрыт для движения всех поездов, кроме поезда</span></div>
      <div class="stamp-line"><span>(маршрута) №</span> <span class="stamp-u">${esc(f["c-train"] || "41")}</span> <span>которому разрешаю отправиться по</span> ${sel("c-vsp-track", ["II", "I"])}</div>
      <div class="stamp-line">
        <span>главному пути в неправильном направлении</span>
        ${sw("c-dep-mode", "st", "со станции")}
        ${sw("c-dep-mode", "per", "(перегона)")}
        ${combo("c-dep-name", [...stNamesList, ...secOptions], 260)}
      </div>
      <div class="stamp-line"><span>и следовать до начала платформы станции:</span> ${combo("c-plat-st", stNamesList, 230)}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №13: ОБ ОТКРЫТИИ ПУТИ ДЛЯ НОРМАЛЬНОГО ДВИЖЕНИЯ (ОТМЕНА ВСПОМОГАТЕЛЬНОГО) --- */
  if (cat === "STAMP_13") {
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>машинистам поездов (маршрутов) №</span> ${combo("c-train", ["всех", ...PRESETS.trainNums], 130)}</div>
      <div class="stamp-line">
        <span>Приказ №</span> ${u("c-cancel-num", 48)} <span>от «</span>${u("c-cancel-day", 32)}<span>»</span>
        ${u("c-cancel-month", 36)} <span>20</span>${u("c-cancel-year", 32)} <span>г.</span>
      </div>
      <div class="stamp-line">
        <span>Отменяется: с</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин. «</span>${u("c-day", 32)}<span>»</span>
        ${u("c-month", 36)} <span>20</span>${u("c-year", 32)} <span>г.</span>
      </div>
      <div class="stamp-line">
        ${sel("c-track", ["II", "I", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${combo("c-section", secOptions, 340)}
      </div>
      <div class="stamp-line"><span>открыт для движения всех поездов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №14: ПРИКАЗ ОБ ОРГАНИЗАЦИИ ДВУХСТОРОННЕГО ДВИЖЕНИЯ --- */
  if (cat === "STAMP_14") {
    const kromeCls = f["c-krome-strike"] === "1" ? "s-strike" : "";
    const twoWayCls = f["c-2way-strike"] === "1" ? "s-strike" : "";
    const entryCls = f["c-entry-strike"] === "1" ? "s-strike" : "";

    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>копия</span> ${combo("c-copy", PRESETS.copyRecipients, 300)}</div>
      <div class="stamp-sub-hint">(фамилия, должность)</div>
      <div class="stamp-line"><span>машинисту поезда (маршрута) №</span> ${combo("c-train", ["—", ...PRESETS.trainNums], 90)}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин.</span>
        ${sel("c-track", ["II", "I", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
      </div>
      <div class="stamp-line">
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${combo("c-section", secOptions, 360)}
      </div>
      <div class="stamp-line"><span>от</span> ${combo("c-from", boundOptions, 380)}</div>
      <div class="stamp-line"><span>до</span> ${combo("c-to", boundOptions, 380)}</div>
      <div class="stamp-line">
        <span>закрыт для движения всех поездов,</span>
        <span class="${isEdit ? 's-word' : ''} ${kromeCls}" onclick="${isEdit ? "toggleStrike('c-krome-strike','1')" : ""}">кроме поезда (маршрута) №</span>
        ${combo("c-krome-num", ["—", ...PRESETS.trainNums], 80)}
        <span class="${isEdit ? 's-word' : ''} ${twoWayCls}" onclick="${isEdit ? "toggleStrike('c-2way-strike','1')" : ""}">и на перегоне (участке):</span>
      </div>
      <div class="stamp-line ${twoWayCls}">
        ${combo("c-2way-sec", secOptions, 340)} <span>установлено двухстороннее</span>
      </div>
      <div class="stamp-line">
        <span class="${twoWayCls}">движение</span>
        <span class="${isEdit ? 's-word' : ''} ${entryCls}" onclick="${isEdit ? "toggleStrike('c-entry-strike','1')" : ""}">с правом въезда на станции:</span>
        ${combo("c-entry-st", ["—", ...stNamesList], 200)}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №15: О НАЗНАЧЕНИИ ВСПОМОГАТЕЛЬНОГО ПОЕЗДА В НЕПРАВИЛЬНОМ НАПРАВЛЕНИИ --- */
  if (cat === "STAMP_15") {
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>машинистам поездов (маршрутов) №№</span> ${combo("c-train", PRESETS.trainNums, 110)}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин.</span>
        ${sel("c-track", ["II", "I"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${combo("c-section", secOptions, 320)}
      </div>
      <div class="stamp-line"><span>от</span> ${combo("c-from", boundOptions, 380)}</div>
      <div class="stamp-line"><span>до</span> ${combo("c-to", boundOptions, 380)}</div>
      <div class="stamp-line"><span>закрыт для движения всех поездов</span></div>
      <div class="stamp-line"><span>кроме поезда №</span> <span class="stamp-u">${esc(f["c-train"] || "41")}</span> <span>маршрута №</span> ${combo("c-route", PRESETS.routeNums, 80)}</div>
      <div class="stamp-line">
        <span>которому разрешаю отправиться</span>
        ${sw("c-dep-mode", "st", "со станции")}
        ${sw("c-dep-mode", "per", "(с перегона)")}
        ${combo("c-dep-name", [...stNamesList, ...secOptions], 260)}
      </div>
      <div class="stamp-line"><span>и следовать по</span> ${sel("c-vsp-track", ["II", "I"])} <span>главному пути в неправильном</span></div>
      <div class="stamp-line"><span>направлении в качестве вспомогательного</span></div>
      <div class="stamp-line"><span>поезду №</span> ${combo("c-broken-train", PRESETS.trainNums, 85)} <span>маршруту №</span> ${combo("c-broken-route", PRESETS.routeNums, 80)}</div>
      <div class="stamp-line"><span>остановившемуся на перегоне (станции):</span> ${combo("c-broken-place", [...secOptions, ...stNamesList], 280)}</div>
      <div class="stamp-line"><span>и после сцепления с неисправным поездом отправиться</span></div>
      <div class="stamp-line"><span>на станцию:</span> ${combo("c-dest-st", stNamesList, 230)}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №16: О НАЗНАЧЕНИИ ВСПОМОГАТЕЛЬНОГО ПОЕЗДА В ПРАВИЛЬНОМ НАПРАВЛЕНИИ --- */
  if (cat === "STAMP_16") {
    return `<div class="real-stamp">
      <div class="stamp-line"><span>Машинисту поезда №</span> ${combo("c-train", PRESETS.trainNums, 85)} <span>маршрута №</span> ${combo("c-route", PRESETS.routeNums, 80)}</div>
      <div class="stamp-line"><span>Следуйте по</span> ${sel("c-track", ["II", "I"])} <span>главному пути в качестве</span></div>
      <div class="stamp-line"><span>вспомогательного поезду №</span> ${combo("c-broken-train", PRESETS.trainNums, 85)} <span>маршруту №</span> ${combo("c-broken-route", PRESETS.routeNums, 80)}</div>
      <div class="stamp-line"><span>остановившемуся на перегоне (станции):</span> ${combo("c-broken-place", [...secOptions, ...stNamesList], 280)}</div>
      <div class="stamp-line"><span>и после сцепления с неисправным поездом отправиться</span></div>
      <div class="stamp-line"><span>на станцию:</span> ${combo("c-dest-st", stNamesList, 230)}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №17: РАСПОРЯЖЕНИЕ ОБ ОКАЗАНИИ ПОМОЩИ ПОЕЗДУ НА ПЕРЕГОНЕ --- */
  if (cat === "STAMP_17") {
    return `<div class="real-stamp">
      <div class="stamp-line"><span>Машинисту поезда №</span> ${combo("c-train", PRESETS.trainNums, 95)}</div>
      <div class="stamp-line"><span>Окажите помощь остановившемуся впереди</span></div>
      <div class="stamp-line"><span>поезду №</span> ${combo("c-broken-train", PRESETS.trainNums, 85)} <span>маршруту №</span> ${combo("c-broken-route", PRESETS.routeNums, 80)} <span>и при</span></div>
      <div class="stamp-line"><span>необходимости произведите сцепление с ним.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №18: ПРИКАЗ О ПРЕКРАЩЕНИИ ДВИЖЕНИЯ ПОЕЗДОВ --- */
  if (cat === "STAMP_18") {
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>На основании сообщения</span> ${combo("c-zayavka", PRESETS.reportSources, 320)}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин.</span>
        ${sel("c-track", ["II", "I", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${combo("c-section", secOptions, 320)}
      </div>
      <div class="stamp-line"><span>от</span> ${combo("c-from", boundOptions, 380)}</div>
      <div class="stamp-line"><span>до</span> ${combo("c-to", boundOptions, 380)}</div>
      <div class="stamp-line"><span>в связи с</span> ${combo("c-osnov", PRESETS.stopReasons, 360)}</div>
      <div class="stamp-line"><span>закрыт для движения всех поездов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №19: ПРИКАЗ НА ВОССТАНОВЛЕНИЕ НОРМАЛЬНОГО ДВИЖЕНИЯ ПОЕЗДОВ (ОТКРЫТИЕ ПУТИ) --- */
  if (cat === "STAMP_19") {
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line">
        <b>Приказ №</b> ${u("c-cancel-num", 48)} <span>от «</span>${u("c-cancel-day", 32)}<span>»</span>
        ${u("c-cancel-month", 36)} <span>20</span>${u("c-cancel-year", 32)} <span>г.</span>
      </div>
      <div class="stamp-line">
        <span>Отменяется с</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин. «</span>${u("c-day", 32)}<span>»</span>
        ${u("c-month", 36)} <span>20</span>${u("c-year", 32)} <span>г.</span>
      </div>
      <div class="stamp-line">
        ${sel("c-track", ["II", "I", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${combo("c-section", secOptions, 320)}
      </div>
      <div class="stamp-line"><span>от</span> ${combo("c-from", boundOptions, 380)}</div>
      <div class="stamp-line"><span>до</span> ${combo("c-to", boundOptions, 380)}</div>
      <div class="stamp-line"><span>открыт для движения всех поездов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №20: РАСПОРЯЖЕНИЕ НА МАНЕВРОВОЕ ПЕРЕДВИЖЕНИЕ ПРИ ЗАПРЕЩАЮЩЕМ СВЕТОФОРЕ --- */
  if (cat === "STAMP_20") {
    const fromTracks = ["I станционного", "II станционного", "III станционного", "IV станционного", "I главного", "II главного", "соединительного"];
    const toTracks = ["II главный", "I главный", "I станционный", "II станционный", "III станционный", "IV станционный", "парковый"];
    return `<div class="real-stamp">
      <div class="stamp-line">
        <b>Разрешается</b>
        ${sw("s20-mode", "manevr", "маневровому составу поезду №")} ${combo("s20-train", ["—", ...PRESETS.trainNums], 85)}
      </div>
      <div class="stamp-line">
        ${sw("s20-mode", "hoz", "(хозяйственному поезду №")} ${combo("s20-hoz", ["—", ...PRESETS.hozTrainNums], 85)}<span>) следовать при</span>
      </div>
      <div class="stamp-line">
        ${sw("s20-svet-mode", "zapr", "запрещающем показании")}
        ${sw("s20-svet-mode", "pogas", "(погасших огнях)")} <span>маневрового</span>
      </div>
      <div class="stamp-line"><span>светофора (светофоров) №№</span> ${combo("s20-svet-nums", PRESETS.shuntSignalPairs, 190)}</div>
      <div class="stamp-line"><span>с</span> ${combo("s20-from-put", fromTracks, 170)} <span>пути от светофора №</span> ${combo("s20-from-svet", PRESETS.shuntSignals, 80)}</div>
      <div class="stamp-line"><span>на</span> ${combo("s20-to-put", toTracks, 170)} <span>путь до светофора №</span> ${combo("s20-to-svet", PRESETS.shuntSignals, 80)}</div>
      <div class="stamp-line"><span>маршрут готов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №21: О ЗАКРЫТИИ ПУТИ ДЛЯ ПРОИЗВОДСТВА РАБОТ ВО ВРЕМЯ ДВИЖЕНИЯ --- */
  if (cat === "STAMP_21") {
    const kromeCls = f["c-krome-strike"] === "1" ? "s-strike" : "";
    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>Копия машинисту поезда №</span> ${combo("c-train", ["—", ...PRESETS.trainNums, ...PRESETS.hozTrainNums], 90)}</div>
      <div class="stamp-line"><span>и руководителю работ:</span> ${combo("c-ruk", PRESETS.workLeaders, 300)}</div>
      <div class="stamp-line"><span>на основании заявки:</span> ${combo("c-zayavka", PRESETS.applicationsList, 300)}</div>
      <div class="stamp-line">
        <span>с</span> ${u("c-h", 38)} <span>ч.</span> ${u("c-m", 38)} <span>мин.</span>
        ${sel("c-track", ["II", "I", "I и II"])} <span>путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка, станции)")}
        ${combo("c-section", [...secOptions, ...stNamesList], 300)}
      </div>
      <div class="stamp-line"><span>от</span> ${combo("c-from", boundOptions, 380)}</div>
      <div class="stamp-line"><span>до</span> ${combo("c-to", boundOptions, 380)}</div>
      <div class="stamp-line"><span>в связи с производством работ:</span> ${combo("c-osnov", PRESETS.worksList, 340)}</div>
      <div class="stamp-line">
        <span>закрыт для движения всех поездов,</span>
        <span class="${isEdit ? 's-word' : ''} ${kromeCls}" onclick="${isEdit ? "toggleStrike('c-krome-strike','1')" : ""}">кроме поезда №</span>
        ${combo("c-krome-num", ["—", ...PRESETS.trainNums, ...PRESETS.hozTrainNums], 85)}
      </div>
      <div class="stamp-line"><span>Пользование светофорами на закрытом пути прекращается.</span></div>
      <div class="stamp-line"><span>Перегон (участок) открыть:</span> ${combo("c-open-cond", PRESETS.openConditions, 340)}</div>
      <div class="stamp-line"><span>по окончанию работ.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №26: СЛЕДОВАНИЕ ХОЗЯЙСТВЕННОГО ПОЕЗДА В НЕПРАВИЛЬНОМ НАПРАВЛЕНИИ --- */
  if (cat === "STAMP_26") {
    const isSt = f["hoz-dep-type"] === "station";
    const depName = isSt ? SN[f["hoz-dep-station"]] : (PER[f["hoz-dep-peregon"]] || {}).name;
    const stOpts = STN.map(s => `<option value="${s.code}" ${f["hoz-dep-station"] === s.code ? "selected" : ""}>${esc(s.full)}</option>`).join("");
    const destOpts = STN.map(s => `<option value="${s.code}" ${f["hoz-dest-station"] === s.code ? "selected" : ""}>${esc(s.full)}</option>`).join("");
    const perOpts = PER.map((p, i) => `<option value="${i}" ${+f["hoz-dep-peregon"] === i ? "selected" : ""}>${esc(p.name)}</option>`).join("");

    const lm = f["hoz-lim-mode"];
    const om = f["hoz-oth-mode"];
    const limPresets = ['светофора "В"', 'светофора "Д"', 'светофора "Е"', 'светофора №1', 'светофора №2', 'границы станции'];

    if (!isEdit) {
      const dw = isSt ? `со станции <span class="s-strike">(с перегона)</span>` : `<span class="s-strike">со станции</span> (с перегона)`;
      const lw = lm === "do" ? `до <span class="s-strike">/ за</span> <span class="stamp-u">${esc(f["hoz-lim-txt"])}</span>`
        : lm === "za" ? `<span class="s-strike">до /</span> за <span class="stamp-u">${esc(f["hoz-lim-txt"])}</span>`
        : `<span class="s-strike">до / за</span>`;
      const ow = om === "ahead" ? `Впереди Вас <span class="s-strike">(за Вами)</span> следует хозяйственный поезд № <span class="stamp-u">${esc(f["hoz-oth-num"])}</span>`
        : om === "behind" ? `<span class="s-strike">Впереди Вас</span> (за Вами) следует хозяйственный поезд № <span class="stamp-u">${esc(f["hoz-oth-num"])}</span>`
        : `<span class="s-strike">Впереди Вас (за Вами) следует хозяйственный поезд № —</span>`;

      return `<div class="real-stamp">
        ${stHeader}
        <div class="stamp-line">Копия машинисту хозяйственного поезда № <span class="stamp-u">${esc(f["hoz-train"])}</span></div>
        <div class="stamp-line">Разрешается хозяйственному поезду № <span class="stamp-u">${esc(f["hoz-train"])}</span></div>
        <div class="stamp-line">следовать в неправильном направлении по <span class="stamp-u">${esc(f["hoz-tr1"])}</span> главному</div>
        <div class="stamp-line">пути ${dw} <span class="stamp-u">${esc(depName)}</span></div>
        <div class="stamp-line">на <span class="stamp-u">${esc(f["hoz-tr2"])}</span> главный путь ${lw}</div>
        <div class="stamp-line" style="justify-content:flex-end">станции: <span class="stamp-u">${esc(SN[f["hoz-dest-station"]] || "")}</span></div>
        <div class="stamp-line">${ow}</div>
        ${footDch("Диспетчер")}
      </div>`;
    }

    return `<div class="real-stamp">
      ${stHeader}
      <div class="stamp-line"><span>Копия машинисту хозяйственного поезда №</span> ${combo("hoz-train", [...PRESETS.hozTrainNums, ...PRESETS.trainNums], 110)}</div>
      <div class="stamp-line"><span>Разрешается хозяйственному поезду №</span> <span class="stamp-u">${esc(f["hoz-train"] || "11236")}</span></div>
      <div class="stamp-line"><span>следовать в неправильном направлении по</span> ${sel("hoz-tr1", ["II", "I"])} <span>главному</span></div>
      <div class="stamp-line">
        <span>пути</span>
        <span class="s-word ${isSt ? '' : 's-strike'}" onclick="setDF('hoz-dep-type','station',true)">со станции</span>
        <span class="s-word ${!isSt ? '' : 's-strike'}" onclick="setDF('hoz-dep-type','peregon',true)">(с перегона)</span>
        ${isSt
          ? `<select class="stamp-sel" onchange="setDF('hoz-dep-station',this.value,true)">${stOpts}</select>`
          : `<select class="stamp-sel" onchange="setDF('hoz-dep-peregon',this.value,true)">${perOpts}</select>`}
      </div>
      <div class="stamp-line">
        <span>на</span> ${sel("hoz-tr2", ["II", "I"])} <span>главный путь</span>
        <select class="stamp-sel" onchange="setDF('hoz-lim-mode',this.value,true)">
          <option value="do" ${lm === "do" ? "selected" : ""}>до</option>
          <option value="za" ${lm === "za" ? "selected" : ""}>за</option>
          <option value="none" ${lm === "none" ? "selected" : ""}>зачеркнуть (до / за)</option>
        </select>
        ${lm !== "none" ? combo("hoz-lim-txt", limPresets, 175) : ""}
      </div>
      <div class="stamp-line" style="justify-content:flex-end">
        <span>станции:</span> <select class="stamp-sel" onchange="setDF('hoz-dest-station',this.value,true)">${destOpts}</select>
      </div>
      <div class="stamp-line">
        <select class="stamp-sel" onchange="setDF('hoz-oth-mode',this.value,true)">
          <option value="none" ${om === "none" ? "selected" : ""}>Зачеркнуть: Впереди Вас (за Вами)...</option>
          <option value="ahead" ${om === "ahead" ? "selected" : ""}>Впереди Вас следует хоз. поезд №</option>
          <option value="behind" ${om === "behind" ? "selected" : ""}>За Вами следует хоз. поезд №</option>
        </select>
        ${om !== "none" ? combo("hoz-oth-num", [...PRESETS.hozTrainNums, ...PRESETS.trainNums], 100) : ""}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №27: ПРИКАЗ НА ВЫЕЗД АВС (ВОССТАНОВИТЕЛЬНОЙ БРИГАДЫ) --- */
  if (cat === "STAMP_27") {
    return `<div class="real-stamp">
      <div class="stamp-line"><b>Дежурному по депо, мастеру восстановительной бригады</b></div>
      <div class="stamp-line"><span>Предлагаю срочно выехать на станцию:</span> ${combo("s27-st", stNamesList, 240)}</div>
      <div class="stamp-line">
        <span>для производства работ на</span> ${sel("s27-put", ["II главном", "I главном", "I и II главных", "станционном"])} <span>пути</span>
        ${sw("s27-mode", "st", "станции")}
        ${sw("s27-mode", "per", "(перегона)")}
        ${combo("s27-place", [...stNamesList, ...secOptions], 260)}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №28: УВЕДОМЛЕНИЕ ДОРОЖНОГО МАСТЕРА О ГОТОВНОСТИ ПУТИ (ПД) --- */
  if (cat === "STAMP_28") {
    return `<div class="real-stamp">
      <div class="stamp-line" style="justify-content:center"><b>Поездной диспетчер, энергодиспетчер !</b></div>
      <div class="stamp-line"><span>Путь и контактный рельс готовы к подаче</span></div>
      <div class="stamp-line"><span>напряжения и пропуску поездов с установленной</span></div>
      <div class="stamp-line"><span>скоростью</span></div>
      <div class="stamp-line">${sel("v-zk-uch", ["I и II", "II", "I", "Чинор — Буюк Ипак Йули"])} <span>участок готов ЗК №</span> ${combo("v-zk-num", ["1","2","3","4","5","6","7","8","9","10"], 80)}</div>
      <div class="stamp-line" style="margin-top:6px"><b>ПД</b> ${combo("v-pd-name", PRESETS.pdList, 190)}</div>
    </div>`;
  }

  return `<div class="real-stamp">
    ${stHeader}
    <div style="margin:4px 0">${esc(o.subTitle || o.cat)}</div>
    ${footDch("Диспетчер")}
  </div>`;
}
