import { describe, expect, it } from 'vitest';
import { dailyPnl, equityCurve, groupBy, summarize } from './metrics';
import { Trade } from '../../trades/data/trade.model';

let seq = 0;

function closedTrade(pnl: number, overrides: Partial<Trade> = {}): Trade {
  // Сделка с заданным нетто: объём 1, комиссий и фандинга нет.
  const entry = 100;
  return {
    id: `t-${++seq}`,
    accountId: 'acc',
    symbol: 'BTCUSDT',
    side: 'long',
    status: 'closed',
    carriedIn: false,
    openedAt: `2026-01-0${(seq % 5) + 1}T10:00:00Z`,
    closedAt: `2026-01-0${(seq % 5) + 1}T12:00:00Z`,
    quantity: 1,
    entryPrice: entry,
    exitPrice: entry + pnl,
    realizedPnl: pnl,
    fees: 0,
    feesOther: {},
    funding: 0,
    netPnl: pnl,
    fillsCount: 2,
    ...overrides,
  };
}

describe('summarize', () => {
  it('считает винрейт, профит-фактор и матожидание', () => {
    const trades = [closedTrade(30), closedTrade(10), closedTrade(-20)];
    const s = summarize(trades);
    expect(s.tradeCount).toBe(3);
    expect(s.winCount).toBe(2);
    expect(s.lossCount).toBe(1);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.netPnl).toBeCloseTo(20);
    expect(s.profitFactor).toBeCloseTo(40 / 20);
    expect(s.expectancyUsd).toBeCloseTo(20 / 3);
  });

  it('сделки «в ноль» не считаются ни победой, ни поражением', () => {
    const s = summarize([closedTrade(0.5), closedTrade(20)]);
    expect(s.breakevenCount).toBe(1);
    expect(s.winRate).toBe(1);
  });

  it('открытые сделки не входят в статистику', () => {
    const open = closedTrade(0, { status: 'open', exitPrice: null, closedAt: '' });
    const s = summarize([open, closedTrade(10)]);
    expect(s.tradeCount).toBe(1);
    expect(s.openCount).toBe(1);
  });
});

describe('equityCurve', () => {
  it('накапливает P&L и считает просадку от пика', () => {
    const trades = [
      closedTrade(50, { closedAt: '2026-01-01T10:00:00Z' }),
      closedTrade(-30, { closedAt: '2026-01-02T10:00:00Z' }),
      closedTrade(10, { closedAt: '2026-01-03T10:00:00Z' }),
    ];
    const curve = equityCurve(trades);
    expect(curve.map((p) => p.equity)).toEqual([50, 20, 30]);
    expect(curve.map((p) => p.drawdown)).toEqual([0, 30, 20]);
  });
});

describe('dailyPnl', () => {
  it('агрегирует по дате закрытия', () => {
    const trades = [
      closedTrade(10, { closedAt: '2026-01-01T10:00:00Z' }),
      closedTrade(15, { closedAt: '2026-01-01T18:00:00Z' }),
      closedTrade(-5, { closedAt: '2026-01-02T10:00:00Z' }),
    ];
    const days = dailyPnl(trades);
    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({ date: '2026-01-01', pnl: 25, count: 2, wins: 2 });
  });
});

describe('groupBy', () => {
  it('раскрывает массивные ключи по отдельности', () => {
    const trades = [closedTrade(10, { symbol: 'BTCUSDT' }), closedTrade(20, { symbol: 'ETHUSDT' })];
    const groups = groupBy(trades, (t) => [t.symbol, 'все']);
    expect(groups.find((g) => g.key === 'все')?.pnl).toBe(30);
    expect(groups.find((g) => g.key === 'ETHUSDT')?.pnl).toBe(20);
  });
});

describe('summarize: комиссии и фандинг', () => {
  it('валовый P&L — нетто плюс комиссии минус полученный фандинг', () => {
    const s = summarize([closedTrade(9, { realizedPnl: 10, fees: 1.5, funding: 0.5 })]);
    expect(s.grossPnl).toBeCloseTo(10);
    expect(s.fees).toBeCloseTo(1.5);
    expect(s.funding).toBeCloseTo(0.5);
  });
});
