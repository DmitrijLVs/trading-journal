import { Account } from '../../features/accounts/data/account.model';

/** Справочники мок-вселенной: инструменты, стратегии, теги, тексты заметок. */

export interface SymbolMeta {
  symbol: string;
  basePrice: number;
  /** Вес при выборе инструмента для сделки. */
  weight: number;
  /** Годовой тренд цены (лог-дрейф, для правдоподобной динамики). */
  yearDrift: number;
}

export const SYMBOLS: readonly SymbolMeta[] = [
  { symbol: 'BTCUSDT', basePrice: 64000, weight: 22, yearDrift: 0.35 },
  { symbol: 'ETHUSDT', basePrice: 3100, weight: 18, yearDrift: 0.2 },
  { symbol: 'SOLUSDT', basePrice: 142, weight: 14, yearDrift: 0.45 },
  { symbol: 'BNBUSDT', basePrice: 575, weight: 5, yearDrift: 0.15 },
  { symbol: 'XRPUSDT', basePrice: 0.52, weight: 5, yearDrift: 0.3 },
  { symbol: 'DOGEUSDT', basePrice: 0.155, weight: 6, yearDrift: -0.1 },
  { symbol: 'AVAXUSDT', basePrice: 31.5, weight: 5, yearDrift: -0.05 },
  { symbol: 'LINKUSDT', basePrice: 15.2, weight: 5, yearDrift: 0.25 },
  { symbol: 'ARBUSDT', basePrice: 0.88, weight: 4, yearDrift: -0.3 },
  { symbol: 'OPUSDT', basePrice: 1.85, weight: 3, yearDrift: -0.25 },
  { symbol: 'NEARUSDT', basePrice: 5.3, weight: 4, yearDrift: 0.1 },
  { symbol: 'APTUSDT', basePrice: 8.6, weight: 3, yearDrift: -0.15 },
  { symbol: 'SUIUSDT', basePrice: 1.02, weight: 4, yearDrift: 0.6 },
  { symbol: 'TONUSDT', basePrice: 6.3, weight: 2, yearDrift: -0.2 },
];

export type TradeStyle = 'scalp' | 'intraday' | 'swing';

export interface StyleMeta {
  style: TradeStyle;
  timeframes: readonly string[];
  /** Длительность сделки, минуты [min, max]. */
  durationMin: number;
  durationMax: number;
  /** Дистанция до стопа в % от цены [min, max]. */
  slPctMin: number;
  slPctMax: number;
  strategies: readonly string[];
}

export const STYLES: readonly StyleMeta[] = [
  {
    style: 'scalp',
    timeframes: ['5m'],
    durationMin: 8,
    durationMax: 90,
    slPctMin: 0.15,
    slPctMax: 0.5,
    strategies: ['Скальпинг стакана', 'Импульс', 'Пробой уровня'],
  },
  {
    style: 'intraday',
    timeframes: ['15m'],
    durationMin: 60,
    durationMax: 480,
    slPctMin: 0.5,
    slPctMax: 1.6,
    strategies: ['Пробой уровня', 'Отбой от уровня', 'Тренд внутри дня', 'Ложный пробой'],
  },
  {
    style: 'swing',
    timeframes: ['1h', '4h'],
    durationMin: 480,
    durationMax: 5760,
    slPctMin: 1.5,
    slPctMax: 4,
    strategies: ['Свинг по тренду', 'Разворот тренда', 'Накопление'],
  },
];

export const TAGS: readonly string[] = [
  'по плану',
  'ретест',
  'объёмы',
  'новости',
  'FOMO',
  'против тренда',
  'сессия США',
  'высокая волатильность',
  'уровень дня',
  'добор',
  'слабый сетап',
  'A-сетап',
];

export const MISTAKES: readonly string[] = [
  'Ранний вход',
  'Передержал убыток',
  'Двинул стоп',
  'Превышен риск',
  'Вход без сетапа',
  'Усреднение против тренда',
  'Рано зафиксировал',
  'Торговля на новостях',
];

export const WIN_NOTES: readonly string[] = [
  'Чистый сетап: дождался ретеста уровня и вошёл по подтверждению объёмом.',
  'Сработал план целиком — частичная фиксация на 1R, остаток до цели.',
  'Хороший вход по тренду старшего таймфрейма. Не дёргался, сопровождал по структуре.',
  'Терпеливо ждал свою цену. Вход точно от уровня, стоп короткий.',
  'Идеальное исполнение. Записать сетап в базу — повторяемая модель.',
];

export const LOSS_NOTES: readonly string[] = [
  'Вход был импульсивным, без подтверждения. Классический FOMO после свечи.',
  'Стоп сработал по плану — сетап был валидным, просто не сыграл. Претензий к себе нет.',
  'Передержал: видел слабость, но надеялся на возврат. Урок — выходить по сигналу.',
  'Влез против тренда старшего ТФ. Больше не торговать контртренд без разворотной структуры.',
  'Риск был выше нормы. После двух убыточных подряд — пауза 30 минут, это правило.',
];

export const OPEN_NOTES: readonly string[] = [
  'Держу по плану, стоп в безубытке после теста уровня.',
  'Позиция по тренду, сопровождаю по локальным минимумам.',
];

export const JOURNAL_DAY_NOTES: readonly string[] = [
  'Рынок с утра пилило, лучшие движения были после открытия США. Взял основную часть на пробое уровня дня.',
  'Сложный день: два стопа подряд на открытии Лондона. Сделал паузу, вернулся к графику после обеда — отбил часть.',
  'Торговал мало и аккуратно — новостной фон тяжёлый, объёмы тонкие. План выполнен.',
  'Дисциплина сегодня на высоте: все входы по чек-листу, ни одного импульсивного клика.',
  'Поймал сильный тренд на SOL, досиживал позицию дольше обычного — сопровождение по 1h структуре.',
  'День без сделок по сетапу не считается плохим днём. Смотрел рынок, обновил уровни на неделю.',
  'Перебрал с риском в первой сделке — эмоции после вчерашнего минуса. Заметил вовремя, урезал объём.',
  'Азиатская сессия дала аккуратный шорт от сопротивления. После — флэт, не торговал.',
  'Пятница: снизил объёмы вдвое, закрыл неделю в плюс. Ревью недели — в воскресенье.',
  'Ошибка дня — вход без ретеста. Рынок простил, но в журнал записываю как минус к дисциплине.',
];

/** Счета мок-пользователя. Балансы «на старте» — P&L считается из сделок. */
export const MOCK_ACCOUNTS: readonly Account[] = [
  {
    id: 'acc-binance',
    name: 'Binance Futures',
    exchange: 'binance',
    market: 'futures',
    currency: 'USDT',
    startBalance: 18000,
    createdAt: '2025-07-01T09:00:00Z',
    apiKeyMasked: 'q7Pd••••••••Xk2N',
    syncEnabled: true,
    lastSyncAt: '2026-07-09T06:40:00Z',
  },
  {
    id: 'acc-bybit',
    name: 'Bybit Perp',
    exchange: 'bybit',
    market: 'futures',
    currency: 'USDT',
    startBalance: 7500,
    createdAt: '2025-09-14T12:00:00Z',
    apiKeyMasked: 'Ab9x••••••••T5mQ',
    syncEnabled: true,
    lastSyncAt: '2026-07-09T06:40:00Z',
  },
  {
    id: 'acc-okx',
    name: 'OKX Спот',
    exchange: 'okx',
    market: 'spot',
    currency: 'USDT',
    startBalance: 4200,
    createdAt: '2025-11-02T15:30:00Z',
    apiKeyMasked: 'f31c••••••••9dLp',
    syncEnabled: false,
    lastSyncAt: '2026-06-28T18:12:00Z',
  },
];

export const ACCOUNT_WEIGHTS: readonly (readonly [string, number])[] = [
  ['acc-binance', 0.58],
  ['acc-bybit', 0.32],
  ['acc-okx', 0.1],
];
