import { Trade } from '../../features/trades/data/trade.model';
import {
  TradeChartData,
  TradeFill,
  resolveTimeframe,
} from '../../features/trades/data/trade-chart.model';
import { Candle, TIMEFRAME_MS, Timeframe, barOpenTime } from '../market/market.model';
import { SeededRng, hashSeed } from './seeded-rng';
import { roundPrice } from './mock-trades';
import {
  LISTING_TIME,
  marketCandles,
  marketPrice,
  roundTo,
  symbolDecimals,
  symbolMeta,
} from './mock-market';

/** Свечей истории до входа в первом ответе — дальше подгружается при прокрутке. */
const HISTORY_BARS = 300;
/** Первый ответ доходит до текущей свечи, если до неё не больше стольких свечей. */
const INITIAL_LIMIT = 3000;
/** Иначе — столько свечей после выхода, остальное догружается вперёд. */
const AFTER_EXIT_BARS = 120;
/** За сколько свечей до входа путь сделки плавно отходит от рынка… */
const RAMP_BARS = 40;
/** …и за сколько после выхода возвращается к нему. */
const SETTLE_BARS = 16;

/** Волатильность одной свечи внутри сделки (доля цены) по таймфрейму. */
const TF_SIGMA: Readonly<Record<Timeframe, number>> = {
  '1m': 0.0008,
  '5m': 0.0014,
  '15m': 0.0022,
  '30m': 0.003,
  '1h': 0.0042,
  '4h': 0.008,
  '1d': 0.014,
};

/**
 * Свечи вокруг сделки — как их отдала бы биржа, плюс исполнения. Вне окна
 * сделки это свечи мок-рынка (с ними совпадают подгружаемые страницы и
 * поток), внутри путь цены проходит точно через вход и выход: победные
 * сделки не задевают стоп, убыточные — подходят к нему вплотную.
 */
export function generateTradeCandles(
  trade: Trade,
  requestedTf: string | null | undefined,
  now: number,
): TradeChartData {
  const timeframe = resolveTimeframe(trade, requestedTf);
  const step = TIMEFRAME_MS[timeframe];
  symbolMeta(trade.symbol, trade.entryPrice);
  const digits = symbolDecimals(trade.symbol);

  const liveOpen = barOpenTime(now, timeframe);
  const closed = trade.status === 'closed';
  const openedMs = Math.min(Date.parse(trade.openedAt), now);
  const closedMs = closed ? Math.min(Date.parse(trade.closedAt), now) : now;
  const entryBar = barOpenTime(openedMs, timeframe);
  const exitBar = barOpenTime(closedMs, timeframe);

  const first = Math.max(barOpenTime(LISTING_TIME, timeframe), entryBar - HISTORY_BARS * step);
  const tradeEnd = closed ? exitBar : entryBar;
  const last = Math.min(
    liveOpen,
    Math.max(first + (INITIAL_LIMIT - 1) * step, tradeEnd + AFTER_EXIT_BARS * step),
  );
  const candles = marketCandles(trade.symbol, timeframe, first, last, now);

  const fills = generateFills(trade, openedMs, closedMs);
  if (closed) {
    const exit = trade.exitPrice;
    applyTradePath(candles, trade, timeframe, { first, liveOpen, entryBar, exitBar, exit, digits });
  }
  includeFills(candles, fills, step, digits);

  return { tradeId: trade.id, timeframe, priceDecimals: digits, candles, fills };
}

interface TradeWindow {
  first: number;
  liveOpen: number;
  entryBar: number;
  exitBar: number;
  exit: number;
  digits: number;
}

/** Переписывает свечи окна сделки: разгон к входу, мост вход → выход, возврат к рынку. */
function applyTradePath(
  candles: Candle[],
  trade: Trade,
  timeframe: Timeframe,
  w: TradeWindow,
): void {
  const step = TIMEFRAME_MS[timeframe];
  const rng = new SeededRng(hashSeed(trade.id + trade.symbol + timeframe));
  const sigma = TF_SIGMA[timeframe] * trade.entryPrice;
  const entry = trade.entryPrice;
  const exit = w.exit;

  const index = (time: number) => Math.round((time - w.first) / step);
  // Цена рынка на закрытии свечи i — с ней сшиваются края окна.
  const market = (i: number) => marketPrice(trade.symbol, w.first + (i + 1) * step);
  const iEntry = index(w.entryBar);
  const iExit = index(w.exitBar);
  const iStart = Math.max(0, iEntry - RAMP_BARS);
  // Текущая свеча всегда рыночная — иначе она разошлась бы с потоком.
  const iEnd = Math.min(iExit + SETTLE_BARS, index(w.liveOpen) - 1, candles.length - 1);
  if (iEnd < iStart) return;

  const path = new Map<number, number>();

  // До входа: путь плавно отходит от рынка к цене входа.
  const entryShift = entry - market(iEntry);
  for (let i = iStart; i < iEntry; i++) {
    path.set(i, market(i) + (entryShift * (i - iStart + 1)) / (iEntry - iStart + 1));
  }
  path.set(iEntry, entry);

  // Внутри сделки: броуновский мост — случайное блуждание, «привязанное»
  // к выходу: W_i − (i/span)·W_span. Соседние свечи непрерывны на любом ТФ.
  const span = iExit - iEntry;
  const lnE = Math.log(entry);
  const lnX = Math.log(exit);
  const walk = new Array<number>(span + 1).fill(0);
  for (let i = 1; i <= span; i++) walk[i] = walk[i - 1] + rng.gaussian(0, (sigma / entry) * 1.1);
  for (let i = 1; i < span; i++) {
    const t = i / span;
    path.set(iEntry + i, Math.exp(lnE + (lnX - lnE) * t + walk[i] - t * walk[span]));
  }
  path.set(iExit, exit);

  // Победа не должна выбивать стоп, убыток около −1R — касается его.
  if (trade.stopLoss !== null) {
    const sl = trade.stopLoss;
    const dir = trade.side === 'long' ? 1 : -1;
    const win = (exit - entry) * dir > 0;
    const buffer = Math.abs(entry - sl) * 0.18;
    for (let i = iEntry + 1; i < iExit; i++) {
      let p = path.get(i)!;
      if (win) {
        if (dir === 1 && p < sl + buffer) p = sl + buffer + rng.next() * buffer;
        if (dir === -1 && p > sl - buffer) p = sl - buffer - rng.next() * buffer;
      } else {
        if (dir === 1 && p < sl - buffer) p = sl - buffer * rng.next();
        if (dir === -1 && p > sl + buffer) p = sl + buffer * rng.next();
      }
      path.set(i, p);
    }
  }

  // После выхода: отклонение от рынка затухает.
  const exitShift = exit - market(iExit);
  for (let i = iExit + 1; i <= iEnd; i++) {
    path.set(i, market(i) + exitShift * (1 - (i - iExit) / (SETTLE_BARS + 1)));
  }

  for (let i = iStart; i <= iEnd; i++) {
    const close = path.get(i)!;
    const open = i === iStart ? candles[i][1] : path.get(i - 1)!;
    const high = Math.max(open, close) + Math.abs(rng.gaussian(0, sigma * 0.6));
    const low = Math.min(open, close) - Math.abs(rng.gaussian(0, sigma * 0.6));
    // Объём: всплески на входе и выходе.
    const nearEvent = Math.min(Math.abs(i - iEntry), Math.abs(i - iExit));
    const spike = nearEvent === 0 ? rng.range(2.2, 3.4) : nearEvent < 3 ? rng.range(1.2, 1.9) : 1;
    candles[i] = [
      candles[i][0],
      roundTo(open, w.digits),
      roundTo(high, w.digits),
      roundTo(low, w.digits),
      roundTo(close, w.digits),
      Number((candles[i][5] * spike).toFixed(3)),
    ];
  }
}

/** Свечи с исполнениями обязаны содержать их цены. */
function includeFills(candles: Candle[], fills: readonly TradeFill[], step: number, digits: number): void {
  if (candles.length === 0) return;
  const first = candles[0][0];
  for (const fill of fills) {
    const candle = candles[Math.floor((fill.time - first) / step)];
    if (!candle) continue;
    candle[2] = roundTo(Math.max(candle[2], fill.price), digits);
    candle[3] = roundTo(Math.min(candle[3], fill.price), digits);
  }
}

/**
 * Исполнения сделки во времени (от таймфрейма не зависят): усреднение на
 * входе, частичные выходы. Средневзвешенная входа равна entryPrice, выхода —
 * exitPrice. Открытая позиция — один вход по рынку.
 */
function generateFills(trade: Trade, openedMs: number, closedMs: number): TradeFill[] {
  const rng = new SeededRng(hashSeed(`${trade.id}:fills`));
  const entrySide: TradeFill['side'] = trade.side === 'long' ? 'buy' : 'sell';
  const exitSide: TradeFill['side'] = trade.side === 'long' ? 'sell' : 'buy';
  if (trade.status !== 'closed') {
    return [{ time: openedMs, side: entrySide, price: trade.entryPrice, qty: trade.quantity }];
  }
  const gap = (closedMs - openedMs) / 8;

  const entryCount = rng.weighted([[1, 0.45], [2, 0.35], [3, 0.2]] as const);
  const exitCount = rng.weighted([[1, 0.4], [2, 0.3], [3, 0.2], [4, 0.1]] as const);

  const entryFills = spread(rng, trade.entryPrice, trade.quantity, entryCount, 0.0025).map(
    (f, k): TradeFill => ({ ...f, side: entrySide, time: openedMs + k * gap }),
  );
  const exitFills = spread(rng, trade.exitPrice, trade.quantity, exitCount, 0.003).map(
    (f, k): TradeFill => ({ ...f, side: exitSide, time: closedMs - (exitCount - 1 - k) * gap }),
  );
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
