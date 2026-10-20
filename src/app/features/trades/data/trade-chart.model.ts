import { Candle, Timeframe, isTimeframe } from '../../../core/market/market.model';
import { Trade } from './trade.model';

/** Исполнение ордера сделки: время (мс), сторона, цена, количество. */
export interface TradeFill {
  time: number;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
}

/**
 * Первое окно графика сделки: свечи биржи вокруг сделки (дальше история
 * подгружается страницами, текущая свеча обновляется потоком) и исполнения.
 */
export interface TradeChartData {
  tradeId: string;
  timeframe: Timeframe;
  /** Знаков после запятой у цен символа. */
  priceDecimals: number;
  candles: Candle[];
  /** Исполнения входа и выхода; средневзвешенные равны ценам сделки. */
  fills: TradeFill[];
}

/** Таймфрейм графика: запрошенный, иначе таймфрейм сделки, иначе 15m. */
export function resolveTimeframe(trade: Trade, requested?: string | null): Timeframe {
  if (requested && isTimeframe(requested)) return requested;
  return isTimeframe(trade.timeframe) ? trade.timeframe : '15m';
}

/** Исполнения сделки; без них (бэкенд не прислал) — одно на вход и одно на выход. */
export function tradeFills(trade: Trade, data: TradeChartData): TradeFill[] {
  if (data.fills.length > 0) return data.fills;
  const entrySide: TradeFill['side'] = trade.side === 'long' ? 'buy' : 'sell';
  const fills: TradeFill[] = [
    { time: Date.parse(trade.openedAt), side: entrySide, price: trade.entryPrice, qty: trade.quantity },
  ];
  if (trade.status === 'closed') {
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
