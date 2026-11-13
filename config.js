/* ==========================================================================
   config.js — Конфигурация Firebase, Станции, Пути и Справочники Чиланзарской линии
   ========================================================================== */
const BASE = "https://chilonzor-ikr-default-rtdb.asia-southeast1.firebasedatabase.app";
const API_KEY = "AIzaSyDuFe4vZGsm1k5oQ-kX75FK1euluVWOxf4";
const LS = "metro_v8", LSO = "metro_v8_out", LSS = "metro_v8_sess", AK = "metro_v8_auth", LSP = "metro_v8_prof";

/* Станции Чиланзарской линии:
   Индекс 0 (Буюк Ипак Йули) ➔ Индекс 16 (Чинор): I главный путь
   Индекс 16 (Чинор) ➔ Индекс 0 (Буюк Ипак Йули): II главный путь
   Общий участок линии: Чинор — Буюк Ипак Йули */
const STN = [
  ["biy", "Буюк Ипак Йули"],
  ["push", "Пушкин"],
  ["holim", "Хамид Олимжон"],
  ["atxiyo", "Амир Темур Хиёбони"],
  ["must", "Мустакиллик майдони"],
  ["paxt", "Пахтакор"],
  ["xdust", "Халклар Дустлиги"],
  ["mbog", "Миллий бог"],
  ["nav", "Новза"],
  ["mu", "Мирзо Улугбек"],
  ["chil", "Чиланзар"],
  ["olma", "Олмазор"],
  ["chosh", "Чоштепа"],
  ["uzg", "Узгариш"],
  ["serg", "Сергели"],
  ["yang", "Янгихаёт"],
  ["chin", "Чинор"],
  ["depo", "Блок-пост электродепо «Чиланзар»"]
].map(([code, full], idx) => ({ code, full, idx }));

const SN = Object.fromEntries(STN.map(s => [s.code, s.full]));
const SI = Object.fromEntries(STN.map((s, i) => [s.code, i]));

const PER_I = STN.slice(0, 16).map((s, i) => ({
  a: s.code,
  b: STN[i + 1].code,
  track: "I",
  name: `${s.full} — ${STN[i + 1].full}`
}));

const PER_II = STN.slice(0, 16).map((s, i) => ({
  a: STN[i + 1].code,
  b: s.code,
  track: "II",
  name: `${STN[i + 1].full} — ${s.full}`
})).reverse();

const PER = [...PER_II, ...PER_I];

/* Справочники для мгновенного выбора без клавиатуры */
const PRESETS = {
  dchList: [
    "Икрамов Д.",
    "Анишченко",
    "Ходжаева",
    "Абдулкасимова",
    "Аскаралиев",
    "Пирматова",
    "Исмоилов А."
  ],
  echList: [
    "Касимов",
    "Рахимов",
    "Смирнов",
    "Юсупов",
    "Алимов",
    "Турсунов"
  ],
  pdList: [
    "Рахим ака",
    "Каримов",
    "Рустамов",
    "Усманов",
    "Назаров"
  ],
  trainNums: [
    "41", "42", "43", "44", "45", "11236", "11405", "1123",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "11", "12", "14", "15", "18", "20", "22", "25", "29", "34"
  ],
  routeNums: [
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "14", "15", "16", "18", "20", "22", "25", "29"
  ],
  signals: [
    "В", "Д", "Е", "М1", "М2", "М3", "М4",
    "1", "2", "3", "4", "5", "6",
    "101", "102", "104", "106", "108"
  ],
  kromeList: [
    "путей электродепо «Чиланзар»",
    "парковых путей электродепо «Чиланзар»",
    "соединительной ветки в электродепо «Чиланзар»",
    "нет (на всём протяжении)"
  ],
  zakorotkiList: [
    "1, 2, 3",
    "1, 2",
    "1, 2, 3, 4",
    "все установленные",
    "—"
  ],
  worksList: [
    "проверка габарита и состояния пути",
    "ремонт верхнего строения пути",
    "ремонт контактного рельса",
    "проверка устройств СЦБ и АЛС-АРС",
    "замена рельсовой плети / шпал",
    "промывка и осмотр тоннеля"
  ],
  stopReasons: [
    "неисправности подвижного состава",
    "неисправности устройств СЦБ",
    "снятия напряжения с контактного рельса",
    "постороннего предмета на пути",
    "неисправности контактного рельса",
    "производства неотложных работ"
  ],
  reportSources: [
    "машиниста поезда",
    "ДСП станции",
    "дорожного мастера (ПД)",
    "старшего электромеханика СЦБ (ШНС)",
    "энергодиспетчера (ЭЧЦ)"
  ],
  copyRecipients: [
    "обходчика пути",
    "дорожного мастера ПД",
    "старшего электромеханика СЦБ",
    "мастера АВС",
    "ДСП станций",
    "—"
  ],
  workLeaders: [
    "дорожному мастеру ПД",
    "старшему электромеханику СЦБ",
    "мастеру тоннельного участка",
    "мастеру ЭМЧ",
    "начальнику смены депо"
  ],
  openConditions: [
    "по уведомлению руководителя работ",
    "по окончанию работ и выводу людей",
    "по приказу поездного диспетчера (ДЦХ)"
  ]
};

const STAMP_TEMPLATES = [
  { key: "SHIFT_HANDOVER", num: "ДЦХ", short: "Приём и сдача дежурства", title: "Приём и сдача дежурства ДЦХ", color: "tpl-teal", noSt: false, noObr: true, danger: false },
  { key: "STAMP_1", num: "№1", short: "Снятие напряжения (ЭЧЦ)", title: "Приказ Энергодиспетчеру на снятие напряжения", color: "tpl-red", noSt: true, noObr: true, danger: true },
  { key: "STAMP_2", num: "№2", short: "Уведомление от ЭЧЦ (снято)", title: "Уведомление Поездному диспетчеру о снятии напряжения", color: "tpl-amber", noSt: true, noObr: true, danger: false },
  { key: "STAMP_3", num: "№3", short: "Снятие напряжения (на линию)", title: "Приказ на линию о снятии напряжения", color: "tpl-red", noSt: false, noObr: false, danger: true },
  { key: "STAMP_4", num: "№4", short: "Подача напряжения (ЭЧЦ)", title: "Приказ Энергодиспетчеру на подачу напряжения", color: "tpl-red", noSt: true, noObr: true, danger: true },
  { key: "STAMP_10", num: "№10", short: "Запрещающий светофор", title: "Устный приказ на проследование запрещающего светофора", color: "tpl-amber", noSt: false, noObr: false, danger: false },
  { key: "STAMP_11", num: "№11", short: "Выдача предупреждений", title: "Приказ на выдачу предупреждений", color: "tpl-amber", noSt: false, noObr: false, danger: false },
  { key: "STAMP_12", num: "№12", short: "Возвращение поезда (непр. напр.)", title: "Отправление электропоезда в неправильном направлении (возвращение)", color: "tpl-purple", noSt: false, noObr: false, danger: true },
  { key: "STAMP_13", num: "№13", short: "Открытие пути (отмена вспом.)", title: "Об открытии пути для нормального движения поездов", color: "tpl-green", noSt: false, noObr: false, danger: false },
  { key: "STAMP_14", num: "№14", short: "Двухстороннее движение", title: "Приказ об организации двухстороннего движения", color: "tpl-blue", noSt: false, noObr: false, danger: true },
  { key: "STAMP_15", num: "№15", short: "Вспом. поезд (неправ. напр.)", title: "О назначении вспомогательного поезда в неправильном направлении", color: "tpl-purple", noSt: false, noObr: false, danger: true },
  { key: "STAMP_16", num: "№16", short: "Вспом. поезд (правильн. напр.)", title: "О назначении вспомогательного поезда в правильном направлении", color: "tpl-purple", noSt: false, noObr: false, danger: false },
  { key: "STAMP_17", num: "№17", short: "Оказание помощи на перегоне", title: "Распоряжение об оказании помощи поезду на перегоне", color: "tpl-amber", noSt: false, noObr: false, danger: false },
  { key: "STAMP_18", num: "№18", short: "Прекращение движения поездов", title: "Приказ о прекращении движения поездов", color: "tpl-red", noSt: false, noObr: false, danger: true },
  { key: "STAMP_19", num: "№19", short: "Восстановление движения (откр.)", title: "Восстановление нормального движения поездов (открытие пути)", color: "tpl-green", noSt: false, noObr: false, danger: false },
  { key: "STAMP_20", num: "№20", short: "Манёвры при запрещ. светофоре", title: "Распоряжение на маневровое передвижение при запрещающем светофоре", color: "tpl-amber", noSt: false, noObr: false, danger: false },
  { key: "STAMP_21", num: "№21", short: "Закрытие пути для работ", title: "О закрытии пути для производства работ во время движения", color: "tpl-blue", noSt: false, noObr: false, danger: true },
  { key: "STAMP_26", num: "№26", short: "Хоз. поезд в неправ. направл.", title: "Следование хозяйственного поезда в неправильном направлении", color: "tpl-purple", noSt: false, noObr: false, danger: false },
  { key: "STAMP_27", num: "№27", short: "Выезд бригады АВС", title: "Приказ на выезд АВС (восстановительной бригады)", color: "tpl-red", noSt: false, noObr: true, danger: false },
  { key: "STAMP_28", num: "№28", short: "Готовность пути и КР (ПД)", title: "Уведомление дорожного мастера о готовности пути (ПД)", color: "tpl-green", noSt: true, noObr: true, danger: false }
];

const TPL_MAP = Object.fromEntries(STAMP_TEMPLATES.map(t => [t.key, t]));
