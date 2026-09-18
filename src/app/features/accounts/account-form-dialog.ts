import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, min, minLength, required, submit } from '@angular/forms/signals';
import { AccountsStore } from './accounts-store';
import { EXCHANGES, ExchangeId } from './data/account.model';
import { MarketType } from '../trades/data/trade.model';
import { DialogShell } from '../../shared/ui/dialog-shell';
import { Button } from '../../shared/ui/button';
import { Segmented } from '../../shared/ui/segmented';
import { Icon } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast';

/** Подключение биржевого счёта по API-ключам (мок: ключи никуда не уходят). */
@Component({
  imports: [FormField, DialogShell, Button, Segmented, Icon],
  templateUrl: './account-form-dialog.html',
  styleUrl: './account-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountFormDialog {
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(AccountsStore);
  private readonly toast = inject(ToastService);

  protected readonly exchanges = EXCHANGES;
  protected readonly exchange = signal<ExchangeId>('binance');
  protected readonly market = signal<MarketType>('futures');
  protected readonly showSecret = signal(false);

  protected readonly marketOptions = [
    { value: 'futures', label: 'Фьючерсы' },
    { value: 'spot', label: 'Спот' },
  ];

  protected readonly model = signal({
    name: '',
    apiKey: '',
    apiSecret: '',
    startBalance: 10000,
  });

  protected readonly accountForm = form(this.model, (p) => {
    required(p.name, { message: 'Как назвать счёт?' });
    minLength(p.apiKey, 16, { message: 'API-ключ выглядит слишком коротким' });
    minLength(p.apiSecret, 16, { message: 'Секретный ключ выглядит слишком коротким' });
    min(p.startBalance, 1, { message: 'Стартовый баланс должен быть положительным' });
  });

  protected pickExchange(id: ExchangeId): void {
    this.exchange.set(id);
    const meta = EXCHANGES.find((e) => e.id === id);
    if (meta && !this.model().name) {
      this.model.update((m) => ({ ...m, name: meta.label }));
    }
  }

  protected save(): void {
    submit(this.accountForm, async () => {
      const m = this.model();
      await this.store.create({
        name: m.name.trim(),
        exchange: this.exchange(),
        market: this.market(),
        apiKey: m.apiKey,
        apiSecret: m.apiSecret,
        startBalance: m.startBalance,
      });
      this.toast.success('Счёт подключён — история сделок синхронизируется');
      this.ref.close();
    });
  }
}
