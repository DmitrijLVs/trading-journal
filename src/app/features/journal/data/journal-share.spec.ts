import { afterEach, describe, expect, it } from 'vitest';
import { periodShareCard } from './journal-share';
import { periodSummaries } from '../../analytics/data/periods';
import { tradeShareCard } from '../../trades/data/trade-share';
import { Trade, configureMoneyMask } from '../../trades/data/trade.model';

let seq = 0;

function closedOn(day: string, pnl: number, quantity = 0.5): Trade {
  const closed = new Date(`${day}T12:00:00`);
  return {
    id: `s-${++seq}`,
    accountId: 'acc',
    symbol: 'BTCUSDT',
    side: 'short',
    status: 'closed',
    carriedIn: false,
    openedAt: new Date(closed.getTime() - 3_600_000).toISOString(),
    closedAt: closed.toISOString(),
    quantity,
    entryPrice: 1000,
    exitPrice: 1000 - pnl / quantity,
    realizedPnl: pnl + 1,
    fees: 1,
    feesOther: {},
    funding: 0,
    netPnl: pnl,
    fillsCount: 2,
    openOrderType: 'limit',
    closeOrderType: 'market',
  };
}

/** Весь видимый текст снимка — чтобы проверить, что сумм в нём нет. */
function texts(card: ReturnType<typeof tradeShareCard>): string {
  return [card.title, card.subtitle, card.result.text, card.resultNote ?? '', card.stamp]
    .concat(card.facts.flatMap((f) => [f.value, f.note ?? '']))
    .join(' | ');
}

const ctx = { chart: null, layout: 'card' as const, timeframe: '15m' as const, exchange: 'binance' as const };

describe('снимки', () => {
  afterEach(() => configureMoneyMask(() => false));

  it('сделка: итог в деньгах, ход цены под ним, кадр графика необязателен', () => {
    const card = tradeShareCard(closedOn('2026-11-04', 42.5), { ...ctx, mask: false });
    expect(card.result).toEqual({ text: '+$42,50', tone: 'pos' });
    expect(card.resultNote).toBe('+8,50% ход цены');
    expect(card.badge).toEqual({ text: 'Шорт', tone: 'short' });
    expect(card.visual).toBeNull();
    expect(card.stamp).toBe('Binance · 15m');
  });

  it('сделка со скрытыми суммами: главным становится процент, денег и количества нет', () => {
    const card = tradeShareCard(closedOn('2026-11-04', -42.5), { ...ctx, mask: true });
    expect(card.result).toEqual({ text: '−8,50%', tone: 'neg' });
    const all = texts(card);
    expect(all).not.toMatch(/\$\d/);
    expect(all).not.toContain('0,5');
  });

  it('только график: сделка строкой над графиком, без кадра — обычная карточка', () => {
    const trade = closedOn('2026-11-04', 42.5);
    const chart = { width: 2400, height: 1158 } as HTMLCanvasElement;
    const card = tradeShareCard(trade, { ...ctx, layout: 'chart', chart, mask: false });
    expect(card.layout).toBe('chart');
    expect(card.chip).toBe('15m');
    expect(card.result).toEqual({ text: '+8,50%', tone: 'pos' });
    expect(card.resultNote).toBe('+$42,50');
    expect(card.subtitle).toMatch(/^Binance · .* · 1\s000 → 915$/);

    expect(tradeShareCard(trade, { ...ctx, layout: 'chart', chart, mask: true }).resultNote).toBeUndefined();
    expect(tradeShareCard(trade, { ...ctx, layout: 'chart', mask: false }).layout).toBeUndefined();
  });

  it('переключатель снимка главнее глаза в шапке', () => {
    configureMoneyMask(() => true);
    const card = tradeShareCard(closedOn('2026-11-04', 10), { ...ctx, mask: false });
    expect(card.result.text).toBe('+$10,00');
  });

  it('неделя: столбики дней, сравнение с прошлой — только с суммами', () => {
    const trades = [closedOn('2026-10-27', -5), closedOn('2026-11-03', 20), closedOn('2026-11-05', -8)];
    const [week] = periodSummaries(trades, new Map(), 'week', '2026-11-06');
    const open = periodShareCard(week, false);
    expect(open.result).toEqual({ text: '+$12,00', tone: 'pos' });
    expect(open.resultNote).toBe('+$17,00 к прошлой неделе');
    expect(open.visual?.kind === 'bars' && open.visual.bars.map((b) => b.label)).toEqual([
      'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс',
    ]);

    const hidden = periodShareCard(week, true);
    expect(hidden.resultNote).toBeUndefined();
    expect(hidden.facts.find((f) => f.label === 'Комиссии')?.value).toBe('$•••');
  });

  it('месяц: подписан 1-й и каждый пятый день', () => {
    const [month] = periodSummaries([closedOn('2026-10-14', 3)], new Map(), 'month', '2026-11-06');
    const card = periodShareCard(month, false);
    const labels = card.visual?.kind === 'bars' ? card.visual.bars.map((b) => b.label).filter(Boolean) : [];
    expect(labels).toEqual(['1', '5', '10', '15', '20', '25', '30']);
  });
});
