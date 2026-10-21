import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsStore } from '../../features/accounts/accounts-store';
import { SYNC_STATUS, exchangeMeta } from '../../features/accounts/data/account.model';
import { PortfolioStore } from '../../features/analytics/portfolio-store';
import { formatMoney } from '../../features/trades/data/trade.model';
import { Icon } from '../ui/icon';

/**
 * Переключатель счёта в топбаре. Баланс — кошелёк на бирже (Stats-Service);
 * без подключённых счетов вместо него — кнопка подключения.
 */
@Component({
  selector: 'app-account-switcher',
  imports: [OverlayModule, Icon, RouterLink],
  templateUrl: './account-switcher.html',
  styleUrl: './account-switcher.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSwitcher {
  protected readonly accountsStore = inject(AccountsStore);
  private readonly portfolio = inject(PortfolioStore);

  protected readonly open = signal(false);

  protected readonly rows = computed(() =>
    this.accountsStore.accounts().map((account) => {
      const meta = exchangeMeta(account.exchange);
      return {
        account,
        mark: meta.mark,
        color: meta.color,
        hint: `${meta.label} ${meta.market} · ${SYNC_STATUS[account.status].label.toLowerCase()}`,
      };
    }),
  );

  protected readonly selectedId = this.accountsStore.selectedId;

  protected readonly triggerTitle = computed(() => {
    const id = this.selectedId();
    if (id === 'all') return 'Все счета';
    return this.accountsStore.selected()?.label ?? 'Счёт';
  });

  protected readonly triggerBalance = computed(() => {
    const balance = this.portfolio.walletBalance();
    return balance === null ? 'баланс обновляется' : formatMoney(balance);
  });

  protected readonly triggerMark = computed(() => {
    const id = this.selectedId();
    if (id === 'all') return null;
    return this.rows().find((r) => r.account.id === id) ?? null;
  });

  protected select(id: string): void {
    this.accountsStore.select(id);
    this.open.set(false);
  }
}
