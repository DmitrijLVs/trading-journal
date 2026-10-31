import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { TradesApi } from './data/trades-api';
import { Trade, TradeFilters } from './data/trade.model';
import { AccountsStore } from '../accounts/accounts-store';
import { PeriodStore } from '../../core/state/period-store';
import { AuthStore } from '../../core/auth/auth-store';
import { EventsSocket } from '../../core/events/events-socket';
import { summarize } from '../analytics/data/metrics';
import { TradeTags, autoTags, tagsOf } from '../analytics/data/behavior';
import { DisciplineStore } from '../analytics/discipline-store';
import { ManualTagsStore } from './manual-tags-store';
import { manualTagOfFilter } from './data/manual-tags.model';

/** Пока счёт импортирует историю, сделки дозагружаются — перечитываем их так часто. */
const IMPORT_POLL_MS = 30_000;

/**
 * Все сделки пользователя (вся записанная история, ≤ 183 дней). «Скоуп»
 * (выбранный счёт + глобальный период) применяется здесь — дашборд, таблица
 * и журнал дней читают уже готовый срез.
 */
@Injectable({ providedIn: 'root' })
export class TradesStore {
  private readonly api = inject(TradesApi);
  private readonly accountsStore = inject(AccountsStore);
  private readonly periodStore = inject(PeriodStore);
  private readonly auth = inject(AuthStore);
  private readonly discipline = inject(DisciplineStore);
  private readonly manualTags = inject(ManualTagsStore);
  /** Пользователь и набор его счетов: подключили или удалили счёт — история другая. */
  private readonly listKey = computed(() => {
    const owner = this.auth.user()?.id;
    if (!owner || !this.accountsStore.hasLoaded()) return null;
    const ids = this.accountsStore.accounts().map((a) => a.id).sort();
    return ids.length ? `${owner}:${ids.join(',')}` : null;
  });

  private readonly resource = this.api.list(this.listKey);

  /** Локальные фильтры страницы «Сделки» (поверх глобального скоупа). */
  private readonly _tableFilters = signal<TradeFilters>({});

  constructor() {
    // Сделка открылась, изменилась или закрылась — точечно перечитываем её;
    // пропущенное за разрыв сокета — всей историей.
    const events = inject(EventsSocket);
    events.on((event) => {
      const id = event.data['id'];
      if (event.type === 'trade' && (typeof id === 'number' || typeof id === 'string')) {
        void this.refreshTrade(String(id));
      }
    });
    events.onResync(() => this.resource.reload());
    // Импорт истории событий не шлёт: пока он идёт и когда закончился (`sync`) — перечитываем.
    events.on((event) => event.type === 'sync' && this.resource.reload());
    effect((onCleanup) => {
      if (!this.accountsStore.isImporting()) return;
      const timer = setInterval(() => this.resource.reload(), IMPORT_POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  readonly isLoading = this.resource.isLoading;
  readonly hasLoaded = computed(() => this.resource.hasValue());
  readonly error = this.resource.error;
  readonly tableFilters = this._tableFilters.asReadonly();

  // value() бросает, пока ресурс в ошибке, — читаем только через hasValue().
  readonly all = computed<readonly Trade[]>(() =>
    this.resource.hasValue() ? this.resource.value() : [],
  );

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

  /**
   * Автотеги разбора — по всей истории счёта (реванш видит предыдущую сделку
   * даже за границей периода), пороги — из правил дисциплины.
   */
  readonly tags = computed<TradeTags>(() =>
    autoTags(this.accountScoped(), this.discipline.settings()),
  );

  readonly openTrades = computed(() => this.scoped().filter((t) => t.status === 'open'));

  readonly summary = computed(() => summarize(this.scoped()));

  /** Справочник инструментов для фильтра — по всей истории, не по срезу. */
  readonly symbols = computed(() => unique(this.all().map((t) => t.symbol)));

  /** Сделки для таблицы: скоуп + локальные фильтры, новые сверху. */
  readonly tableTrades = computed<readonly Trade[]>(() => {
    const f = this._tableFilters();
    const search = f.search?.trim().toLowerCase();
    const tags = this.tags();
    const manual = manualTagOfFilter(f.tag);
    const manualTags = this.manualTags.byTrade();
    return this.scoped()
      .filter((t) => {
        if (manual !== null) {
          if (!manualTags.get(t.id)?.includes(manual)) return false;
        } else if (f.tag && !tagsOf(tags, t).some((tag) => tag === f.tag)) return false;
        if (f.side && t.side !== f.side) return false;
        if (f.status && t.status !== f.status) return false;
        if (f.symbols?.length && !f.symbols.includes(t.symbol)) return false;
        if (search && !t.symbol.toLowerCase().includes(search)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  });

  readonly hasActiveTableFilters = computed(() => {
    const f = this._tableFilters();
    return Boolean(f.side || f.status || f.tag || f.search?.trim() || f.symbols?.length);
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

  private async refreshTrade(id: string): Promise<void> {
    try {
      const { trade } = await this.api.detail(id);
      if (!this.resource.hasValue()) {
        this.resource.reload();
        return;
      }
      this.resource.update((list) => {
        const rest = (list ?? []).filter((t) => t.id !== trade.id);
        return [trade, ...rest];
      });
    } catch {
      this.resource.reload();
    }
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'));
}
