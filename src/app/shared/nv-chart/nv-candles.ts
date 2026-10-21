import type { CandleBar, CandleSeries } from '@nv/core';
import type { Candle } from '../../core/market/market.model';
import { CandleMeta } from './nv-chart.types';

export function candleMeta(decimals: number, intervalMs: number): CandleMeta {
  return { decimals, tickSize: 10 ** -decimals, intervalMs };
}

/** Строки свечей → колонки движка (цены в тиках); повторы и откаты времени отбрасываются. */
export function toCandleSeries(rows: readonly Candle[], meta: CandleMeta): CandleSeries {
  const count = rows.length;
  const time = new Float64Array(count);
  const open = new Int32Array(count);
  const high = new Int32Array(count);
  const low = new Int32Array(count);
  const close = new Int32Array(count);
  const volume = new Float32Array(count);
  const scale = 10 ** meta.decimals;
  let used = 0;
  let last = -Infinity;
  for (const row of rows) {
    if (!(row[0] > last)) continue;
    last = row[0];
    time[used] = row[0];
    open[used] = Math.round(row[1] * scale);
    high[used] = Math.round(row[2] * scale);
    low[used] = Math.round(row[3] * scale);
    close[used] = Math.round(row[4] * scale);
    volume[used] = row[5] ?? 0;
    used += 1;
  }
  return {
    rows: used,
    intervalMs: meta.intervalMs,
    tickSize: meta.tickSize,
    pricePrecision: meta.decimals,
    time: time.subarray(0, used),
    open: open.subarray(0, used),
    high: high.subarray(0, used),
    low: low.subarray(0, used),
    close: close.subarray(0, used),
    volume: volume.subarray(0, used),
  };
}

export function toCandleBar(row: Candle, meta: CandleMeta): CandleBar {
  const scale = 10 ** meta.decimals;
  return {
    time: row[0],
    open: Math.round(row[1] * scale),
    high: Math.round(row[2] * scale),
    low: Math.round(row[3] * scale),
    close: Math.round(row[4] * scale),
    volume: row[5] ?? 0,
  };
}

/** Самые мелкие цены — до 10 знаков; больше Int32-тиков движок не держит. */
const MAX_DECIMALS = 10;
const MAX_TICKS = 1.5e9;

/**
 * Знаков после запятой у цен свечей: по отсчётам с начала и конца ряда,
 * не больше, чем помещается в Int32-тики при максимальной цене.
 */
export function candleDecimals(rows: readonly Candle[]): number {
  let digits = 0;
  let peak = 0;
  const sample = rows.length > 600 ? [...rows.slice(0, 300), ...rows.slice(-300)] : rows;
  for (const row of sample) {
    for (let k = 1; k <= 4; k++) {
      digits = Math.max(digits, decimalsOf(row[k]));
      peak = Math.max(peak, Math.abs(row[k]));
    }
  }
  while (digits > 0 && peak * 10 ** digits > MAX_TICKS) digits--;
  return digits;
}

function decimalsOf(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  for (let digits = 0; digits < MAX_DECIMALS; digits++) {
    const scaled = Math.abs(value) * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-7 * Math.max(1, scaled)) return digits;
  }
  return MAX_DECIMALS;
}
