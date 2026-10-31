import { describe, expect, it } from 'vitest';
import { dayFacts, priceAction, tradeFacts } from './ai-facts';
import { DEFAULT_DISCIPLINE } from './discipline.model';
import { Trade } from '../../trades/data/trade.model';

const T0 = Date.parse('2026-10-31T10:00:00Z');

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-1',
    accountId: 'acc',
    symbol: 'BTCUSDT',
    side: 'long',
    status: 'closed',
    carriedIn: false,
    openedAt: new Date(T0 + 1000).toISOString(),
    closedAt: new Date(T0 + 3000).toISOString(),
    quantity: 1,
    entryPrice: 100,
    exitPrice: 101,
    realizedPnl: 1,
    fees: 0.1,
    feesOther: {},
    funding: 0,
    netPnl: 0.9,
    fillsCount: 2,
    openOrderType: 'market',
    closeOrderType: 'market',
    ...overrides,
  };
}

/** Секундные свечи: [время, o, h, l, c, v]. */
const candles = [
  [T0, 100, 100.5, 99.5, 100, 1],
  [T0 + 1000, 100, 102, 99, 101, 1], // вход
  [T0 + 2000, 101, 103, 100, 102, 1],
  [T0 + 3000, 102, 102, 98, 101, 1], // выход
  [T0 + 4000, 101, 104, 101, 103, 1],
  [T0 + 5000, 103, 105, 103, 104, 1],
];

describe('ai facts', () => {
  it('measures how far price went for and against a long, and after the exit', () => {
    const pa = priceAction(trade(), candles, '1s');
    expect(pa).toEqual({
      timeframe: '1s',
      maxFavorablePct: 3,
      maxAdversePct: -2,
      afterExitPct: 2.97,
      afterExitBars: 10,
    });
  });

  it('flips the signs for a short', () => {
    const pa = priceAction(trade({ side: 'short', exitPrice: 99 }), candles, '1s');
    expect(pa?.maxFavorablePct).toBe(2);
    expect(pa?.maxAdversePct).toBe(-3);
    expect(pa?.afterExitPct).toBe(-5.051);
  });

  it('has no price action without an entry price', () => {
    expect(priceAction(trade({ entryPrice: null }), candles, '1s')).toBeNull();
  });

  it('puts the day before the entry into the trade context', () => {
    const before = trade({ id: 'p', netPnl: -5, closedAt: new Date(T0 - 120_000).toISOString() });
    const facts = tradeFacts({
      trade: trade(),
      marks: [],
      manualTags: ['пробой'],
      fills: [],
      priceAction: null,
      previous: [before],
      rules: DEFAULT_DISCIPLINE,
    });
    expect(facts['manualTags']).toEqual(['пробой']);
    expect(facts['context']).toMatchObject({ tradesEarlierToday: 1, netEarlierTodayUsd: -5 });
  });

  it('summarizes a day: drawdown from the peak and the longest losing streak', () => {
    const pnls = [10, -4, -3, -6, 2];
    const trades = pnls.map((pnl, i) =>
      trade({ id: `d${i}`, netPnl: pnl, realizedPnl: pnl, closedAt: new Date(T0 + i * 60_000).toISOString() }),
    );
    const facts = dayFacts({
      date: '2026-10-31',
      trades,
      marksOf: () => [],
      manualTagsOf: () => [],
      rules: DEFAULT_DISCIPLINE,
    });
    expect(facts).toMatchObject({ trades: 5, wins: 2, losses: 3, netPnlUsd: -1, maxIntradayDrawdownUsd: -13, longestLossStreak: 3 });
  });
});
