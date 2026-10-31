/**
 * Рыночные данные графиков. Свечей в API платформы нет — они приходят
 * с публичного API биржи, на которой записана сделка (REST + WebSocket).
 */

/** Свеча: [время открытия (мс), open, high, low, close, volume], по возрастанию времени. */
export type Candle = number[];

/** Биржи с публичными свечами — те же, что принимает API платформы. */
export type MarketExchange = 'binance' | 'bybit' | 'okx';

/** Секундные бары: на биржах их нет — собирает пайплайн wintrading (только Binance USDⓈ-M). */
export const SECONDS_TIMEFRAMES = ['1s', '5s', '15s'] as const;
/** Таймфреймы, которые биржи отдают сами (REST klines + kline-поток). */
export const KLINE_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;
export const TIMEFRAMES = [...SECONDS_TIMEFRAMES, ...KLINE_TIMEFRAMES] as const;

export type SecondsTimeframe = (typeof SECONDS_TIMEFRAMES)[number];
export type KlineTimeframe = (typeof KLINE_TIMEFRAMES)[number];
export type Timeframe = SecondsTimeframe | KlineTimeframe;

/** Сколько живёт секундная история у wintrading: старше суток — ответа нет. */
export const SECONDS_HISTORY_MS = 24 * 3_600_000;

export const TIMEFRAME_MS: Readonly<Record<Timeframe, number>> = {
  '1s': 1_000,
  '5s': 5_000,
  '15s': 15_000,
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

/** Инструмент на конкретной бирже: у каждой биржи свои свечи и свой поток. */
export interface MarketRef {
  exchange: MarketExchange;
  symbol: string;
}

/** Страница свечей: `before` — открытые строго раньше, `after` — строго позже. */
export interface CandleQuery<T extends Timeframe = Timeframe> extends MarketRef {
  timeframe: T;
  before?: number;
  after?: number;
  limit: number;
}

export interface CandleStreamHandlers {
  /** Обновление текущей свечи или первая свеча следующего бара. */
  candle(candle: Candle): void;
  /** Поток переподключился — пропущенное за разрыв нужно догрузить через REST. */
  resync(): void;
}

export function isTimeframe(value: string): value is Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(value);
}

export function isSecondsTimeframe(value: string): value is SecondsTimeframe {
  return (SECONDS_TIMEFRAMES as readonly string[]).includes(value);
}

/**
 * Секунды есть только у Binance и только за последние сутки: `since` — с какого
 * момента нужны бары (вход сделки), запас в 10 минут — на историю перед входом.
 */
export function secondsAvailable(exchange: MarketExchange, since: number, now: number): boolean {
  return exchange === 'binance' && now - since < SECONDS_HISTORY_MS - 10 * 60_000;
}

/** Время открытия бара, которому принадлежит момент (бары выровнены по UTC). */
export function barOpenTime(time: number, timeframe: Timeframe): number {
  const step = TIMEFRAME_MS[timeframe];
  return Math.floor(time / step) * step;
}

/** Свеча — текущая (ещё формируется) на момент `now`. */
export function isLiveCandle(openTime: number, timeframe: Timeframe, now: number): boolean {
  return openTime >= barOpenTime(now, timeframe);
}

/**
 * Бары таймфрейма идут без пропусков. Секундные — нет: бар есть только у
 * секунды, в которую были сделки, так что разрыв во времени — не потеря данных.
 */
export function isDenseTimeframe(timeframe: Timeframe): timeframe is KlineTimeframe {
  return !isSecondsTimeframe(timeframe);
}

/** Биржа счёта → источник свечей; биржи без публичного потока читаем с Binance. */
export function marketExchangeOf(exchange: string): MarketExchange {
  return exchange === 'bybit' || exchange === 'okx' ? exchange : 'binance';
}
