/* ==========================================================================
   stamps.js — Отрисовка всех 19 штампов 1:1 и начальные значения полей
   ========================================================================== */

function createDefaultDraft(catKey, editOrder = null) {
  if (editOrder) {
    return {
      editId: editOrder.id,
      cat: editOrder.cat,
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
  const defStations = catKey === "SHIFT_HANDOVER" || catKey === "STAMP_3"
    ? STN.map(s => s.code)
    : metaTpl.noSt
      ? []
      : [STN[0].code, STN[1].code, STN[2].code];

  const secDef = `${STN[0].full} — ${STN[2].full} по I и II гл. пути`;

  return {
    editId: null,
    cat: catKey,
    stations: defStations,
    f: {
      "b-time": t,
      "sh-accepted": dutyOf() || S.meta.activeDch,
      "sh-handed": S.meta.activeDch,

      "v-uchastok": secDef,
      "v-krome": 'путей депо «Чиланзар»',
      "v-depo": '«Чиланзар»',
      "v-pds": "2",
      "v-snyato-h": hh,
      "v-snyato-m": mm,
      "v-podano-h": "04",
      "v-podano-m": "25",
      "v-ech-num": "14",
      "v-uved-num": "1",
      "v-zr-h": hh,
      "v-zr-m": mm,
      "v-825-h": hh,
      "v-825-m": mm,
      "v-ech-name": "Касимов",
      "v-zakorotki": "1, 2, 3",
      "v-zak-mode": "snyaty",
      "v-zk-uch": "I и II",
      "v-zk-num": "5",
      "v-pd-name": "",

      "s10-train": "41",
      "s10-mode": "na",
      "s10-st": STN[0].full,
      "s10-svet-type": "входного",
      "s10-in-num": "В",
      "s10-out-num": "",
      "s10-als-mode": "als",
      "s10-na-s": "на",
      "s10-put": "I главный",
      "s10-per-mode": "st",
      "s10-dest": STN[0].full,

      "s11-works": "проверка габарита и состояния пути",
      "s11-put": "I",
      "s11-place-mode": "per",
      "s11-place": `${STN[0].full} — ${STN[2].full}`,
      "s11-speed": "35",
      "s11-st1": STN[0].full,
      "s11-tr1": "всех маршрутов",
      "s11-st2": STN[2].full,
      "s11-tr2": "",

      "c-copy": "обходчика",
      "c-train": "41",
      "c-route": "12",
      "c-ruk": "Иванову А.",
      "c-zayavka": "записи в журнале ДУ-58",
      "c-osnov": "неисправности подвижного состава",
      "c-h": hh,
      "c-m": mm,
      "c-day": curDay,
      "c-month": curMonth,
      "c-year": curYear,
      "c-cancel-num": String(Math.max(1, (S.meta.next || 201) - 1)),
      "c-cancel-day": curDay,
      "c-cancel-month": curMonth,
      "c-cancel-year": curYear,
      "c-track": "II",
      "c-per-strike": "",
      "c-section": `${STN[0].full} — ${STN[2].full}`,
      "c-from": `торца платформы ст. ${STN[0].full}`,
      "c-to": `торца платформы ст. ${STN[2].full}`,
      "c-krome-strike": "",
      "c-krome-num": "41",
      "c-2way-strike": "",
      "c-2way-sec": `${STN[0].full} — ${STN[2].full}`,
      "c-entry-strike": "1",
      "c-entry-st": "",
      "c-dep-mode": "st",
      "c-dep-name": STN[0].full,
      "c-plat-st": STN[1].full,
      "c-vsp-track": "II",
      "c-broken-train": "34",
      "c-broken-route": "08",
      "c-broken-place": `${STN[0].full} — ${STN[1].full}`,
      "c-dest-st": STN[0].full,
      "c-open-cond": "по уведомлению руководителя работ",

      "s20-mode": "manevr",
      "s20-train": "1123",
      "s20-hoz": "",
      "s20-svet-mode": "zapr",
      "s20-svet-nums": "М1, М3",
      "s20-from-put": "I станционного",
      "s20-from-svet": "М1",
      "s20-to-put": "II главный",
      "s20-to-svet": "М3",

      "hoz-train": "11236",
      "hoz-tr1": "II",
      "hoz-tr2": "II",
      "hoz-dep-type": "station",
      "hoz-dep-station": STN[0].code,
      "hoz-dep-peregon": "0",
      "hoz-dest-station": STN[2].code,
      "hoz-lim-mode": "do",
      "hoz-lim-txt": 'светофора "В"',
      "hoz-oth-mode": "none",
      "hoz-oth-num": "",

      "s27-st": STN[0].full,
      "s27-put": "II главном",
      "s27-mode": "st",
      "s27-place": STN[0].full
    }
  };
}

function setDF(key, val, rerender = false) {
  if (!activeDraft) return;
  activeDraft.f[key] = val;
  if (rerender) renderJournal();
}

function toggleStrike(key, val) {
  if (!activeDraft) return;
  activeDraft.f[key] = activeDraft.f[key] === val ? "" : val;
  renderJournal();
}

function buildStampHTML(o, isEdit) {
  const f = o.f || {};
  const cat = o.cat;
  const stl = (o.stations || []).map(c => SN[c] || c).join(", ");
  const dchName = isEdit ? dutyOf() : (o.dch || "");

  const u = (key, w = 85, ph = "") => isEdit
    ? `<input class="stamp-inp" style="width:${w}px" value="${esc(f[key] ?? "")}" placeholder="${esc(ph)}" oninput="setDF('${key}',this.value)">`
    : `<span class="stamp-u">${esc(f[key] || "—")}</span>`;

  const uFull = (key, ph = "") => isEdit
    ? `<input class="stamp-inp" style="flex:1;min-width:130px" value="${esc(f[key] ?? "")}" placeholder="${esc(ph)}" oninput="setDF('${key}',this.value)">`
    : `<span class="stamp-u-full">${esc(f[key] || "—")}</span>`;

  const sel = (key, opts) => {
    if (!isEdit) return `<span class="stamp-u">${esc(f[key] || opts[0])}</span>`;
    return `<select class="stamp-sel" onchange="setDF('${key}',this.value)">` +
      opts.map(v => `<option value="${esc(v)}" ${f[key] === v ? "selected" : ""}>${esc(v)}</option>`).join("") +
      `</select>`;
  };

  const sw = (key, strikeVal, text) => {
    const struck = f[key] === strikeVal;
    if (!isEdit) return `<span class="${struck ? 's-strike' : ''}">${text}</span>`;
    return `<span class="s-word ${struck ? 's-strike' : ''}" title="Нажмите, чтобы зачеркнуть / вернуть" onclick="toggleStrike('${key}','${strikeVal}')">${text}</span>`;
  };

  const stHeader = `<div class="stamp-line" style="justify-content:space-between">
    <div style="flex:1;display:flex;align-items:baseline;gap:6px"><b>Станции</b> <span class="stamp-u-full">${esc(stl || "Все станции")}</span></div>
    <b style="margin-left:8px">ДС!</b>
  </div>`;

  const footDch = (label = "Диспетчер") => `<div class="stamp-line" style="justify-content:center;margin-top:4px">
    <b>${label}</b> <span class="stamp-u" style="min-width:135px;text-align:center">${esc(dchName)}</span>
  </div>`;

  const hintBox = isEdit ? `<div style="font-family:system-ui;font-size:11px;color:#1d4ed8;background:#eff6ff;padding:3px 8px;border-radius:4px;margin-bottom:4px;font-weight:700">
    💡 Нажимайте прямо на слова в скобках или варианты в штампе, чтобы зачеркнуть ненужное ручкой!
  </div>` : "";

  /* --- ШТАМП ДЦХ: ПРИЁМ И СДАЧА ДЕЖУРСТВА --- */
  if (cat === "SHIFT_HANDOVER") {
    return `<div class="real-stamp">
      <div class="stamp-line" style="justify-content:space-between"><b>Всем ДС!</b><span>Чиланзарская линия</span></div>
      <div class="stamp-line"><span>Дежурство принял(а) ДЦХ</span> ${uFull("sh-accepted", "Фамилия И.")}</div>
      <div class="stamp-line"><span>Дежурство сдал(а) ДЦХ</span> ${uFull("sh-handed", "Фамилия И.")}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №1: ПРИКАЗ ЭНЕРГОДИСПЕТЧЕРУ НА СНЯТИЕ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_1") {
    return `<div class="real-stamp">
      <div class="stamp-line"><b>Энергодиспетчеру</b></div>
      <div class="stamp-line"><span>Снимите напряжение с контактного рельса на</span></div>
      <div class="stamp-line"><span>участке:</span> ${uFull("v-uchastok", "участок, пути, ветки")}</div>
      <div class="stamp-line"><b>кроме:</b> ${uFull("v-krome", "путей депо")}</div>
      ${footDch("ДЦХ")}
    </div>`;
  }

  /* --- №2: УВЕДОМЛЕНИЕ ПОЕЗДНОМУ ДИСПЕТЧЕРУ О СНЯТИИ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_2") {
    return `<div class="real-stamp">
      <div class="stamp-line" style="justify-content:center"><b>Уведомление №</b> ${u("v-uved-num", 55)}</div>
      <div class="stamp-line"><span>Поездному диспетчеру</span></div>
      <div class="stamp-line"><span>По приказу №</span> ${u("v-ech-num", 60)} <span>снято напряжение с контактного</span></div>
      <div class="stamp-line"><span>рельса на участке:</span> ${uFull("v-uchastok")}</div>
      <div class="stamp-line"><b>кроме:</b> ${uFull("v-krome")}</div>
      <div class="stamp-line"><span>в</span> ${u("v-zr-h", 44)} <span>ч.</span> ${u("v-zr-m", 44)} <span>мин. на тяговых подстанциях</span></div>
      <div class="stamp-line"><span>включены заземляющие разъединители на рабочей</span></div>
      <div class="stamp-line"><span>шине 825 В в</span> ${u("v-825-h", 44)} <span>ч.</span> ${u("v-825-m", 44)} <span>мин.</span></div>
      <div class="stamp-line" style="justify-content:center;margin-top:4px"><b>ЭЧЦ</b> ${u("v-ech-name", 140, "Фамилия ЭЧЦ")}</div>
    </div>`;
  }

  /* --- №3: ПРИКАЗ НА ЛИНИЮ О СНЯТИИ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_3") {
    return `<div class="real-stamp">
      <div class="stamp-line"><b>Всем ДСЦП, ДСП</b></div>
      <div class="stamp-line"><span>Дежурному по электродепо</span> ${u("v-depo", 130)}, <span>ПДС №</span> ${u("v-pds", 50)}</div>
      <div class="stamp-line"><span>Напряжение с контактного рельса на участке:</span> ${uFull("v-uchastok")}</div>
      <div class="stamp-line"><b>Кроме:</b> ${uFull("v-krome")}</div>
      <div class="stamp-line"><span>Снято в</span> ${u("v-snyato-h", 45)} <span>ч.</span> ${u("v-snyato-m", 45)} <span>мин. Напряжение будет</span></div>
      <div class="stamp-line"><span>подано в</span> ${u("v-podano-h", 45)} <span>ч.</span> ${u("v-podano-m", 45)} <span>мин. без предупреждения.</span></div>
      ${footDch("ДЦХ")}
    </div>`;
  }

  /* --- №4: ПРИКАЗ ЭНЕРГОДИСПЕТЧЕРУ НА ПОДАЧУ НАПРЯЖЕНИЯ --- */
  if (cat === "STAMP_4") {
    return `<div class="real-stamp">${hintBox}
      <div class="stamp-line"><b>Энергодиспетчеру</b></div>
      <div class="stamp-line">
        <span>Закоротки №</span> ${u("v-zakorotki", 95)}
        ${sw("v-zak-mode", "ne_prim", "сняты,")}
        ${sw("v-zak-mode", "snyaty", "не применялись")}
      </div>
      <div class="stamp-line"><span>Подайте напряжение на контактный рельс участка:</span></div>
      <div class="stamp-line">${uFull("v-uchastok")}</div>
      <div class="stamp-line"><b>Кроме:</b> ${uFull("v-krome")}</div>
      <div class="stamp-line" style="justify-content:center"><span>не позднее: в</span> ${u("v-podano-h", 45)} <span>ч.</span> ${u("v-podano-m", 45)} <span>мин.</span></div>
      ${footDch("ДЦХ")}
    </div>`;
  }

  /* --- №10: УСТНЫЙ ПРИКАЗ НА ПРАВО ПРОСЛЕДОВАНИЯ ЗАПРЕЩАЮЩЕГО СВЕТОФОРА --- */
  if (cat === "STAMP_10") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>Машинисту поезда №</span> ${u("s10-train", 80)}</div>
      <div class="stamp-line"><span>Разрешаю поезду №</span> ${u("s10-train", 80)} <span>следовать</span></div>
      <div class="stamp-line">
        ${sw("s10-mode", "otpr", "на станцию")}
        ${sw("s10-mode", "na", "(отправиться со станции)")}
        ${uFull("s10-st", "станция")}
      </div>
      <div class="stamp-line"><span>При запрещающем показании (красный огонь, один</span></div>
      <div class="stamp-line"><span>красный и один жёлтый огни, погасших огнях, непонятное</span></div>
      <div class="stamp-line"><span>показание) входного (выходных) светофора (светофоров)</span></div>
      <div class="stamp-line"><span>№</span> ${u("s10-in-num", 75)} <span>выходного (выходных)</span> ${u("s10-out-num", 75)}</div>
      <div class="stamp-line"><span>со скоростью не более 20 км/ч до появления разрешающего</span></div>
      <div class="stamp-line">
        <span>сигнального показания</span>
        ${sw("s10-als-mode", "next", "АЛС")}
        ${sw("s10-als-mode", "als", "(до следующего светофора)")}
      </div>
      <div class="stamp-line">
        ${sw("s10-na-s", "s", "на")}
        ${sw("s10-na-s", "na", "(с)")}
        ${u("s10-put", 110)} <span>путь</span>
        ${sw("s10-per-mode", "per", "станции")}
        ${sw("s10-per-mode", "st", "(перегона)")}
        ${uFull("s10-dest")}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №11: ПРИКАЗ НА ВЫДАЧУ ПРЕДУПРЕЖДЕНИЙ --- */
  if (cat === "STAMP_11") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>Производились работы</span> ${uFull("s11-works")}</div>
      <div class="stamp-line">
        <span>по</span> ${sel("s11-put", ["I", "II", "I и II"])} <span>главному пути</span>
        ${sw("s11-place-mode", "per", "станции")}
        ${sw("s11-place-mode", "st", "(перегона, участка)")}
        ${uFull("s11-place")}
      </div>
      <div class="stamp-line"><span>Следовать с особой бдительностью со скоростью</span></div>
      <div class="stamp-line"><span>не более</span> ${u("s11-speed", 60)} <span>км/ч. На поезда выдавать письменные</span></div>
      <div class="stamp-line"><span>предупреждения:</span></div>
      <div class="stamp-line"><span>станции</span> ${u("s11-st1", 150)} <span>поездам №№</span> ${uFull("s11-tr1")}</div>
      <div class="stamp-line"><span>станции</span> ${u("s11-st2", 150)} <span>поездам №№</span> ${uFull("s11-tr2")}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №12: ОТПРАВЛЕНИЕ ЭЛЕКТРОПОЕЗДА В НЕПРАВИЛЬНОМ НАПРАВЛЕНИИ (ВОЗВРАЩЕНИЕ) --- */
  if (cat === "STAMP_12") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>машинисту поезда (маршрута) №</span> ${u("c-train", 85)}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин.</span>
        ${sel("c-track", ["I", "II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>от</span> ${uFull("c-from")}</div>
      <div class="stamp-line"><span>до</span> ${uFull("c-to")}</div>
      <div class="stamp-line"><span>закрыт для движения всех поездов, кроме поезда</span></div>
      <div class="stamp-line"><span>(маршрута) №</span> ${u("c-train", 75)} <span>которому разрешаю отправиться по</span> ${sel("c-vsp-track", ["I", "II"])}</div>
      <div class="stamp-line">
        <span>главному пути в неправильном направлении</span>
        ${sw("c-dep-mode", "per", "со станции")}
        ${sw("c-dep-mode", "st", "(перегона)")}
        ${uFull("c-dep-name")}
      </div>
      <div class="stamp-line"><span>и следовать до начала платформы станции:</span> ${uFull("c-plat-st")}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №13: ОБ ОТКРЫТИИ ПУТИ ДЛЯ НОРМАЛЬНОГО ДВИЖЕНИЯ (ОТМЕНА ВСПОМОГАТЕЛЬНОГО) --- */
  if (cat === "STAMP_13") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>машинистам поездов (маршрутов) №</span> ${uFull("c-train", "всех")}</div>
      <div class="stamp-line">
        <span>Приказ №</span> ${u("c-cancel-num", 60)} <span>от «</span>${u("c-cancel-day", 38)}<span>»</span>
        ${u("c-cancel-month", 70)} <span>20</span>${u("c-cancel-year", 40)} <span>г.</span>
      </div>
      <div class="stamp-line">
        <span>Отменяется: с</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин. «</span>${u("c-day", 38)}<span>»</span>
        ${u("c-month", 70)} <span>20</span>${u("c-year", 40)} <span>г.</span>
      </div>
      <div class="stamp-line">
        ${sel("c-track", ["I", "II", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>открыт для движения всех поездов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №14: ПРИКАЗ ОБ ОРГАНИЗАЦИИ ДВУХСТОРОННЕГО ДВИЖЕНИЯ (И ШТАМП ИЗ ДУ-58) --- */
  if (cat === "STAMP_14") {
    const kromeCls = f["c-krome-strike"] === "1" ? "s-strike" : "";
    const twoWayCls = f["c-2way-strike"] === "1" ? "s-strike" : "";
    const entryCls = f["c-entry-strike"] === "1" ? "s-strike" : "";

    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>копия</span> ${uFull("c-copy", "обходчика / должность, фамилия")}</div>
      <div class="stamp-sub-hint">(фамилия, должность)</div>
      <div class="stamp-line"><span>машинисту поезда (маршрута) №</span> ${u("c-train", 80)}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин.</span>
        ${sel("c-track", ["I", "II", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
      </div>
      <div class="stamp-line">
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>от</span> ${uFull("c-from")}</div>
      <div class="stamp-line"><span>до</span> ${uFull("c-to")}</div>
      <div class="stamp-line">
        <span>закрыт для движения всех поездов,</span>
        <span class="${isEdit ? 's-word' : ''} ${kromeCls}" onclick="${isEdit ? "toggleStrike('c-krome-strike','1')" : ""}">кроме поезда (маршрута) №</span>
        ${u("c-krome-num", 65)}
        <span class="${isEdit ? 's-word' : ''} ${twoWayCls}" onclick="${isEdit ? "toggleStrike('c-2way-strike','1')" : ""}">и на перегоне (участке):</span>
      </div>
      <div class="stamp-line ${twoWayCls}">
        ${uFull("c-2way-sec")} <span>установлено двухстороннее</span>
      </div>
      <div class="stamp-line">
        <span class="${twoWayCls}">движение</span>
        <span class="${isEdit ? 's-word' : ''} ${entryCls}" onclick="${isEdit ? "toggleStrike('c-entry-strike','1')" : ""}">с правом въезда на станции:</span>
        ${u("c-entry-st", 130, "станция")}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №15: О НАЗНАЧЕНИИ ВСПОМОГАТЕЛЬНОГО ПОЕЗДА В НЕПРАВИЛЬНОМ НАПРАВЛЕНИИ --- */
  if (cat === "STAMP_15") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>машинистам поездов (маршрутов) №№</span> ${uFull("c-train")}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин.</span>
        ${sel("c-track", ["I", "II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>от</span> ${uFull("c-from")}</div>
      <div class="stamp-line"><span>до</span> ${uFull("c-to")}</div>
      <div class="stamp-line"><span>закрыт для движения всех поездов</span></div>
      <div class="stamp-line"><span>кроме поезда №</span> ${u("c-train", 75)} <span>маршрута №</span> ${u("c-route", 65)}</div>
      <div class="stamp-line">
        <span>которому разрешаю отправиться</span>
        ${sw("c-dep-mode", "per", "со станции")}
        ${sw("c-dep-mode", "st", "(с перегона)")}
        ${uFull("c-dep-name")}
      </div>
      <div class="stamp-line"><span>и следовать по</span> ${sel("c-vsp-track", ["I", "II"])} <span>главному пути в неправильном</span></div>
      <div class="stamp-line"><span>направлении в качестве вспомогательного</span></div>
      <div class="stamp-line"><span>поезду №</span> ${u("c-broken-train", 75)} <span>маршруту №</span> ${u("c-broken-route", 65)}</div>
      <div class="stamp-line"><span>остановившемуся на перегоне (станции):</span> ${uFull("c-broken-place")}</div>
      <div class="stamp-line"><span>и после сцепления с неисправным поездом отправиться</span></div>
      <div class="stamp-line"><span>на станцию:</span> ${uFull("c-dest-st")}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №16: О НАЗНАЧЕНИИ ВСПОМОГАТЕЛЬНОГО ПОЕЗДА В ПРАВИЛЬНОМ НАПРАВЛЕНИИ --- */
  if (cat === "STAMP_16") {
    return `<div class="real-stamp">
      <div class="stamp-line"><span>Машинисту поезда №</span> ${u("c-train", 80)} <span>маршрута №</span> ${u("c-route", 65)}</div>
      <div class="stamp-line"><span>Следуйте по</span> ${sel("c-track", ["I", "II"])} <span>главному пути в качестве</span></div>
      <div class="stamp-line"><span>вспомогательного поезду №</span> ${u("c-broken-train", 80)} <span>маршруту №</span> ${u("c-broken-route", 65)}</div>
      <div class="stamp-line"><span>остановившемуся на перегоне (станции):</span> ${uFull("c-broken-place")}</div>
      <div class="stamp-line"><span>и после сцепления с неисправным поездом отправиться</span></div>
      <div class="stamp-line"><span>на станцию:</span> ${uFull("c-dest-st")}</div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №17: РАСПОРЯЖЕНИЕ ОБ ОКАЗАНИИ ПОМОЩИ ПОЕЗДУ НА ПЕРЕГОНЕ --- */
  if (cat === "STAMP_17") {
    return `<div class="real-stamp">
      <div class="stamp-line"><span>Машинисту поезда №</span> ${u("c-train", 85)}</div>
      <div class="stamp-line"><span>Окажите помощь остановившемуся впереди</span></div>
      <div class="stamp-line"><span>поезду №</span> ${u("c-broken-train", 80)} <span>маршруту №</span> ${u("c-broken-route", 65)} <span>и при</span></div>
      <div class="stamp-line"><span>необходимости произведите сцепление с ним.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №18: ПРИКАЗ О ПРЕКРАЩЕНИИ ДВИЖЕНИЯ ПОЕЗДОВ --- */
  if (cat === "STAMP_18") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>На основании сообщения</span> ${uFull("c-zayavka", "ФИО, должность")}</div>
      <div class="stamp-line">
        <span>С</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин.</span>
        ${sel("c-track", ["I", "II", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>от</span> ${uFull("c-from")}</div>
      <div class="stamp-line"><span>до</span> ${uFull("c-to")}</div>
      <div class="stamp-line"><span>в связи с</span> ${uFull("c-osnov", "причина прекращения движения")}</div>
      <div class="stamp-line"><span>закрыт для движения всех поездов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №19: ПРИКАЗ НА ВОССТАНОВЛЕНИЕ НОРМАЛЬНОГО ДВИЖЕНИЯ ПОЕЗДОВ (ОТКРЫТИЕ ПУТИ) --- */
  if (cat === "STAMP_19") {
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line">
        <b>Приказ №</b> ${u("c-cancel-num", 60)} <span>от «</span>${u("c-cancel-day", 38)}<span>»</span>
        ${u("c-cancel-month", 70)} <span>20</span>${u("c-cancel-year", 40)} <span>г.</span>
      </div>
      <div class="stamp-line">
        <span>Отменяется с</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин. «</span>${u("c-day", 38)}<span>»</span>
        ${u("c-month", 70)} <span>20</span>${u("c-year", 40)} <span>г.</span>
      </div>
      <div class="stamp-line">
        ${sel("c-track", ["I", "II", "I и II"])} <span>главный путь</span>
        ${sw("c-per-strike", "peregon", "перегона")}
        ${sw("c-per-strike", "uchastok", "(участка)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>от</span> ${uFull("c-from")}</div>
      <div class="stamp-line"><span>до</span> ${uFull("c-to")}</div>
      <div class="stamp-line"><span>открыт для движения всех поездов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №20: РАСПОРЯЖЕНИЕ НА МАНЕВРОВОЕ ПЕРЕДВИЖЕНИЕ ПРИ ЗАПРЕЩАЮЩЕМ СВЕТОФОРЕ --- */
  if (cat === "STAMP_20") {
    return `<div class="real-stamp">${hintBox}
      <div class="stamp-line">
        <b>Разрешается</b>
        ${sw("s20-mode", "hoz", "маневровому составу поезду №")} ${u("s20-train", 75)}
      </div>
      <div class="stamp-line">
        ${sw("s20-mode", "manevr", "(хозяйственному поезду №")} ${u("s20-hoz", 75)}<span>) следовать при</span>
      </div>
      <div class="stamp-line">
        ${sw("s20-svet-mode", "pogas", "запрещающем показании")}
        ${sw("s20-svet-mode", "zapr", "(погасших огнях)")} <span>маневрового</span>
      </div>
      <div class="stamp-line"><span>светофора (светофоров) №№</span> ${uFull("s20-svet-nums")}</div>
      <div class="stamp-line"><span>с</span> ${u("s20-from-put", 130)} <span>пути от светофора №</span> ${u("s20-from-svet", 70)}</div>
      <div class="stamp-line"><span>на</span> ${u("s20-to-put", 130)} <span>путь до светофора №</span> ${u("s20-to-svet", 70)}</div>
      <div class="stamp-line"><span>маршрут готов.</span></div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №21: О ЗАКРЫТИИ ПУТИ ДЛЯ ПРОИЗВОДСТВА РАБОТ ВО ВРЕМЯ ДВИЖЕНИЯ --- */
  if (cat === "STAMP_21") {
    const kromeCls = f["c-krome-strike"] === "1" ? "s-strike" : "";
    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>Копия машинисту поезда №</span> ${u("c-train", 85)}</div>
      <div class="stamp-line"><span>и руководителю работ:</span> ${uFull("c-ruk", "должность, фамилия")}</div>
      <div class="stamp-line"><span>на основании заявки:</span> ${uFull("c-zayavka")}</div>
      <div class="stamp-line">
        <span>с</span> ${u("c-h", 45)} <span>ч.</span> ${u("c-m", 45)} <span>мин.</span>
        ${sel("c-track", ["I", "II", "I и II"])} <span>путь</span>
        ${sw("c-per-strike", "uchastok", "перегона")}
        ${sw("c-per-strike", "peregon", "(участка, станции)")}
        ${uFull("c-section")}
      </div>
      <div class="stamp-line"><span>от</span> ${uFull("c-from")}</div>
      <div class="stamp-line"><span>до</span> ${uFull("c-to")}</div>
      <div class="stamp-line"><span>в связи с производством работ:</span> ${uFull("c-osnov")}</div>
      <div class="stamp-line">
        <span>закрыт для движения всех поездов,</span>
        <span class="${isEdit ? 's-word' : ''} ${kromeCls}" onclick="${isEdit ? "toggleStrike('c-krome-strike','1')" : ""}">кроме поезда №</span>
        ${u("c-krome-num", 75)}
      </div>
      <div class="stamp-line"><span>Пользование светофорами на закрытом пути прекращается.</span></div>
      <div class="stamp-line"><span>Перегон (участок) открыть:</span> ${uFull("c-open-cond")}</div>
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

    if (!isEdit) {
      const dw = isSt ? `со станции <span class="s-strike">(с перегона)</span>` : `<span class="s-strike">со станции</span> (с перегона)`;
      const lw = lm === "do" ? `до <span class="s-strike">/ за</span> <span class="stamp-u">${esc(f["hoz-lim-txt"])}</span>`
        : lm === "za" ? `<span class="s-strike">до /</span> за <span class="stamp-u">${esc(f["hoz-lim-txt"])}</span>`
        : `<span class="s-strike">до / за</span>`;
      const ow = om === "ahead" ? `Впереди Вас <span class="s-strike">(за Вами)</span> следует хозяйственный поезд № <span class="stamp-u">${esc(f["hoz-oth-num"])}</span>`
        : om === "behind" ? `<span class="s-strike">Впереди Вас</span> (за Вами) следует хозяйственный поезд № <span class="stamp-u">${esc(f["hoz-oth-num"])}</span>`
        : `<span class="s-strike">Впереди Вас (за Вами) следует хозяйственный поезд № ______</span>`;

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

    return `<div class="real-stamp">${hintBox}
      ${stHeader}
      <div class="stamp-line"><span>Копия машинисту хозяйственного поезда №</span> ${u("hoz-train", 95)}</div>
      <div class="stamp-line"><span>Разрешается хозяйственному поезду №</span> ${u("hoz-train", 95)}</div>
      <div class="stamp-line"><span>следовать в неправильном направлении по</span> ${sel("hoz-tr1", ["II", "I"])} <span>главному</span></div>
      <div class="stamp-line">
        <span>пути</span>
        <span class="s-word ${isSt ? '' : 's-strike'}" onclick="setDF('hoz-dep-type','station',true)">со станции</span>
        <span class="s-word ${!isSt ? '' : 's-strike'}" onclick="setDF('hoz-dep-type','peregon',true)">(с перегона)</span>
        ${isSt
          ? `<select class="stamp-sel" onchange="setDF('hoz-dep-station',this.value)">${stOpts}</select>`
          : `<select class="stamp-sel" onchange="setDF('hoz-dep-peregon',this.value)">${perOpts}</select>`}
      </div>
      <div class="stamp-line">
        <span>на</span> ${sel("hoz-tr2", ["II", "I"])} <span>главный путь</span>
        <select class="stamp-sel" onchange="setDF('hoz-lim-mode',this.value,true)">
          <option value="do" ${lm === "do" ? "selected" : ""}>до</option>
          <option value="za" ${lm === "za" ? "selected" : ""}>за</option>
          <option value="none" ${lm === "none" ? "selected" : ""}>зачеркнуть (до / за)</option>
        </select>
        ${lm !== "none" ? u("hoz-lim-txt", 145) : ""}
      </div>
      <div class="stamp-line" style="justify-content:flex-end">
        <span>станции:</span> <select class="stamp-sel" onchange="setDF('hoz-dest-station',this.value)">${destOpts}</select>
      </div>
      <div class="stamp-line">
        <select class="stamp-sel" onchange="setDF('hoz-oth-mode',this.value,true)">
          <option value="none" ${om === "none" ? "selected" : ""}>Зачеркнуть: Впереди Вас (за Вами)...</option>
          <option value="ahead" ${om === "ahead" ? "selected" : ""}>Впереди Вас следует хоз. поезд №</option>
          <option value="behind" ${om === "behind" ? "selected" : ""}>За Вами следует хоз. поезд №</option>
        </select>
        ${om !== "none" ? u("hoz-oth-num", 85, "11405") : ""}
      </div>
      ${footDch("Диспетчер")}
    </div>`;
  }

  /* --- №27: ПРИКАЗ НА ВЫЕЗД АВС (ВОССТАНОВИТЕЛЬНОЙ БРИГАДЫ) --- */
  if (cat === "STAMP_27") {
    return `<div class="real-stamp">${hintBox}
      <div class="stamp-line"><b>Дежурному по депо, мастеру восстановительной бригады</b></div>
      <div class="stamp-line"><span>Предлагаю срочно выехать на станцию:</span> ${uFull("s27-st")}</div>
      <div class="stamp-line">
        <span>для производства работ на</span> ${u("s27-put", 110)} <span>пути</span>
        ${sw("s27-mode", "per", "станции")}
        ${sw("s27-mode", "st", "(перегона)")}
        ${uFull("s27-place")}
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
      <div class="stamp-line">${u("v-zk-uch", 75)} <span>участок готов ЗК №</span> ${u("v-zk-num", 80)}</div>
      <div class="stamp-line" style="margin-top:6px"><b>ПД</b> ${u("v-pd-name", 160, "Фамилия ПД")}</div>
    </div>`;
  }

  return `<div class="real-stamp">
    ${stHeader}
    <div style="margin:4px 0">${esc(o.subTitle || o.cat)}</div>
    ${footDch("Диспетчер")}
  </div>`;
}
