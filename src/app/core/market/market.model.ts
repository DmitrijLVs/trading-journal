/**
 * Рыночные данные графиков. Свечей в API платформы нет — они приходят
 * с публичного API биржи, на которой записана сделка (REST + WebSocket).
 */

/** Свеча: [время открытия (мс), open, high, low, close, volume], по возрастанию времени. */
export type Candle = number[];

/** Биржи с публичными свечами — те же, что принимает API платформы. */
export type MarketExchange = 'binance' | 'bybit' | 'okx';

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TIMEFRAME_MS: Readonly<Record<Timeframe, number>> = {
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
export interface CandleQuery extends MarketRef {
  timeframe: Timeframe;
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

/** Время открытия бара, которому принадлежит момент (бары выровнены по UTC). */
export function barOpenTime(time: number, timeframe: Timeframe): number {
  const step = TIMEFRAME_MS[timeframe];
  return Math.floor(time / step) * step;
}

/** Свеча — текущая (ещё формируется) на момент `now`. */
export function isLiveCandle(openTime: number, timeframe: Timeframe, now: number): boolean {
  return openTime >= barOpenTime(now, timeframe);
}

/** Биржа счёта → источник свечей; биржи без публичного потока читаем с Binance. */
export function marketExchangeOf(exchange: string): MarketExchange {
  return exchange === 'bybit' || exchange === 'okx' ? exchange : 'binance';
}
