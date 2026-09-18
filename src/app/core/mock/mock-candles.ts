import { Trade } from '../../features/trades/data/trade.model';
import { SeededRng, hashSeed } from './seeded-rng';
import { roundPrice } from './mock-trades';

/** Свечи в формате night-vision: [time, open, high, low, close, volume]. */
export interface TradeChartData {
  tradeId: string;
  timeframe: string;
  candles: number[][];
  entryIndex: number;
  /** −1, пока позиция открыта. */
  exitIndex: number;
}

const TF_MINUTES: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60, '4h': 240 };
/** Волатильность одной свечи (доля цены) по таймфрейму. */
const TF_SIGMA: Record<string, number> = {
  '1m': 0.0008,
  '5m': 0.0014,
  '15m': 0.0022,
  '1h': 0.0042,
  '4h': 0.008,
};

const PRE_CANDLES = 42;
const POST_CANDLES = 16;

/**
 * Детерминированные свечи вокруг сделки: путь цены проходит точно через
 * вход и выход, победные сделки не задевают стоп, убыточные — подходят
 * к нему вплотную.
 */
export function generateTradeCandles(trade: Trade): TradeChartData {
  const rng = new SeededRng(hashSeed(trade.id + trade.symbol));
  const tfMin = TF_MINUTES[trade.timeframe] ?? 15;
  const sigma = (TF_SIGMA[trade.timeframe] ?? 0.002) * trade.entryPrice;
  const stepMs = tfMin * 60_000;

  const openedMs = new Date(trade.openedAt).getTime();
  const isOpen = trade.status === 'open';
  const closedMs = isOpen ? openedMs + stepMs * 30 : new Date(trade.closedAt).getTime();
  const span = Math.max(2, Math.round((closedMs - openedMs) / stepMs));

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

  // Внутри сделки: броуновский мост от входа к выходу.
  const lnE = Math.log(entry);
  const lnX = Math.log(exit);
  for (let i = 1; i < span; i++) {
    const t = i / span;
    const bridge = Math.sqrt(t * (1 - t));
    const noise = rng.gaussian(0, (sigma / entry) * 1.6) * bridge * Math.sqrt(span);
    path[entryIndex + i] = Math.exp(lnE + (lnX - lnE) * t + noise);
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
    timeframe: trade.timeframe,
    candles,
    entryIndex,
    exitIndex: isOpen ? -1 : exitIndex,
  };
}
