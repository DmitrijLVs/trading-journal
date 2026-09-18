import { Injectable, computed, inject, signal } from '@angular/core';
import { TradesApi } from './data/trades-api';
import { Trade, TradeFilters } from './data/trade.model';
import { AccountsStore } from '../accounts/accounts-store';
import { PeriodStore } from '../../core/state/period-store';
import { summarize } from '../analytics/data/metrics';

/**
 * Все сделки пользователя. «Скоуп» (выбранный счёт + глобальный период)
 * применяется здесь — дашборд, таблица и журнал читают уже готовый срез.
 */
@Injectable({ providedIn: 'root' })
export class TradesStore {
  private readonly api = inject(TradesApi);
  private readonly accountsStore = inject(AccountsStore);
  private readonly periodStore = inject(PeriodStore);

  private readonly resource = this.api.list();

  /** Локальные фильтры страницы «Сделки» (поверх глобального скоупа). */
  private readonly _tableFilters = signal<TradeFilters>({});

  readonly isLoading = this.resource.isLoading;
  readonly hasLoaded = computed(() => this.resource.hasValue());
  readonly error = this.resource.error;
  readonly tableFilters = this._tableFilters.asReadonly();

  readonly all = computed<readonly Trade[]>(() => this.resource.value() ?? []);

  /** Срез только по счёту — для виджетов с собственным периодом. */
  readonly accountScoped = computed<readonly Trade[]>(() => {
    const accountId = this.accountsStore.selectedId();
    if (accountId === 'all') return this.all();
    return this.all().filter((t) => t.accountId === accountId);
  });

  /** Срез по выбранному счёту и периоду. Открытые позиции — всегда в срезе. */
  readonly scoped = computed<readonly Trade[]>(() => {
    const { fromMs, toMs } = this.periodStore.range();
    return this.accountScoped().filter((t) => {
      if (t.status === 'open') return true;
      const closed = new Date(t.closedAt).getTime();
      if (fromMs !== null && closed < fromMs) return false;
      if (toMs !== null && closed > toMs) return false;
      return true;
    });
  });

  readonly openTrades = computed(() => this.scoped().filter((t) => t.status === 'open'));

  readonly summary = computed(() => summarize(this.scoped()));

  /** Справочники для фильтров — по всей истории, не по срезу. */
  readonly symbols = computed(() => unique(this.all().map((t) => t.symbol)));
  readonly strategies = computed(() => unique(this.all().map((t) => t.strategy)));
  readonly tags = computed(() => unique(this.all().flatMap((t) => t.tags)));

  /** Сделки для таблицы: скоуп + локальные фильтры, новые сверху. */
  readonly tableTrades = computed<readonly Trade[]>(() => {
    const f = this._tableFilters();
    const search = f.search?.trim().toLowerCase();
    return this.scoped()
      .filter((t) => {
        if (f.side && t.side !== f.side) return false;
        if (f.status && t.status !== f.status) return false;
        if (f.symbols?.length && !f.symbols.includes(t.symbol)) return false;
        if (f.strategies?.length && !f.strategies.includes(t.strategy)) return false;
        if (f.tags?.length && !f.tags.some((tag) => t.tags.includes(tag))) return false;
        if (f.setupGrades?.length && (t.setupGrade === null || !f.setupGrades.includes(t.setupGrade))) {
          return false;
        }
        if (search) {
          const haystack = `${t.symbol} ${t.strategy} ${t.tags.join(' ')} ${t.notes}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  });

  readonly hasActiveTableFilters = computed(() => {
    const f = this._tableFilters();
    return Boolean(
      f.side ||
        f.status ||
        f.search?.trim() ||
        f.symbols?.length ||
        f.strategies?.length ||
        f.tags?.length ||
        f.setupGrades?.length,
    );
  });

  trade(id: string): Trade | undefined {
    return this.all().find((t) => t.id === id);
  }

  updateTableFilters(patch: Partial<TradeFilters>): void {
    this._tableFilters.update((f) => ({ ...f, ...patch }));
  }

  resetTableFilters(): void {
    this._tableFilters.set({});
  }

  reload(): void {
    this.resource.reload();
  }

  async update(id: string, patch: Partial<Trade>): Promise<void> {
    await this.api.update(id, patch);
    this.resource.reload();
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(id);
    this.resource.reload();
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'));
}
