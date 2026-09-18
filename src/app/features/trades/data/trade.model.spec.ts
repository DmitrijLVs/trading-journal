import { describe, expect, it } from 'vitest';
import {
  Trade,
  calculatePnl,
  calculatePnlPercent,
  calculateRMultiple,
  calculateRoi,
  plannedRiskReward,
  plannedRiskUsd,
  tradingSession,
} from './trade.model';

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't-1',
    accountId: 'acc',
    symbol: 'BTCUSDT',
    market: 'futures',
    side: 'long',
    leverage: 10,
    quantity: 1,
    entryPrice: 100,
    exitPrice: 110,
    stopLoss: 95,
    takeProfit: 120,
    riskUsd: null,
    status: 'closed',
    openedAt: '2026-01-05T10:00:00Z',
    closedAt: '2026-01-05T14:00:00Z',
    fees: 1,
    funding: 0,
    strategy: 'Тест',
    timeframe: '15m',
    setupGrade: null,
    mood: null,
    mistakes: [],
    tags: [],
    notes: '',
    ...overrides,
  };
}

describe('calculatePnl', () => {
  it('лонг: (выход − вход) × объём − комиссии', () => {
    expect(calculatePnl(makeTrade())).toBe(9); // 10 - 1 fee
  });

  it('шорт: прибыль при падении цены', () => {
    expect(calculatePnl(makeTrade({ side: 'short', exitPrice: 90 }))).toBe(9);
  });

  it('открытая сделка — ноль', () => {
    expect(calculatePnl(makeTrade({ status: 'open', exitPrice: 0, closedAt: '' }))).toBe(0);
  });
});

describe('calculatePnlPercent / ROI', () => {
  it('движение цены без плеча', () => {
    expect(calculatePnlPercent(makeTrade())).toBeCloseTo(10);
  });

  it('ROI учитывает маржу (плечо)', () => {
    // margin = 100/10 = 10; pnl = 9 → 90%
    expect(calculateRoi(makeTrade())).toBeCloseTo(90);
  });
});

describe('риск и R-multiple', () => {
  it('риск из стопа: |вход − SL| × объём', () => {
    expect(plannedRiskUsd(makeTrade())).toBe(5);
  });

  it('явный riskUsd важнее стопа', () => {
    expect(plannedRiskUsd(makeTrade({ riskUsd: 50 }))).toBe(50);
  });

  it('R = чистый P&L / риск', () => {
    expect(calculateRMultiple(makeTrade())).toBeCloseTo(9 / 5);
  });

  it('без стопа и риска R не считается', () => {
    expect(calculateRMultiple(makeTrade({ stopLoss: null, riskUsd: null }))).toBeNull();
  });

  it('плановый R:R по TP/SL', () => {
    expect(plannedRiskReward(makeTrade())).toBeCloseTo(4); // reward 20 / risk 5
  });
});

describe('tradingSession', () => {
  it.each([
    ['2026-01-05T03:00:00Z', 'asia'],
    ['2026-01-05T09:00:00Z', 'london'],
    ['2026-01-05T15:00:00Z', 'newyork'],
    ['2026-01-05T22:30:00Z', 'off'],
  ])('%s → %s', (iso, expected) => {
    expect(tradingSession(iso)).toBe(expected);
  });
});
