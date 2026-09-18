import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsStore } from '../../features/accounts/accounts-store';
import { Account, exchangeMeta } from '../../features/accounts/data/account.model';
import { TradesStore } from '../../features/trades/trades-store';
import { calculatePnl, formatMoney } from '../../features/trades/data/trade.model';
import { Icon } from '../ui/icon';

interface AccountRow {
  account: Account;
  balance: number;
  mark: string;
  color: string;
}

/** Переключатель счёта в топбаре: балансы живые (старт + реализованный P&L). */
@Component({
  selector: 'app-account-switcher',
  imports: [OverlayModule, Icon, RouterLink],
  templateUrl: './account-switcher.html',
  styleUrl: './account-switcher.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSwitcher {
  private readonly accountsStore = inject(AccountsStore);
  private readonly tradesStore = inject(TradesStore);

  protected readonly open = signal(false);

  protected readonly rows = computed<AccountRow[]>(() => {
    const pnlByAccount = new Map<string, number>();
    for (const t of this.tradesStore.all()) {
      pnlByAccount.set(t.accountId, (pnlByAccount.get(t.accountId) ?? 0) + calculatePnl(t));
    }
    return this.accountsStore.accounts().map((account) => {
      const meta = exchangeMeta(account.exchange);
      return {
        account,
        balance: account.startBalance + (pnlByAccount.get(account.id) ?? 0),
        mark: meta.mark,
        color: meta.color,
      };
    });
  });

  protected readonly totalBalance = computed(() =>
    this.rows().reduce((sum, r) => sum + r.balance, 0),
  );

  protected readonly selectedId = this.accountsStore.selectedId;

  protected readonly triggerTitle = computed(() => {
    const id = this.selectedId();
    if (id === 'all') return 'Все счета';
    return this.accountsStore.selected()?.name ?? 'Счёт';
  });

  protected readonly triggerBalance = computed(() => {
    const id = this.selectedId();
    const value =
      id === 'all' ? this.totalBalance() : (this.rows().find((r) => r.account.id === id)?.balance ?? 0);
    return formatMoney(value);
  });

  protected readonly triggerMark = computed(() => {
    const id = this.selectedId();
    if (id === 'all') return null;
    return this.rows().find((r) => r.account.id === id) ?? null;
  });

  protected format(value: number): string {
    return formatMoney(value);
  }

  protected select(id: string): void {
    this.accountsStore.select(id);
    this.open.set(false);
  }
}
