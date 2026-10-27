import { describe, expect, it } from 'vitest';
import { autoTags, lossStreakBefore, tagsOf } from './behavior';
import { costBreakdown } from './costs';
import { DEFAULT_DISCIPLINE } from './discipline.model';
import { daySummary } from './session';
import { Trade, localDay } from '../../trades/data/trade.model';

let seq = 0;

/** Сделка с нетто `pnl`, открыта в `open` и закрыта через `minutes` минут. */
function trade(pnl: number, open: string, minutes = 5, overrides: Partial<Trade> = {}): Trade {
  const opened = new Date(open);
  return {
    id: `t-${++seq}`,
    accountId: 'acc',
    symbol: 'BTCUSDT',
    side: 'long',
    status: 'closed',
    carriedIn: false,
    openedAt: opened.toISOString(),
    closedAt: new Date(opened.getTime() + minutes * 60_000).toISOString(),
    quantity: 1,
    entryPrice: 100,
    exitPrice: 100 + pnl,
    realizedPnl: pnl,
    fees: 0,
    feesOther: {},
    funding: 0,
    netPnl: pnl,
    fillsCount: 2,
    openOrderType: 'market',
    closeOrderType: 'market',
    ...overrides,
  };
}

const rules = DEFAULT_DISCIPLINE;

describe('autoTags', () => {
  it('реванш — вход в ту же монету вскоре после убытка', () => {
    const loss = trade(-10, '2026-03-02T10:00:00');
    const revenge = trade(5, '2026-03-02T10:08:00');
    const other = trade(5, '2026-03-02T10:08:00', 5, { symbol: 'ETHUSDT' });
    const late = trade(5, '2026-03-02T11:00:00');
    const tags = autoTags([loss, revenge, other, late], rules);
    expect(tagsOf(tags, revenge)).toContain('revenge');
    expect(tagsOf(tags, other)).not.toContain('revenge');
    expect(tagsOf(tags, late)).not.toContain('revenge');
  });

  it('тильт — вход после серии убытков без паузы', () => {
    const a = trade(-5, '2026-03-03T10:00:00', 1, { symbol: 'AAA' });
    const b = trade(-5, '2026-03-03T10:05:00', 1, { symbol: 'BBB' });
    const c = trade(3, '2026-03-03T10:30:00', 1, { symbol: 'CCC' });
    const tags = autoTags([a, b, c], rules);
    expect(tagsOf(tags, c)).toContain('tilt');
    expect(tagsOf(tags, b)).not.toContain('tilt');
  });

  it('овертрейд — сделки сверх дневной нормы', () => {
    const day = Array.from({ length: 4 }, (_, i) =>
      trade(1, `2026-03-04T1${i}:00:00`, 1, { symbol: `S${i}` }),
    );
    const tags = autoTags(day, { ...rules, maxTrades: 2 });
    expect(day.map((t) => tagsOf(tags, t).includes('overtrade'))).toEqual([false, false, true, true]);
  });

  it('съедено комиссией — до комиссий плюс, после минус', () => {
    const t = trade(-0.2, '2026-03-05T10:00:00', 5, { realizedPnl: 0.3, fees: 0.5 });
    expect(tagsOf(autoTags([t], rules), t)).toContain('fee-eaten');
  });
});

describe('lossStreakBefore', () => {
  it('считает убытки, закрытые до входа, и сбрасывается на прибыли', () => {
    const a = trade(-5, '2026-03-06T10:00:00', 1);
    const b = trade(-5, '2026-03-06T10:02:00', 1);
    const c = trade(5, '2026-03-06T10:04:00', 1);
    const d = trade(1, '2026-03-06T10:06:00', 1);
    const streaks = lossStreakBefore([a, b, c, d]);
    expect(streaks.get(c.id)?.count).toBe(2);
    expect(streaks.get(d.id)?.count).toBe(0);
  });
});

describe('costBreakdown', () => {
  it('валовый результат, комиссии и доля маркет-сделок', () => {
    const trades = [
      trade(9, '2026-03-07T10:00:00', 5, { realizedPnl: 10, fees: 1 }),
      trade(-3, '2026-03-07T11:00:00', 5, { realizedPnl: -2, fees: 1, openOrderType: 'limit' }),
    ];
    const c = costBreakdown(trades);
    expect(c.gross).toBeCloseTo(8);
    expect(c.fees).toBeCloseTo(2);
    expect(c.net).toBeCloseTo(6);
    expect(c.marketRoundTripShare).toBeCloseTo(0.5);
    expect(c.limitEntries).toBe(1);
  });
});

describe('daySummary', () => {
  it('итог дня и серия убытков в конце дня', () => {
    const day = localDay('2026-03-08T12:00:00');
    const trades = [
      trade(10, '2026-03-08T10:00:00'),
      trade(-4, '2026-03-08T11:00:00'),
      trade(-3, '2026-03-08T12:00:00'),
    ];
    const s = daySummary(trades, day);
    expect(s.net).toBeCloseTo(3);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(2);
    expect(s.lossStreak).toBe(2);
  });
});
