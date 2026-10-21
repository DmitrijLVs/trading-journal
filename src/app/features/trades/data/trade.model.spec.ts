import { describe, expect, it } from 'vitest';
import {
  Trade,
  calculatePnl,
  calculatePnlPercent,
  formatFeesOther,
  notional,
  tradeCosts,
  tradingSession,
} from './trade.model';

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: '1',
    accountId: 'acc',
    symbol: 'BTCUSDT',
    side: 'long',
    status: 'closed',
    carriedIn: false,
    openedAt: '2026-01-05T10:00:00Z',
    closedAt: '2026-01-05T14:00:00Z',
    quantity: 1,
    entryPrice: 100,
    exitPrice: 110,
    realizedPnl: 10,
    fees: 1,
    feesOther: {},
    funding: -0.5,
    netPnl: 8.5,
    fillsCount: 2,
    ...overrides,
  };
}

describe('calculatePnl', () => {
  it('берёт нетто биржи как есть (realized − комиссия + фандинг)', () => {
    expect(calculatePnl(makeTrade())).toBe(8.5);
  });

  it('открытая сделка — ноль: итог ещё не известен', () => {
    expect(calculatePnl(makeTrade({ status: 'open', closedAt: '', netPnl: 3 }))).toBe(0);
  });
});

describe('tradeCosts', () => {
  it('комиссия плюс уплаченный фандинг, полученный — уменьшает издержки', () => {
    expect(tradeCosts(makeTrade())).toBe(1.5);
    expect(tradeCosts(makeTrade({ funding: 0.4 }))).toBeCloseTo(0.6);
  });
});

describe('calculatePnlPercent', () => {
  it('движение цены без плеча, со знаком направления', () => {
    expect(calculatePnlPercent(makeTrade())).toBeCloseTo(10);
    expect(calculatePnlPercent(makeTrade({ side: 'short', exitPrice: 90 }))).toBeCloseTo(10);
  });

  it('вход до начала истории — движения не посчитать', () => {
    expect(calculatePnlPercent(makeTrade({ carriedIn: true, entryPrice: null }))).toBe(0);
  });
});

describe('notional', () => {
  it('по цене входа, а без неё — по цене выхода', () => {
    expect(notional(makeTrade({ quantity: 2 }))).toBe(200);
    expect(notional(makeTrade({ entryPrice: null, quantity: 2 }))).toBe(220);
  });
});

describe('formatFeesOther', () => {
  it('комиссии в нестейблах одной строкой', () => {
    expect(formatFeesOther(makeTrade({ feesOther: { BNB: 0.0021 } }))).toBe('0.0021 BNB');
    expect(formatFeesOther(makeTrade())).toBe('');
  });
});

describe('tradingSession', () => {
  it('определяет сессию по часу открытия (UTC)', () => {
    expect(tradingSession('2026-01-05T03:00:00Z')).toBe('asia');
    expect(tradingSession('2026-01-05T09:00:00Z')).toBe('london');
    expect(tradingSession('2026-01-05T15:00:00Z')).toBe('newyork');
    expect(tradingSession('2026-01-05T22:00:00Z')).toBe('off');
  });
});
