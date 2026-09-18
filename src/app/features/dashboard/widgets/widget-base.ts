import { Directive, computed, inject, input } from '@angular/core';
import { TradesStore } from '../../trades/trades-store';
import { Trade } from '../../trades/data/trade.model';
import { WidgetSettings } from '../data/workspace.model';
import { presetRange } from '../../../core/state/period-store';

/**
 * База виджета: настройки экземпляра + срез сделок. По умолчанию виджет
 * следует глобальному периоду; настройка `period` переопределяет его локально.
 */
@Directive()
export abstract class WidgetBase {
  protected readonly tradesStore = inject(TradesStore);

  readonly settings = input<WidgetSettings>({});

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
