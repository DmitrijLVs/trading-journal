import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TradesStore } from '../trades/trades-store';
import { AccountsStore } from './accounts-store';
import { formatFeesOther } from '../trades/data/trade.model';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { IconName } from '../../shared/ui/icons';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';
import { Toggle } from '../../shared/ui/toggle';
import { PrivacyStore } from '../../core/state/privacy-store';
import { DENSITY_LABELS, Density, THEME_LABELS, ThemeName, ThemeStore } from '../../core/state/theme-store';
import { ToastService } from '../../shared/ui/toast';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { ExchangeSettings } from './exchange-settings';
import { AccountSettings } from './account-settings';
import { DisciplineSettings } from './discipline-settings';

type SettingsTab = 'exchange' | 'discipline' | 'account' | 'display' | 'data';

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: IconName;
}

/** Порядок важен: первым пользователь видит подключение ключа. */
const TABS: readonly TabDef[] = [
  { id: 'exchange', label: 'Биржа', icon: 'link' },
  { id: 'discipline', label: 'Дисциплина', icon: 'target' },
  { id: 'account', label: 'Аккаунт', icon: 'user' },
  { id: 'display', label: 'Оформление', icon: 'sun' },
  { id: 'data', label: 'Данные', icon: 'download' },
];

/** Настройки: разделы по маршруту /settings/:tab, слева — навигация. */
@Component({
  selector: 'app-settings',
  imports: [RouterLink, Button, Icon, Segmented, Toggle, ExchangeSettings, AccountSettings, DisciplineSettings],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly tradesStore = inject(TradesStore);
  private readonly accountsStore = inject(AccountsStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly themeStore = inject(ThemeStore);
  protected readonly privacy = inject(PrivacyStore);

  /** Параметр маршрута :tab (withComponentInputBinding). */
  readonly tab = input<string>();

  protected readonly tabs = TABS;
  protected readonly activeTab = computed<SettingsTab>(() => {
    const id = this.tab();
    return TABS.some((t) => t.id === id) ? (id as SettingsTab) : 'exchange';
  });

  protected readonly themeOptions: SegmentOption[] = (Object.keys(THEME_LABELS) as ThemeName[]).map(
    (value) => ({ value, label: THEME_LABELS[value] }),
  );

  protected readonly tradeCount = computed(() => this.tradesStore.all().length);

  protected readonly densityOptions: SegmentOption[] = (Object.keys(DENSITY_LABELS) as Density[]).map(
    (value) => ({ value, label: DENSITY_LABELS[value] }),
  );

  protected setDensity(value: string): void {
    if (value === 'comfortable' || value === 'compact') this.themeStore.setDensity(value);
  }

  protected setTheme(value: string): void {
    if (value === 'carmine' || value === 'paper') this.themeStore.setTheme(value);
  }

  /** Все сделки журнала (до 183 дней) в CSV — для Excel и своей аналитики. */
  protected exportCsv(): void {
    const trades = this.tradesStore.all();
    const labels = new Map(this.accountsStore.accounts().map((a) => [a.id, a.label]));
    const header = [
      'id', 'account', 'symbol', 'side', 'status', 'openedAt', 'closedAt', 'quantity',
      'entryPrice', 'exitPrice', 'realizedPnl', 'fees', 'feesOther', 'funding', 'netPnl', 'fills',
    ];
    const rows = trades.map((t) =>
      [
        t.id, csv(labels.get(t.accountId) ?? t.accountId), t.symbol, t.side, t.status,
        t.openedAt, t.closedAt, t.quantity, t.entryPrice ?? '', t.exitPrice ?? '',
        t.realizedPnl, t.fees, csv(formatFeesOther(t)), t.funding, t.netPnl, t.fillsCount,
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

  /** Сбрасывает раскладку дашборда и настройки этого браузера. */
  protected async resetLocal(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Сбросить настройки браузера?',
      message:
        'Раскладка дашборда, выбранный счёт, период, тема и рисунки на графиках вернутся к значениям по умолчанию. Сделки и подключённые ключи не пострадают.',
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

/** Значение CSV-ячейки: кавычки, если внутри запятая или кавычка. */
function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
