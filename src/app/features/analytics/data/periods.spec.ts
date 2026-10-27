import { afterEach, describe, expect, it } from 'vitest';
import { currentPeriodNet, greenStreak, periodKey, periodLabel, periodSummaries, weekStart } from './periods';
import {
  Trade,
  configureMoneyMask,
  formatMoney,
  formatMoneyAxis,
  formatQuantity,
} from '../../trades/data/trade.model';

let seq = 0;

/** Закрытая сделка с нетто `pnl`, закрыта в полдень дня `day` (локально). */
function closedOn(day: string, pnl: number): Trade {
  const closed = new Date(`${day}T12:00:00`);
  return {
    id: `p-${++seq}`,
    accountId: 'acc',
    symbol: 'BTCUSDT',
    side: 'long',
    status: 'closed',
    carriedIn: false,
    openedAt: new Date(closed.getTime() - 600_000).toISOString(),
    closedAt: closed.toISOString(),
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
  };
}

describe('periods', () => {
  it('неделя начинается в понедельник, подпись — по-русски', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // воскресенье → понедельник
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(periodKey('2026-10-21', 'week')).toBe('w:2026-10-19');
    expect(periodLabel('w:2026-10-19')).toBe('19–25 окт');
    expect(periodLabel('w:2026-09-28')).toBe('28 сен – 4 окт');
    expect(periodLabel('m:2026-10')).toBe('Октябрь 2026');
  });

  it('итоги недель: сумма, дни в плюсе, сравнение с прошлой, текущая', () => {
    const trades = [
      closedOn('2026-10-12', 10),
      closedOn('2026-10-13', -4),
      closedOn('2026-10-20', 7),
      closedOn('2026-10-22', 5),
      closedOn('2026-10-27', -2),
    ];
    const weeks = periodSummaries(trades, new Map(), 'week', '2026-10-27');
    expect(weeks.map((w) => w.key)).toEqual(['w:2026-10-26', 'w:2026-10-19', 'w:2026-10-12']);
    const [current, last, first] = weeks;
    expect(current.isCurrent).toBe(true);
    expect(last.net).toBeCloseTo(12);
    expect(last.greenDays).toBe(2);
    expect(last.deltaNet).toBeCloseTo(6);
    expect(first.deltaNet).toBeNull();
    expect(last.bars).toHaveLength(7);
    expect(last.bars[0].value).toBeNull(); // понедельник 19-го — без сделок
    expect(last.bars[1].value).toBeCloseTo(7); // вторник 20-го
    expect(greenStreak(weeks)).toBe(2);
  });

  it('итог текущего месяца', () => {
    const trades = [closedOn('2026-09-30', 100), closedOn('2026-10-02', 3), closedOn('2026-10-27', -1)];
    expect(currentPeriodNet(trades, 'month', '2026-10-27')).toBeCloseTo(2);
  });
});

describe('скрытые суммы', () => {
  afterEach(() => configureMoneyMask(() => false));

  it('деньги и объёмы — точками, знак остаётся, ось без подписей', () => {
    configureMoneyMask(() => true);
    expect(formatMoney(-12.5)).toBe('−$•••');
    expect(formatMoney(8, { sign: true })).toBe('+$•••');
    expect(formatQuantity(1.5)).toBe('•••');
    expect(formatMoneyAxis(500)).toBe('');
  });

  it('по умолчанию суммы видны', () => {
    expect(formatMoney(-12.5)).toBe('−$12,50');
  });
});
