import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { WidgetBase } from './widget-base';
import { equityCurve, summarize } from '../../analytics/data/metrics';
import { formatMoney, formatPercent } from '../../trades/data/trade.model';
import { SparkLine } from '../../../shared/ui/spark-line';

/** Чистый P&L: итог в $ и в % от капитала на начало периода, спарклайн
 *  накопленного P&L (как рос результат внутри периода), комиссии. */
@Component({
  selector: 'app-widget-stat-pnl',
  imports: [SparkLine],
  template: `
    @let s = stats();
    <div class="top">
      <div class="value" [class.pos]="s.netPnl > 0" [class.neg]="s.netPnl < 0">
        {{ money(s.netPnl, true) }}
      </div>
      @if (growth(); as g) {
        <div class="growth" [class.pos]="g > 0" [class.neg]="g < 0" title="Рост капитала за период">
          {{ percent(g) }}
        </div>
      }
    </div>
    <div class="sub">
      <span>{{ s.tradeCount }} сделок</span>
      <span class="mono">комиссии {{ money(s.fees + s.funding) }}</span>
    </div>
    <div class="fill spark" title="Накопленный P&L за период">
      <app-spark-line [data]="sparkData()" />
    </div>
  `,
  styleUrl: './stat-tiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetStatPnl extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));

  /** Спарклайн начинается с нуля: видно именно прирост, а не уровень капитала. */
  protected readonly sparkData = computed(() => [0, ...equityCurve(this.trades()).map((p) => p.equity)]);

  /** Рост капитала за период в долях (0.165 = +16.5%); null, если базы нет. */
  protected readonly growth = computed<number | null>(() => {
    const base = this.baseBalance();
    if (base <= 0) return null;
    return this.stats().netPnl / base;
  });

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }

  protected percent(fraction: number): string {
    return formatPercent(fraction * 100, { sign: true });
  }
}
