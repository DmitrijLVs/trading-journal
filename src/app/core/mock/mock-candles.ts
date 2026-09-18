import { Trade } from '../../features/trades/data/trade.model';
import { SeededRng, hashSeed } from './seeded-rng';
import { roundPrice } from './mock-trades';

/** Исполнение ордера: индекс свечи, сторона, цена, количество. */
export interface TradeFill {
  index: number;
  side: 'buy' | 'sell';
  price: number;
  qty: number;
}

/** Свечи в формате night-vision: [time, open, high, low, close, volume]. */
export interface TradeChartData {
  tradeId: string;
  timeframe: string;
  candles: number[][];
  entryIndex: number;
  /** −1, пока позиция открыта. */
  exitIndex: number;
  /** Исполнения входа и выхода — средневзвешенные равны ценам сделки. */
  fills: TradeFill[];
}

export const CHART_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;
export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

const TF_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};
/** Волатильность одной свечи (доля цены) по таймфрейму. */
const TF_SIGMA: Record<string, number> = {
  '1m': 0.0008,
  '5m': 0.0014,
  '15m': 0.0022,
  '30m': 0.003,
  '1h': 0.0042,
  '4h': 0.008,
  '1d': 0.014,
};

const PRE_CANDLES = 42;
const POST_CANDLES = 16;
/** Потолок свечей внутри сделки: на мелком ТФ длинная сделка сжимается. */
const MAX_SPAN = 400;

/** Таймфрейм графика: запрошенный, иначе таймфрейм сделки, иначе 15m. */
export function resolveTimeframe(trade: Trade, requested?: string | null): ChartTimeframe {
  const known = CHART_TIMEFRAMES as readonly string[];
  if (requested && known.includes(requested)) return requested as ChartTimeframe;
  return known.includes(trade.timeframe) ? (trade.timeframe as ChartTimeframe) : '15m';
}

/**
 * Детерминированные свечи вокруг сделки: путь цены проходит точно через
 * вход и выход, победные сделки не задевают стоп, убыточные — подходят
 * к нему вплотную.
 */
export function generateTradeCandles(trade: Trade, requestedTf?: string | null): TradeChartData {
  const timeframe = resolveTimeframe(trade, requestedTf);
  const rng = new SeededRng(hashSeed(trade.id + trade.symbol + timeframe));
  const tfMin = TF_MINUTES[timeframe];
  const sigma = TF_SIGMA[timeframe] * trade.entryPrice;
  const stepMs = tfMin * 60_000;

  const openedMs = new Date(trade.openedAt).getTime();
  const isOpen = trade.status === 'open';
  const closedMs = isOpen ? openedMs + stepMs * 30 : new Date(trade.closedAt).getTime();
  const span = Math.max(2, Math.min(MAX_SPAN, Math.round((closedMs - openedMs) / stepMs)));

  const entryIndex = PRE_CANDLES;
  const exitIndex = entryIndex + span;
  const total = exitIndex + POST_CANDLES + 1;

  const entry = trade.entryPrice;
  const exit = isOpen ? entry * (1 + rng.range(-0.004, 0.006)) : trade.exitPrice;

  // ── Опорный путь цены ────────────────────────────────────────────────────
  const path = new Array<number>(total);
  path[entryIndex] = entry;

  // До входа: обратное случайное блуждание от точки входа.
  for (let i = entryIndex - 1; i >= 0; i--) {
    path[i] = path[i + 1] * (1 + rng.gaussian(0, sigma / entry));
  }

  // Внутри сделки: броуновский мост — случайное блуждание, «привязанное»
  // к выходу: W_i − (i/span)·W_span. Соседние свечи непрерывны на любом ТФ.
  const lnE = Math.log(entry);
  const lnX = Math.log(exit);
  const walk = new Array<number>(span + 1).fill(0);
  for (let i = 1; i <= span; i++) walk[i] = walk[i - 1] + rng.gaussian(0, (sigma / entry) * 1.1);
  for (let i = 1; i < span; i++) {
    const t = i / span;
    const bridge = walk[i] - t * walk[span];
    path[entryIndex + i] = Math.exp(lnE + (lnX - lnE) * t + bridge);
  }
  path[exitIndex] = exit;

  // После выхода: блуждание с лёгкой инерцией движения сделки.
  const momentum = Math.sign(exit - entry) * sigma * 0.15;
  for (let i = exitIndex + 1; i < total; i++) {
    path[i] = path[i - 1] * (1 + rng.gaussian(0, sigma / entry)) + momentum * rng.next();
  }

  // Победа не должна выбивать стоп, убыток около −1R — касается его.
  if (trade.stopLoss !== null && !isOpen) {
    const sl = trade.stopLoss;
    const dir = trade.side === 'long' ? 1 : -1;
    const win = (exit - entry) * dir > 0;
    const buffer = Math.abs(entry - sl) * 0.18;
    for (let i = entryIndex; i <= exitIndex; i++) {
      if (win) {
        // Держим путь по «безопасную» сторону стопа.
        if (dir === 1 && path[i] < sl + buffer) path[i] = sl + buffer + rng.next() * buffer;
        if (dir === -1 && path[i] > sl - buffer) path[i] = sl - buffer - rng.next() * buffer;
      } else {
        // Убыток: не проваливаемся сильно дальше стопа до момента выхода.
        if (dir === 1 && path[i] < sl - buffer) path[i] = sl - buffer * rng.next();
        if (dir === -1 && path[i] > sl + buffer) path[i] = sl + buffer * rng.next();
      }
    }
  }

  // ── Исполнения: усреднение на входе, частичные выходы ────────────────────
  const fills = generateFills(trade, entryIndex, isOpen ? -1 : exitIndex, span, exit);
  const fillPricesAt = new Map<number, number[]>();
  for (const f of fills) fillPricesAt.set(f.index, [...(fillPricesAt.get(f.index) ?? []), f.price]);

  // ── Свечи из пути ────────────────────────────────────────────────────────
  const startMs = openedMs - PRE_CANDLES * stepMs;
  const candles: number[][] = new Array(total);
  const baseVolume = trade.quantity * 40;

  for (let i = 0; i < total; i++) {
    const close = path[i];
    const open = i === 0 ? close * (1 + rng.gaussian(0, sigma / entry / 2)) : path[i - 1];
    let high = Math.max(open, close) + Math.abs(rng.gaussian(0, sigma * 0.6));
    let low = Math.min(open, close) - Math.abs(rng.gaussian(0, sigma * 0.6));

    // Свечи входа/выхода обязаны содержать цену исполнения.
    if (i === entryIndex) {
      high = Math.max(high, entry);
      low = Math.min(low, entry);
    }
    if (i === exitIndex && !isOpen) {
      high = Math.max(high, exit);
      low = Math.min(low, exit);
    }
    for (const price of fillPricesAt.get(i) ?? []) {
      high = Math.max(high, price);
      low = Math.min(low, price);
    }

    // Объём: всплески на входе/выходе, иначе шум.
    const nearEvent = Math.min(Math.abs(i - entryIndex), Math.abs(i - exitIndex));
    const spike = nearEvent === 0 ? rng.range(2.2, 3.4) : nearEvent < 3 ? rng.range(1.2, 1.9) : 1;
    const volume = baseVolume * spike * rng.range(0.35, 1.65);

    candles[i] = [
      startMs + i * stepMs,
      roundPrice(open),
      roundPrice(high),
      roundPrice(low),
      roundPrice(close),
      Number(volume.toFixed(2)),
    ];
  }

  return {
    tradeId: trade.id,
    timeframe,
    candles,
    entryIndex,
    exitIndex: isOpen ? -1 : exitIndex,
    fills,
  };
}

/**
 * Исполнения сделки. Цены и доли — от собственного генератора (не зависят
 * от таймфрейма), индексы свечей — от длины сделки на текущем ТФ.
 * Средневзвешенная цена входа равна entryPrice, выхода — exitPrice.
 */
function generateFills(
  trade: Trade,
  entryIndex: number,
  exitIndex: number,
  span: number,
  exit: number,
): TradeFill[] {
  const rng = new SeededRng(hashSeed(`${trade.id}:fills`));
  const entrySide: TradeFill['side'] = trade.side === 'long' ? 'buy' : 'sell';
  const exitSide: TradeFill['side'] = trade.side === 'long' ? 'sell' : 'buy';
  const step = Math.max(1, Math.floor(span / 8));

  const entryCount = rng.weighted([[1, 0.45], [2, 0.35], [3, 0.2]] as const);
  const exitCount = rng.weighted([[1, 0.4], [2, 0.3], [3, 0.2], [4, 0.1]] as const);

  const entryFills = spread(rng, trade.entryPrice, trade.quantity, entryCount, 0.0025).map((f, k) => ({
    ...f,
    side: entrySide,
    index: Math.min(entryIndex + k * step, Math.max(entryIndex, exitIndex - 1)),
  }));
  if (exitIndex < 0) return entryFills;

  const lastEntry = entryFills[entryFills.length - 1].index;
  const exitFills = spread(rng, exit, trade.quantity, exitCount, 0.003).map((f, k) => ({
    ...f,
    side: exitSide,
    index: Math.max(lastEntry + 1, exitIndex - (exitCount - 1 - k) * step),
  }));
  return [...entryFills, ...exitFills];
}

/** n исполнений вокруг средней цены; доли и отклонения случайны, средневзвешенная точна. */
function spread(
  rng: SeededRng,
  avgPrice: number,
  totalQty: number,
  n: number,
  maxOffset: number,
): Pick<TradeFill, 'price' | 'qty'>[] {
  const weights = Array.from({ length: n }, () => rng.range(0.6, 1.4));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const offsets = weights.map((_, k) => (k === 0 || n === 1 ? 0 : rng.range(-maxOffset, maxOffset)));
  const mean = offsets.reduce((sum, o, k) => sum + o * weights[k], 0) / weightSum;
  return weights.map((wgt, k) => ({
    price: roundPrice(avgPrice * (1 + offsets[k] - mean)),
    qty: Number(((totalQty * wgt) / weightSum).toFixed(4)),
  }));
}
