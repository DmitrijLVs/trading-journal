import { Trade, aggregateStats, calculatePnl, calculatePnlPercent } from './trade.model';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    accountId: 'a1',
    symbol: 'AAPL',
    side: 'long',
    quantity: 10,
    entryPrice: 100,
    exitPrice: 110,
    status: 'closed',
    openedAt: '2025-01-01',
    closedAt: '2025-01-02',
    fees: 0,
    strategy: '',
    tags: [],
    notes: '',
    ...overrides,
  };
}

describe('calculatePnl', () => {
  it('returns 0 for open trades', () => {
    expect(calculatePnl(trade({ status: 'open', exitPrice: 0, closedAt: '' }))).toBe(0);
  });

  it('computes long P&L net of fees', () => {
    expect(
      calculatePnl(trade({ side: 'long', quantity: 10, entryPrice: 100, exitPrice: 110, fees: 5 })),
    ).toBe(95);
  });

  it('inverts sign for short trades', () => {
    expect(
      calculatePnl(trade({ side: 'short', quantity: 10, entryPrice: 110, exitPrice: 100 })),
    ).toBe(100);
  });
});

describe('calculatePnlPercent', () => {
  it('returns 0 when entry price is 0', () => {
    expect(calculatePnlPercent(trade({ entryPrice: 0, exitPrice: 100 }))).toBe(0);
  });

  it('returns positive percent on winning long', () => {
    expect(calculatePnlPercent(trade({ side: 'long', entryPrice: 100, exitPrice: 110 }))).toBe(10);
  });
});

describe('aggregateStats', () => {
  it('returns zeros for empty list', () => {
    expect(aggregateStats([])).toEqual({
      count: 0,
      openCount: 0,
      closedCount: 0,
      totalPnl: 0,
      winRate: 0,
      averagePnl: 0,
    });
  });

  it('counts open/closed and totals P&L', () => {
    const stats = aggregateStats([
      trade({ id: '1', exitPrice: 110 }),
      trade({ id: '2', exitPrice: 90 }),
      trade({ id: '3', status: 'open', exitPrice: 0, closedAt: '' }),
    ]);
    expect(stats.count).toBe(3);
    expect(stats.openCount).toBe(1);
    expect(stats.closedCount).toBe(2);
    expect(stats.totalPnl).toBe(0);
    expect(stats.winRate).toBe(0.5);
    expect(stats.averagePnl).toBe(0);
  });
});
