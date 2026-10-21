import { describe, expect, it } from 'vitest';
import { balanceAt } from './portfolio.model';

describe('balanceAt', () => {
  const series = [
    { day: '2026-09-25', balance: 1300 },
    { day: '2026-09-26', balance: 1150 },
    { day: '2026-09-27', balance: 1350 },
  ];

  it('баланс на начало дня — конец предыдущего', () => {
    expect(balanceAt(series, Date.parse('2026-09-27T12:00:00Z'))).toBe(1150);
  });

  it('до начала ряда — первое известное значение, пустой ряд — null', () => {
    expect(balanceAt(series, Date.parse('2026-01-01T00:00:00Z'))).toBe(1300);
    expect(balanceAt([], Date.now())).toBeNull();
  });
});
