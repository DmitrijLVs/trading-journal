import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { WidgetBase } from './widget-base';
import { equityCurve, formatProfitFactor, summarize } from '../../analytics/data/metrics';
import { formatMoney } from '../../trades/data/trade.model';
import { SparkLine } from '../../../shared/ui/spark-line';

/** Чистый P&L: итог, спарклайн капитала, комиссии. */
@Component({
  selector: 'app-widget-stat-pnl',
  imports: [SparkLine],
  template: `
    @let s = stats();
    <div class="value" [class.pos]="s.netPnl > 0" [class.neg]="s.netPnl < 0">
      {{ money(s.netPnl, true) }}
    </div>
    <div class="sub">
      <span>{{ s.tradeCount }} сделок</span>
      <span class="mono">комиссии {{ money(s.fees + s.funding) }}</span>
    </div>
    <div class="fill spark">
      <app-spark-line [data]="sparkData()" />
    </div>
  `,
  styleUrl: './stat-tiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetStatPnl extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));
  protected readonly sparkData = computed(() => equityCurve(this.trades()).map((p) => p.equity));

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }
}

/** Винрейт + полоса соотношения побед/поражений. */
@Component({
  selector: 'app-widget-stat-winrate',
  template: `
    @let s = stats();
    <div class="value">{{ (s.winRate * 100).toFixed(1) }}%</div>
    <div class="sub">
      <span class="pos mono">{{ s.winCount }} W</span>
      <span class="neg mono">{{ s.lossCount }} L</span>
      @if (s.breakevenCount > 0) {
        <span class="mono">{{ s.breakevenCount }} BE</span>
      }
    </div>
    <div class="fill"></div>
    <div class="meter">
      <div class="meter-fill" [style.width.%]="s.winRate * 100"></div>
    </div>
  `,
  styleUrl: './stat-tiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetStatWinrate extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));
}

/** Профит-фактор + матожидание. */
@Component({
  selector: 'app-widget-stat-profit-factor',
  template: `
    @let s = stats();
    <div class="value" [class.pos]="(s.profitFactor ?? 0) >= 1.5" [class.neg]="(s.profitFactor ?? 1) < 1">
      {{ pf(s.profitFactor) }}
    </div>
    <div class="sub">
      <span>профит-фактор</span>
    </div>
    <div class="pair">
      <div class="pair-item">
        <span class="k">Матожидание</span>
        <span class="v" [class.pos]="s.expectancyUsd > 0" [class.neg]="s.expectancyUsd < 0">
          {{ money(s.expectancyUsd, true) }}
        </span>
      </div>
      <div class="pair-item">
        <span class="k">Средний R</span>
        <span class="v" [class.pos]="(s.avgR ?? 0) > 0" [class.neg]="(s.avgR ?? 0) < 0">
          {{ s.avgR === null ? '—' : s.avgR.toFixed(2) + 'R' }}
        </span>
      </div>
    </div>
  `,
  styleUrl: './stat-tiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetStatProfitFactor extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));
  protected readonly pf = formatProfitFactor;

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }
}

/** Серии побед/поражений. */
@Component({
  selector: 'app-widget-stat-streak',
  template: `
    @let s = stats();
    <div class="value" [class.pos]="s.currentStreak > 0" [class.neg]="s.currentStreak < 0">
      {{ streakText() }}
    </div>
    <div class="sub"><span>текущая серия</span></div>
    <div class="pair">
      <div class="pair-item">
        <span class="k">Лучшая</span>
        <span class="v pos">{{ s.bestWinStreak }} W</span>
      </div>
      <div class="pair-item">
        <span class="k">Худшая</span>
        <span class="v neg">{{ s.worstLossStreak }} L</span>
      </div>
      <div class="pair-item">
        <span class="k">Торг. дней</span>
        <span class="v">{{ s.tradingDays }}</span>
      </div>
    </div>
  `,
  styleUrl: './stat-tiles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetStatStreak extends WidgetBase {
  protected readonly stats = computed(() => summarize(this.trades()));

  protected streakText(): string {
    const streak = this.stats().currentStreak;
    if (streak === 0) return '—';
    return streak > 0 ? `${streak} W` : `${-streak} L`;
  }
}
