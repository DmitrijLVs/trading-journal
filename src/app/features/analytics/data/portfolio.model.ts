import { TradeSide } from '../../trades/data/trade.model';

export interface PortfolioOverview {
  /** Сумма walletBalance стейблов; null — рекордер ещё не прислал баланс. */
  walletBalance: number | null;
  /** Нереализованный P&L, как его отдала биржа (не по тикам цены). */
  unrealizedPnl: number;
  openPositions: number;
}

export interface BalancePoint {
  /** YYYY-MM-DD, UTC. */
  day: string;
  balance: number;
}

/** Открытая позиция по данным биржи (`/journal/positions`). */
export interface OpenPosition {
  accountId: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  unrealizedPnl: number;
  updatedAt: string;
  /** Открытая сделка журнала этой позиции. */
  tradeId: string | null;
}

/** Баланс на начало дня `ms`: последний известный до него, иначе — первый в ряду. */
export function balanceAt(series: readonly BalancePoint[], ms: number): number | null {
  if (series.length === 0) return null;
  const day = new Date(ms).toISOString().slice(0, 10);
  let value: number | null = null;
  for (const point of series) {
    if (point.day >= day) break;
    value = point.balance;
  }
  return value ?? series[0].balance;
}
