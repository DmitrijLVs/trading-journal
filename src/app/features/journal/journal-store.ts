import { Injectable, computed, inject } from '@angular/core';
import { JournalApi } from './data/journal-api';
import { JournalEntry } from './data/journal.model';
import { TradesStore } from '../trades/trades-store';
import { Trade, calculatePnl } from '../trades/data/trade.model';

export interface JournalDay {
  date: string;
  pnl: number;
  trades: readonly Trade[];
  wins: number;
  entry: JournalEntry | null;
}

/** Дневник: торговые дни текущего скоупа + заметки к ним. */
@Injectable({ providedIn: 'root' })
export class JournalStore {
  private readonly api = inject(JournalApi);
  private readonly tradesStore = inject(TradesStore);

  private readonly resource = this.api.list();

  readonly isLoading = this.resource.isLoading;
  readonly entries = computed<readonly JournalEntry[]>(() => this.resource.value() ?? []);

  /** Дни с торговлей или заметкой, новые сверху. */
  readonly days = computed<readonly JournalDay[]>(() => {
    const byDate = new Map<string, JournalDay>();

    for (const trade of this.tradesStore.scoped()) {
      if (trade.status !== 'closed') continue;
      const date = trade.closedAt.slice(0, 10);
      const day = byDate.get(date) ?? { date, pnl: 0, trades: [], wins: 0, entry: null };
      const pnl = calculatePnl(trade);
      byDate.set(date, {
        ...day,
        pnl: day.pnl + pnl,
        wins: day.wins + (pnl > 1 ? 1 : 0),
        trades: [...day.trades, trade],
      });
    }

    for (const entry of this.entries()) {
      const day = byDate.get(entry.date);
      if (day) byDate.set(entry.date, { ...day, entry });
      else byDate.set(entry.date, { date: entry.date, pnl: 0, trades: [], wins: 0, entry });
    }

    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  });

  async save(entry: JournalEntry): Promise<void> {
    await this.api.upsert(entry);
    this.resource.reload();
  }
}
