import { Injectable, computed, inject } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { EventsSocket } from '../../core/events/events-socket';
import { AccountsStore } from '../accounts/accounts-store';
import { PortfolioApi, PortfolioScope } from './data/portfolio-api';
import { balanceAt } from './data/portfolio.model';

/**
 * Деньги на счетах по данным биржи: баланс кошелька, его история и
 * открытые позиции — для выбранного счёта (или всех сразу).
 */
@Injectable({ providedIn: 'root' })
export class PortfolioStore {
  private readonly api = inject(PortfolioApi);
  private readonly auth = inject(AuthStore);
  private readonly accounts = inject(AccountsStore);

  private readonly scope = computed<PortfolioScope | undefined>(
    () => {
      const owner = this.auth.user()?.id;
      if (!owner || !this.accounts.hasAccounts()) return undefined;
      const id = this.accounts.selectedId();
      return { owner, accountId: id === 'all' ? null : id };
    },
    { equal: (a, b) => a?.owner === b?.owner && a?.accountId === b?.accountId },
  );

  /** Статистика догоняет журнал примерно за 15 секунд — перечитываем чуть позже. */
  private static readonly STATS_LAG_MS = 16_000;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly overviewResource = this.api.overview(this.scope);
  private readonly historyResource = this.api.balanceHistory(this.scope);
  private readonly positionsResource = this.api.positions(this.scope);

  constructor() {
    const events = inject(EventsSocket);
    events.on((event) => {
      if (event.type === 'trade') this.positionsResource.reload();
      if (event.type === 'trade' || event.type === 'sync') this.scheduleReload();
    });
    events.onResync(() => this.reload());
  }

  /** Баланс кошелька сейчас; null — ещё неизвестен. */
  // value() бросает, пока ресурс в ошибке, — читаем только через hasValue().
  private readonly overview = computed(() =>
    this.overviewResource.hasValue() ? this.overviewResource.value() : null,
  );
  readonly walletBalance = computed(() => this.overview()?.walletBalance ?? null);
  readonly unrealizedPnl = computed(() => this.overview()?.unrealizedPnl ?? 0);
  readonly balanceHistory = computed(() =>
    this.historyResource.hasValue() ? this.historyResource.value() : [],
  );
  readonly positions = computed(() =>
    this.positionsResource.hasValue() ? this.positionsResource.value() : [],
  );
  readonly positionsLoading = this.positionsResource.isLoading;

  /** Баланс на начало периода (база для «роста в %»); null — истории баланса нет. */
  balanceAt(ms: number | null): number | null {
    const series = this.balanceHistory();
    if (ms === null) return series[0]?.balance ?? null;
    return balanceAt(series, ms);
  }

  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      this.reload();
    }, PortfolioStore.STATS_LAG_MS);
  }

  reload(): void {
    this.overviewResource.reload();
    this.historyResource.reload();
    this.positionsResource.reload();
  }
}
