import { describe, expect, it } from 'vitest';
import { TIMEFRAME_MS, barOpenTime } from '../market/market.model';
import { Trade } from '../../features/trades/data/trade.model';
import { LiveCandleTracker, marketCandles } from './mock-market';
import { generateTradeCandles } from './mock-candles';

const NOW = Date.UTC(2026, 9, 20, 10, 31, 17);

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-9',
    accountId: 'acc',
    symbol: 'BTCUSDT',
    market: 'futures',
    side: 'long',
    leverage: 10,
    quantity: 0.5,
    entryPrice: 98_000,
    exitPrice: 98_600,
    stopLoss: 97_500,
    takeProfit: 99_000,
    riskUsd: 250,
    status: 'closed',
    openedAt: '2026-10-19T08:10:00.000Z',
    closedAt: '2026-10-19T09:40:00.000Z',
    fees: 0,
    funding: 0,
    strategy: '',
    timeframe: '5m',
    setupGrade: null,
    mistakes: [],
    tags: [],
    notes: '',
    ...overrides,
  };
}

describe('mock market', () => {
  it('ends with the live candle the stream would send', () => {
    const step = TIMEFRAME_MS['15m'];
    const live = barOpenTime(NOW, '15m');
    const rows = marketCandles('ETHUSDT', '15m', live - 3 * step, live, NOW);
    expect(rows.map((r) => r[0])).toEqual([live - 3 * step, live - 2 * step, live - step, live]);
    expect(rows[3]).toEqual(new LiveCandleTracker('ETHUSDT', '15m').advance(NOW));
  });

  it('keeps candles continuous: a close is the next open', () => {
    const rows = marketCandles('SOLUSDT', '1h', NOW - 50 * 3_600_000, NOW, NOW);
    for (let i = 1; i < rows.length; i++) expect(rows[i][1]).toBe(rows[i - 1][4]);
    for (const [, o, h, l, c] of rows) {
      expect(h).toBeGreaterThanOrEqual(Math.max(o, c));
      expect(l).toBeLessThanOrEqual(Math.min(o, c));
    }
  });
});

describe('trade candles', () => {
  it('reach the live candle and put every fill inside its candle', () => {
    const data = generateTradeCandles(makeTrade(), '5m', NOW);
    const last = data.candles[data.candles.length - 1];
    expect(last[0]).toBe(barOpenTime(NOW, '5m'));
    expect(last).toEqual(new LiveCandleTracker('BTCUSDT', '5m').advance(NOW));
    for (const fill of data.fills) {
      const candle = data.candles.find((c) => c[0] === barOpenTime(fill.time, '5m'))!;
      expect(fill.price).toBeLessThanOrEqual(candle[2]);
      expect(fill.price).toBeGreaterThanOrEqual(candle[3]);
    }
  });

  it('blend into the market: history pages before the window are plain market candles', () => {
    const data = generateTradeCandles(makeTrade(), '5m', NOW);
    const first = data.candles[0];
    const page = marketCandles('BTCUSDT', '5m', first[0] - 5 * 300_000, first[0], NOW);
    expect(page[page.length - 1]).toEqual(first);
  });
});
