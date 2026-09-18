import { Directive, computed, inject, input } from '@angular/core';
import { TradesStore } from '../../trades/trades-store';
import { AccountsStore } from '../../accounts/accounts-store';
import { Trade, calculatePnl } from '../../trades/data/trade.model';
import { WidgetSettings } from '../data/workspace.model';
import { PeriodStore, presetRange } from '../../../core/state/period-store';

/**
 * База виджета: настройки экземпляра + срез сделок. По умолчанию виджет
 * следует глобальному периоду; настройка `period` переопределяет его локально.
 */
@Directive()
export abstract class WidgetBase {
  protected readonly tradesStore = inject(TradesStore);
  protected readonly accountsStore = inject(AccountsStore);
  private readonly periodStore = inject(PeriodStore);

  readonly settings = input<WidgetSettings>({});

  /** Начало периода виджета (ms) или null для «всё время». */
  protected readonly periodFromMs = computed<number | null>(() => {
    const period = this.settings().period;
    if (!period || period === 'global' || period === 'custom') return this.periodStore.range().fromMs;
    return presetRange(period).fromMs;
  });

  /**
   * Капитал на начало периода: стартовые балансы счетов в выборке плюс
   * результат сделок, закрытых до начала периода. База для процента роста.
   */
  protected readonly baseBalance = computed(() => {
    const selected = this.accountsStore.selected();
    const accounts = selected ? [selected] : this.accountsStore.accounts();
    const fromMs = this.periodFromMs();
    const start = accounts.reduce((sum, a) => sum + a.startBalance, 0);
    const before = this.tradesStore
      .accountScoped()
      .filter((t) => t.status === 'closed' && fromMs !== null && new Date(t.closedAt).getTime() < fromMs)
      .reduce((sum, t) => sum + calculatePnl(t), 0);
    return start + before;
  });

  protected readonly trades = computed<readonly Trade[]>(() => {
    const period = this.settings().period;
    if (!period || period === 'global' || period === 'custom') return this.tradesStore.scoped();
    const { fromMs, toMs } = presetRange(period);
    return this.tradesStore.accountScoped().filter((t) => {
      if (t.status === 'open') return true;
      const closed = new Date(t.closedAt).getTime();
      if (fromMs !== null && closed < fromMs) return false;
      if (toMs !== null && closed > toMs) return false;
      return true;
    });
  });
}
