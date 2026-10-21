import { HttpParams, httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';
import { BalancePoint, OpenPosition, PortfolioOverview } from './portfolio.model';

/** Чей портфель: пользователь и счёт (null — все счета). */
export interface PortfolioScope {
  owner: string;
  accountId: string | null;
}

interface OverviewDto {
  positions: { count: number; unrealized_pnl: string | null } | null;
  balance: { wallet_balance: string; updated_at: string } | null;
}

interface PortfolioDto {
  series: { day: string; balance: string }[];
}

interface PositionDto {
  account_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  qty: string;
  entry_price: string;
  unrealized_pnl: string;
  updated_at: string;
  open_trade_id: number | null;
}

/** Баланс и позиции: Stats-Service (`/stats/*`) и открытые позиции журнала. */
@Injectable({ providedIn: 'root' })
export class PortfolioApi {
  overview(scope: Signal<PortfolioScope | undefined>) {
    return httpResource<PortfolioOverview>(
      () => {
        const s = scope();
        return s ? { url: '/stats/overview', params: scopeParams(s).set('tz', userTimeZone()) } : undefined;
      },
      {
        parse: (raw) => {
          const dto = raw as OverviewDto;
          return {
            walletBalance: dto.balance ? Number(dto.balance.wallet_balance) : null,
            unrealizedPnl: Number(dto.positions?.unrealized_pnl ?? 0),
            openPositions: dto.positions?.count ?? 0,
          };
        },
      },
    );
  }

  /** Баланс кошелька на конец каждого UTC-дня за всю историю журнала. */
  balanceHistory(scope: Signal<PortfolioScope | undefined>) {
    return httpResource<BalancePoint[]>(
      () => {
        const s = scope();
        return s ? { url: '/stats/portfolio', params: scopeParams(s).set('days', 183) } : undefined;
      },
      {
        parse: (raw) =>
          (raw as PortfolioDto).series.map((p) => ({ day: p.day, balance: Number(p.balance) })),
      },
    );
  }

  positions(scope: Signal<PortfolioScope | undefined>) {
    return httpResource<OpenPosition[]>(
      () => {
        const s = scope();
        return s ? { url: '/journal/positions', params: scopeParams(s) } : undefined;
      },
      {
        parse: (raw) =>
          (raw as PositionDto[]).map((p) => ({
            accountId: p.account_id,
            symbol: p.symbol,
            side: p.direction === 'SHORT' ? 'short' : 'long',
            quantity: Math.abs(Number(p.qty)),
            entryPrice: Number(p.entry_price),
            unrealizedPnl: Number(p.unrealized_pnl),
            updatedAt: p.updated_at,
            tradeId: p.open_trade_id === null ? null : String(p.open_trade_id),
          })),
      },
    );
  }
}

function scopeParams(scope: PortfolioScope): HttpParams {
  const params = new HttpParams();
  return scope.accountId ? params.set('account_id', scope.accountId) : params;
}

/** «Сегодня» и календарь статистики — в зоне пользователя. */
function userTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
