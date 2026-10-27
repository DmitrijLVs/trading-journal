import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { WidgetBase } from './widget-base';
import { formatProfitFactor, summarize } from '../../analytics/data/metrics';
import { decimal, formatMoney } from '../../trades/data/trade.model';

/**
 * Качество торговли за период: сделки, винрейт, средний плюс против
 * среднего минуса и профит-фактор. Четыре плитки, раскладка — от размера
 * виджета (container queries); цифры не режутся, а уменьшаются.
 */
@Component({
  selector: 'app-widget-summary',
  template: `
    @let s = stats();
    <div class="tiles">
      <div class="tile">
        <span class="v">{{ s.tradeCount }}</span>
        <span class="k"><span class="pos">{{ s.winCount }}</span> плюс · <span class="neg">{{ s.lossCount }}</span> минус</span>
      </div>
      <div class="tile">
        <span class="v">{{ winRate() }}</span>
        <span class="k">винрейт</span>
      </div>
      <div class="tile">
        <span class="v pair">
          <span class="pos">{{ money(s.avgWin) }}</span>
          <span class="slash">/</span>
          <span class="neg">{{ money(s.avgLoss) }}</span>
        </span>
        <span class="k">ср. плюс / минус · {{ payoff() }}</span>
      </div>
      <div class="tile">
        <span class="v" [class.neg]="(s.profitFactor ?? 1) < 1">{{ profitFactor() }}</span>
        <span class="k">профит-фактор</span>
      </div>
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      height: 100%;
      container-type: size;
    }

    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, minmax(0, 1fr));
      gap: 2px $space-4;
      height: 100%;
      padding: $space-1 $space-4 $space-3;
    }

    .tile {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    // Размер — от меньшей стороны виджета: пара «плюс / минус» должна влезть в плитку.
    .v {
      @include figure(clamp(15px, min(15cqh, 6.4cqw), 30px), 650);
      color: var(--fg-default);
      white-space: nowrap;
    }

    .pair { display: flex; align-items: baseline; gap: 4px; }
    .slash { color: var(--fg-subtle); font-weight: 400; }

    .k {
      font-size: $text-xs;
      line-height: 1.3;
      color: var(--fg-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }

    // Широкий виджет — четыре плитки в ряд.
    @container (min-width: 640px) {
      .tiles {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: 1fr;
      }
      .v { font-size: clamp(16px, min(24cqh, 3.6cqw), 30px); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetSummary extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));

  protected readonly winRate = computed(() => `${Math.round(this.stats().winRate * 100)}%`);

  /** Отношение среднего плюса к среднему минусу: «payoff 0,51». */
  protected readonly payoff = computed(() => {
    const s = this.stats();
    return s.avgLoss > 0 ? `payoff ${decimal(s.avgWin / s.avgLoss, 2)}` : 'без минусов';
  });

  protected readonly profitFactor = computed(() =>
    formatProfitFactor(this.stats().profitFactor).replace('.', ','),
  );

  protected money(value: number): string {
    return formatMoney(value);
  }
}
