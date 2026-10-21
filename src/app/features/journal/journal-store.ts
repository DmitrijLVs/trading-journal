import { Injectable, computed, inject } from '@angular/core';
import { TradesStore } from '../trades/trades-store';
import { Trade, calculatePnl } from '../trades/data/trade.model';

export interface JournalDay {
  date: string;
  pnl: number;
  trades: readonly Trade[];
  wins: number;
}

/** Журнал дней: торговые дни текущего скоупа (по дате закрытия сделок, UTC). */
@Injectable({ providedIn: 'root' })
export class JournalStore {
  private readonly tradesStore = inject(TradesStore);

  readonly isLoading = this.tradesStore.isLoading;

  /** Дни с закрытыми сделками, новые сверху. */
  readonly days = computed<readonly JournalDay[]>(() => {
    const byDate = new Map<string, JournalDay>();
    for (const trade of this.tradesStore.scoped()) {
      if (trade.status !== 'closed') continue;
      const date = trade.closedAt.slice(0, 10);
      const day = byDate.get(date) ?? { date, pnl: 0, trades: [], wins: 0 };
      const pnl = calculatePnl(trade);
      byDate.set(date, {
        ...day,
        pnl: day.pnl + pnl,
        wins: day.wins + (pnl > 1 ? 1 : 0),
        trades: [...day.trades, trade],
      });
    }
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  });
}
