import {
  Candle,
  MarketExchange,
  Timeframe,
  isTimeframe,
  secondsAvailable,
} from '../../../core/market/market.model';
import { Trade, durationMs } from './trade.model';

/** Исполнение ордера сделки: время (мс), сторона, цена, количество. */
export interface TradeFill {
  time: number;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
}

/**
 * Первое окно графика сделки: свечи биржи вокруг неё (дальше история
 * подгружается страницами, текущая свеча обновляется потоком) и исполнения.
 */
export interface TradeChartData {
  timeframe: Timeframe;
  /** Знаков после запятой у цен символа. */
  priceDecimals: number;
  candles: Candle[];
  /** Исполнения сделки из журнала (`/journal/trades/:id`). */
  fills: TradeFill[];
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/**
 * Таймфрейм графика: выбранный пользователем, иначе по длительности сделки.
 * Скальп последних суток на Binance открывается на секундах — на минутке
 * вход и выход сливаются в одну свечу.
 */
export function chartTimeframe(
  trade: Trade,
  exchange: MarketExchange,
  now = Date.now(),
  requested?: string | null,
): Timeframe {
  if (requested && isTimeframe(requested)) return requested;
  const ms = durationMs(trade);
  if (secondsAvailable(exchange, Date.parse(trade.openedAt), now)) {
    if (ms <= 2 * MINUTE_MS) return '1s';
    if (ms <= 8 * MINUTE_MS) return '5s';
    if (ms <= 25 * MINUTE_MS) return '15s';
  }
  if (ms <= 2 * HOUR_MS) return '1m';
  if (ms <= 12 * HOUR_MS) return '5m';
  if (ms <= 72 * HOUR_MS) return '15m';
  if (ms <= 20 * 24 * HOUR_MS) return '1h';
  return '4h';
}

/** Исполнения сделки; без них (не загрузились) — средние входа и выхода. */
export function tradeFills(trade: Trade, data: TradeChartData): TradeFill[] {
  if (data.fills.length > 0) return data.fills;
  const entrySide: TradeFill['side'] = trade.side === 'long' ? 'buy' : 'sell';
  const fills: TradeFill[] = [];
  if (trade.entryPrice !== null && !trade.carriedIn) {
    fills.push({ time: Date.parse(trade.openedAt), side: entrySide, price: trade.entryPrice, qty: trade.quantity });
  }
  if (trade.status === 'closed' && trade.exitPrice !== null) {
    fills.push({
      time: Date.parse(trade.closedAt),
      side: entrySide === 'buy' ? 'sell' : 'buy',
      price: trade.exitPrice,
      qty: trade.quantity,
    });
  }
  return fills;
}

/** Бегущая средневзвешенная по исполнениям: [[время, средняя цена], …]. */
export function runningAverage(fills: readonly TradeFill[]): [number, number][] {
  let qty = 0;
  let cost = 0;
  return fills.map((f) => {
    qty += f.qty;
    cost += f.qty * f.price;
    return [f.time, cost / qty];
  });
}

/** Индекс свечи, в которую попадает момент времени (свечи по возрастанию). */
export function candleIndexAt(candles: readonly Candle[], time: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (candles[mid][0] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
