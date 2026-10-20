import { Candle, TIMEFRAME_MS, Timeframe, barOpenTime } from '../market/market.model';
import { priceDecimals } from '../../features/trades/data/trade.model';
import { SYMBOLS, SymbolMeta } from './mock-universe';
import { hashSeed } from './seeded-rng';

/**
 * Мок-рынок: цена каждого символа — детерминированная функция времени
 * с доступом к любому моменту. Поэтому страницы истории, текущая свеча и
 * поток обновлений сходятся между собой без хранения состояния, а свечи
 * вокруг сделок (mock-candles) плавно вливаются в этот рынок.
 */

export const DAY_MS = 86_400_000;

/** Сегодняшняя UTC-полночь — история всегда «живая» и доходит до вчера. */
export const TODAY = (() => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
})();

/** Год торговли: последняя закрытая сделка — вчера, открытые — сегодня. */
export const HISTORY_END = TODAY - DAY_MS;
export const HISTORY_START = HISTORY_END - 365 * DAY_MS;

/** «Листинг»: раньше свечей нет — здесь заканчивается подгрузка истории. */
export const LISTING_TIME = HISTORY_START - 365 * DAY_MS;

/** σ лог-цены на √секунду: ≈0.07% на минутной свече, ≈2.6% на дневной. */
const SIGMA = 0.9e-4;
/** Октавы шума: от 8 секунд до ~18 часов, каждая вдвое длиннее предыдущей. */
const BASE_PERIOD_MS = 8_000;
const OCTAVES = 14;
const AMPLITUDES = Array.from(
  { length: OCTAVES },
  (_, k) => (SIGMA * Math.sqrt((BASE_PERIOD_MS * 2 ** k) / 1000)) / 1.1,
);
/** Отсчётов цены на закрытую свечу; мельче — дорисовывают фитили. */
const CANDLE_SAMPLES = 24;

const metas = new Map<string, SymbolMeta>();
const decimals = new Map<string, number>();

/**
 * Правдоподобная цена инструмента в момент времени: базовая цена ×
 * годовой дрейф × две синусоиды (циклы рынка) — детерминированно.
 */
export function symbolPriceAt(meta: SymbolMeta, timeMs: number): number {
  const f = (timeMs - HISTORY_START) / (HISTORY_END - HISTORY_START);
  const phase = (hashSeed(meta.symbol) % 628) / 100;
  const wobble =
    0.16 * Math.sin(f * Math.PI * 2 * 2.3 + phase) + 0.07 * Math.sin(f * Math.PI * 2 * 7.1 + phase * 2);
  return meta.basePrice * Math.exp(meta.yearDrift * f + wobble);
}

/** Справочник символа; неизвестный получает рынок вокруг цены первой сделки по нему. */
export function symbolMeta(symbol: string, referencePrice = 1): SymbolMeta {
  let meta = metas.get(symbol) ?? SYMBOLS.find((s) => s.symbol === symbol);
  if (!meta) meta = { symbol, basePrice: referencePrice, weight: 2, yearDrift: 0 };
  metas.set(symbol, meta);
  return meta;
}

/** Знаков цены — по самой низкой цене за историю, чтобы хватило на весь график. */
export function symbolDecimals(symbol: string): number {
  let digits = decimals.get(symbol);
  if (digits === undefined) {
    const meta = symbolMeta(symbol);
    let low = Infinity;
    for (let t = LISTING_TIME; t <= TODAY + 30 * DAY_MS; t += 7 * DAY_MS) {
      low = Math.min(low, symbolPriceAt(meta, t));
    }
    digits = priceDecimals(low * 0.9);
    decimals.set(symbol, digits);
  }
  return digits;
}

/** Цена символа в момент времени: тренд × фрактальный шум (броуновское движение). */
export function marketPrice(symbol: string, time: number): number {
  return symbolPriceAt(symbolMeta(symbol), time) * Math.exp(noise(hashSeed(symbol), time));
}

/** Объём свечи: оборот по весу символа, лог-нормальный шум и дневной ритм. */
export function marketVolume(symbol: string, timeframe: Timeframe, open: number): number {
  const meta = symbolMeta(symbol);
  const step = TIMEFRAME_MS[timeframe];
  const notional = 250_000 * meta.weight * (step / 60_000);
  const seed = hashSeed(`${symbol}:volume:${timeframe}`);
  const shock = Math.exp(0.5 * (lattice(seed, open / step) + lattice(seed ^ 0x5bd1e995, open / step)));
  // Днём по UTC (Европа и США) торгуют активнее.
  const hour = (open % DAY_MS) / 3_600_000;
  const rhythm = 0.8 + 0.3 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
  return Number(((notional / symbolPriceAt(meta, open)) * shock * rhythm).toFixed(3));
}

export function roundTo(price: number, digits: number): number {
  return Number(price.toFixed(digits));
}

/**
 * Свечи рынка с `first` по `last` (времена открытия, включительно);
 * бар, в котором лежит `now`, — текущий: он собран по секундам до `now`.
 */
export function marketCandles(
  symbol: string,
  timeframe: Timeframe,
  first: number,
  last: number,
  now: number,
): Candle[] {
  const step = TIMEFRAME_MS[timeframe];
  const liveOpen = barOpenTime(now, timeframe);
  const rows: Candle[] = [];
  for (let open = first; open <= last && open <= liveOpen; open += step) {
    rows.push(
      open === liveOpen
        ? new LiveCandleTracker(symbol, timeframe).advance(now)
        : closedCandle(symbol, timeframe, open),
    );
  }
  return rows;
}

/**
 * Текущая свеча, как её собирает биржевой поток: open — цена на открытии
 * бара, high/low — по отсчётам сетки до `now`, close — цена на `now`.
 * Сетка инкрементальная, поэтому поток не пересчитывает бар с начала.
 */
export class LiveCandleTracker {
  private open = -1;
  private sampled = 0;
  private first = 0;
  private high = 0;
  private low = 0;

  constructor(
    private readonly symbol: string,
    private readonly timeframe: Timeframe,
  ) {}

  advance(now: number): Candle {
    const step = TIMEFRAME_MS[this.timeframe];
    const open = barOpenTime(now, this.timeframe);
    if (open !== this.open) {
      this.open = this.sampled = open;
      this.first = this.high = this.low = marketPrice(this.symbol, open);
    }
    // 1 с на часовике и мельче, 24 с на дневке — до 3600 отсчётов на бар.
    const grid = Math.max(1000, step / 3600);
    for (let t = this.sampled + grid; t <= now; t += grid) {
      this.take(marketPrice(this.symbol, t));
      this.sampled = t;
    }
    const close = marketPrice(this.symbol, Math.floor(now / 1000) * 1000);
    this.take(close);
    const digits = symbolDecimals(this.symbol);
    const volume = marketVolume(this.symbol, this.timeframe, open) * ((now - open) / step);
    return [
      open,
      roundTo(this.first, digits),
      roundTo(this.high, digits),
      roundTo(this.low, digits),
      roundTo(close, digits),
      Number(volume.toFixed(3)),
    ];
  }

  private take(price: number): void {
    if (price > this.high) this.high = price;
    if (price < this.low) this.low = price;
  }
}

function closedCandle(symbol: string, timeframe: Timeframe, open: number): Candle {
  const step = TIMEFRAME_MS[timeframe];
  const first = marketPrice(symbol, open);
  let high = first;
  let low = first;
  let close = first;
  for (let j = 1; j <= CANDLE_SAMPLES; j++) {
    close = marketPrice(symbol, open + (step * j) / CANDLE_SAMPLES);
    high = Math.max(high, close);
    low = Math.min(low, close);
  }
  // Колебания мельче шага отсчётов не попали в high/low — дорисовываем фитили.
  const seed = hashSeed(`${symbol}:wick`);
  const wick = SIGMA * Math.sqrt(step / CANDLE_SAMPLES / 1000);
  high *= 1 + wick * Math.abs(lattice(seed, open / step));
  low *= 1 - wick * Math.abs(lattice(seed ^ 0x27d4eb2d, open / step));
  const digits = symbolDecimals(symbol);
  return [
    open,
    roundTo(first, digits),
    roundTo(high, digits),
    roundTo(low, digits),
    roundTo(close, digits),
    marketVolume(symbol, timeframe, open),
  ];
}

/** Фрактальный шум лог-цены: сумма октав value noise с амплитудой ∝ √периода. */
function noise(seed: number, time: number): number {
  let sum = 0;
  for (let k = 0; k < OCTAVES; k++) {
    const x = time / (BASE_PERIOD_MS * 2 ** k);
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    const octaveSeed = seed ^ Math.imul(k + 1, 0x9e3779b9);
    const a = lattice(octaveSeed, i);
    sum += AMPLITUDES[k] * (a + (lattice(octaveSeed, i + 1) - a) * s);
  }
  return sum;
}

/** Детерминированное значение узла решётки в [−1, 1]. */
function lattice(seed: number, index: number): number {
  let h = Math.imul(Math.floor(index) | 0, 0x27d4eb2d) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
