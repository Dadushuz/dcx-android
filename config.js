/* ==========================================================================
   config.js — Конфигурация Firebase, Станции и 19 Шаблонов Штампов ДУ-58
   ========================================================================== */
const BASE = "https://chilonzor-ikr-default-rtdb.asia-southeast1.firebasedatabase.app";
const API_KEY = "AIzaSyDuFe4vZGsm1k5oQ-kX75FK1euluVWOxf4";
const LS = "metro_v8", LSO = "metro_v8_out", LSS = "metro_v8_sess", AK = "metro_v8_auth", LSP = "metro_v8_prof";

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
].map(([code, full]) => ({ code, full }));

const SN = Object.fromEntries(STN.map(s => [s.code, s.full]));
const PER = STN.slice(0, -1).map((s, i) => ({ a: s.code, b: STN[i + 1].code, name: `«${s.full} — ${STN[i + 1].full}»` }));

const STAMP_TEMPLATES = [
  {
    key: "SHIFT_HANDOVER",
    num: "ДЦХ",
    title: "Приём и сдача дежурства ДЦХ",
    sub: "Всем ДС! Дежурство принял / сдал ДЦХ",
    color: "tpl-teal",
    noSt: false,
    noObr: true,
    danger: false
  },
  {
    key: "STAMP_1",
    num: "№1",
    title: "Приказ Энергодиспетчеру на снятие напряжения",
    sub: "Энергодиспетчеру: Снимите напряжение с КР на участке...",
    color: "tpl-red",
    noSt: true,
    noObr: true,
    danger: true
  },
  {
    key: "STAMP_2",
    num: "№2",
    title: "Уведомление Поездному диспетчеру о снятии напряжения",
    sub: "Уведомление от ЭЧЦ: снято напряжение с КР, включены ЗР...",
    color: "tpl-amber",
    noSt: true,
    noObr: true,
    danger: false
  },
  {
    key: "STAMP_3",
    num: "№3",
    title: "Приказ на линию о снятии напряжения",
    sub: "Всем ДСЦП, ДСП, Дежурному по электродепо, ПДС...",
    color: "tpl-red",
    noSt: false,
    noObr: false,
    danger: true
  },
  {
    key: "STAMP_4",
    num: "№4",
    title: "Приказ Энергодиспетчеру на подачу напряжения",
    sub: "Закоротки сняты / не применялись. Подайте напряжение на КР...",
    color: "tpl-red",
    noSt: true,
    noObr: true,
    danger: true
  },
  {
    key: "STAMP_10",
    num: "№10",
    title: "Устный приказ на проследование запрещающего светофора",
    sub: "Разрешаю поезду № следовать при запрещающем показании...",
    color: "tpl-amber",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_11",
    num: "№11",
    title: "Приказ на выдачу предупреждений",
    sub: "Производились работы... Следовать с особой бдительностью <= км/ч",
    color: "tpl-amber",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_12",
    num: "№12",
    title: "Отправление электропоезда в неправильном направлении (возвращение)",
    sub: "Закрыт путь, кроме поезда №, следовать до начала платформы...",
    color: "tpl-purple",
    noSt: false,
    noObr: false,
    danger: true
  },
  {
    key: "STAMP_13",
    num: "№13",
    title: "Об открытии пути для нормального движения поездов",
    sub: "Об отмене вспомогательного поезда в неправильном направлении",
    color: "tpl-green",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_14",
    num: "№14",
    title: "Приказ об организации двухстороннего движения",
    sub: "Закрыт для движения всех поездов, кроме №, двухстороннее движение",
    color: "tpl-blue",
    noSt: false,
    noObr: false,
    danger: true
  },
  {
    key: "STAMP_15",
    num: "№15",
    title: "О назначении вспомогательного поезда в неправильном направлении",
    sub: "Закрыт путь, кроме поезда № в качестве вспомогательного...",
    color: "tpl-purple",
    noSt: false,
    noObr: false,
    danger: true
  },
  {
    key: "STAMP_16",
    num: "№16",
    title: "О назначении вспомогательного поезда в правильном направлении",
    sub: "Машинисту поезда №: следуйте по гл. пути в качестве вспомогательного",
    color: "tpl-purple",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_17",
    num: "№17",
    title: "Распоряжение об оказании помощи поезду на перегоне",
    sub: "Машинисту поезда №: окажите помощь остановившемуся впереди поезду",
    color: "tpl-amber",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_18",
    num: "№18",
    title: "Приказ о прекращении движения поездов",
    sub: "На основании сообщения... закрыт для движения всех поездов",
    color: "tpl-red",
    noSt: false,
    noObr: false,
    danger: true
  },
  {
    key: "STAMP_19",
    num: "№19",
    title: "Восстановление нормального движения поездов (открытие пути)",
    sub: "Приказ № отменяется, главный путь открыт для движения всех поездов",
    color: "tpl-green",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_20",
    num: "№20",
    title: "Распоряжение на маневровое передвижение при запрещающем светофоре",
    sub: "Разрешается маневровому составу / хоз. поезду следовать...",
    color: "tpl-amber",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_21",
    num: "№21",
    title: "О закрытии пути для производства работ во время движения",
    sub: "Копия машинисту и руководителю работ: на основании заявки закрыт путь...",
    color: "tpl-blue",
    noSt: false,
    noObr: false,
    danger: true
  },
  {
    key: "STAMP_26",
    num: "№26",
    title: "Следование хозяйственного поезда в неправильном направлении",
    sub: "Разрешается хоз. поезду № следовать в неправильном направлении...",
    color: "tpl-purple",
    noSt: false,
    noObr: false,
    danger: false
  },
  {
    key: "STAMP_27",
    num: "№27",
    title: "Приказ на выезд АВС (восстановительной бригады)",
    sub: "Дежурному по депо, мастеру АВС: предлагаю срочно выехать на станцию...",
    color: "tpl-red",
    noSt: false,
    noObr: true,
    danger: false
  },
  {
    key: "STAMP_28",
    num: "№28",
    title: "Уведомление дорожного мастера о готовности пути (ПД)",
    sub: "Поездной диспетчер, энергодиспетчер! Путь и КР готовы к подаче напряжения",
    color: "tpl-green",
    noSt: true,
    noObr: true,
    danger: false
  }
];

const TPL_MAP = Object.fromEntries(STAMP_TEMPLATES.map(t => [t.key, t]));
