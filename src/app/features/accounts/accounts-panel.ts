import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccountsStore } from './accounts-store';
import { Account, exchangeMeta } from './data/account.model';
import { AccountFormDialog } from './account-form-dialog';
import { TradesStore } from '../trades/trades-store';
import { calculatePnl, formatDateTime, formatMoney } from '../trades/data/trade.model';
import { equityCurve } from '../analytics/data/metrics';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { PnlValue } from '../../shared/ui/pnl-value';
import { SparkLine } from '../../shared/ui/spark-line';
import { Toggle } from '../../shared/ui/toggle';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { ToastService } from '../../shared/ui/toast';

interface AccountCard {
  account: Account;
  balance: number;
  pnl: number;
  tradeCount: number;
  spark: number[];
  mark: string;
  color: string;
}

/** Подключённые счета — вкладка «Счета» в настройках. */
@Component({
  selector: 'app-accounts-panel',
  imports: [Icon, Button, Badge, PnlValue, SparkLine, Toggle],
  templateUrl: './accounts-panel.html',
  styleUrl: './accounts-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsPanel {
  protected readonly store = inject(AccountsStore);
  private readonly tradesStore = inject(TradesStore);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly cards = computed<AccountCard[]>(() =>
    this.store.accounts().map((account) => {
      const trades = this.tradesStore.all().filter((t) => t.accountId === account.id);
      const pnl = trades.reduce((sum, t) => sum + calculatePnl(t), 0);
      const meta = exchangeMeta(account.exchange);
      return {
        account,
        balance: account.startBalance + pnl,
        pnl,
        tradeCount: trades.length,
        spark: [account.startBalance, ...equityCurve(trades).map((p) => account.startBalance + p.equity)],
        mark: meta.mark,
        color: meta.color,
      };
    }),
  );

  protected readonly totalBalance = computed(() =>
    this.cards().reduce((sum, c) => sum + c.balance, 0),
  );

  protected readonly totalPnl = computed(() => this.cards().reduce((sum, c) => sum + c.pnl, 0));

  protected addAccount(): void {
    this.dialog.open(AccountFormDialog, {
      panelClass: 'tj-dialog-panel',
      backdropClass: 'tj-dialog-backdrop',
    });
  }

  protected async toggleSync(card: AccountCard, enabled: boolean): Promise<void> {
    await this.store.update(card.account.id, {
      syncEnabled: enabled,
      lastSyncAt: enabled ? new Date().toISOString() : card.account.lastSyncAt,
    });
    this.toast.info(enabled ? 'Синхронизация включена' : 'Синхронизация на паузе');
  }

  protected async remove(card: AccountCard): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Отключить счёт?',
      message: `«${card.account.name}» и ${card.tradeCount} его сделок будут удалены из журнала.`,
      confirmLabel: 'Отключить',
      danger: true,
    });
    if (!ok) return;
    await this.store.remove(card.account.id);
    this.tradesStore.reload();
    this.toast.info('Счёт отключён');
  }

  protected fmtMoney(value: number): string {
    return formatMoney(value);
  }

  protected fmtSync(card: AccountCard): string {
    return formatDateTime(card.account.lastSyncAt);
  }

  protected marketLabel(account: Account): string {
    return account.market === 'futures' ? 'Фьючерсы' : 'Спот';
  }
}
