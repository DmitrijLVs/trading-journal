import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TradesStore } from '../trades/trades-store';
import { calculatePnl, calculateRMultiple } from '../trades/data/trade.model';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Select, SelectOption } from '../../shared/ui/select';
import { Toggle } from '../../shared/ui/toggle';
import { ToastService } from '../../shared/ui/toast';
import { ConfirmService } from '../../shared/ui/confirm-dialog';

@Component({
  selector: 'app-settings',
  imports: [Button, Icon, Select, Toggle],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly tradesStore = inject(TradesStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly name = signal('Дмитрий');
  protected readonly email = signal('motores7@gmail.com');
  protected readonly timezone = signal<string | null>('utc');
  protected readonly currency = signal<string | null>('usd');
  protected readonly defaultRisk = signal(1);
  protected readonly weekStartMonday = signal(true);
  protected readonly confirmDeletes = signal(true);

  protected readonly timezoneOptions: SelectOption[] = [
    { value: 'utc', label: 'UTC' },
    { value: 'msk', label: 'Москва (UTC+3)' },
    { value: 'local', label: 'Локальное время' },
  ];

  protected readonly currencyOptions: SelectOption[] = [
    { value: 'usd', label: 'USD ($)' },
    { value: 'usdt', label: 'USDT' },
    { value: 'eur', label: 'EUR (€)' },
  ];

  protected saveProfile(): void {
    this.toast.success('Профиль сохранён');
  }

  /** Экспорт всех сделок в CSV — работает по-настоящему. */
  protected exportCsv(): void {
    const trades = this.tradesStore.all();
    const header = [
      'id', 'account', 'symbol', 'side', 'status', 'openedAt', 'closedAt',
      'quantity', 'leverage', 'entryPrice', 'exitPrice', 'stopLoss', 'takeProfit',
      'riskUsd', 'fees', 'funding', 'pnl', 'rMultiple', 'strategy', 'timeframe',
      'setupGrade', 'tags', 'mistakes', 'notes',
    ];
    const rows = trades.map((t) =>
      [
        t.id, t.accountId, t.symbol, t.side, t.status, t.openedAt, t.closedAt,
        t.quantity, t.leverage, t.entryPrice, t.exitPrice, t.stopLoss ?? '', t.takeProfit ?? '',
        t.riskUsd ?? '', t.fees, t.funding, calculatePnl(t).toFixed(2),
        calculateRMultiple(t)?.toFixed(2) ?? '', t.strategy, t.timeframe,
        t.setupGrade ?? '', t.tags.join('|'), t.mistakes.join('|'),
        `"${t.notes.replaceAll('"', '""')}"`,
      ].join(','),
    );
    const blob = new Blob(['﻿' + [header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trades-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success(`Экспортировано сделок: ${trades.length}`);
  }

  /** Сбрасывает раскладку дашборда и локальные настройки. */
  protected async resetLocal(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Сбросить локальные данные?',
      message:
        'Раскладка дашборда, выбранный счёт и период вернутся к значениям по умолчанию. Сделки не пострадают.',
      confirmLabel: 'Сбросить',
      danger: true,
    });
    if (!ok) return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tj.')) localStorage.removeItem(key);
    }
    location.reload();
  }
}
