import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WidgetInstance, defaultWidgetTitle, soonReason } from './data/workspace.model';
import { Soon } from '../../shared/ui/soon';
import { WidgetStatPnl } from './widgets/stat-tiles';
import { WidgetSummary } from './widgets/widget-summary';
import {
  WidgetCumulativeProfit,
  WidgetDailyPnl,
  WidgetDistribution,
  WidgetDrawdown,
  WidgetDurationScatter,
  WidgetEquityCurve,
  WidgetHeatmapHours,
  WidgetLongShort,
} from './widgets/chart-widgets';
import { WidgetPnlCalendar } from './widgets/pnl-calendar';
import { WidgetBestWorst, WidgetOpenPositions, WidgetRecentTrades } from './widgets/table-widgets';

/** Резолвит тип виджета в компонент. */
@Component({
  selector: 'app-widget-host',
  imports: [
    WidgetStatPnl,
    WidgetSummary,
    WidgetEquityCurve,
    WidgetCumulativeProfit,
    WidgetDailyPnl,
    WidgetDrawdown,
    WidgetDistribution,
    WidgetLongShort,
    Soon,
    WidgetHeatmapHours,
    WidgetDurationScatter,
    WidgetPnlCalendar,
    WidgetRecentTrades,
    WidgetOpenPositions,
    WidgetBestWorst,
  ],
  template: `
    @if (soon(); as reason) {
      <div class="soon"><app-soon [title]="title()" [description]="reason" /></div>
    } @else {
    @switch (widget().type) {
      @case ('stat-pnl') { <app-widget-stat-pnl [settings]="widget().settings" /> }
      @case ('summary') { <app-widget-summary [settings]="widget().settings" /> }
      @case ('equity-curve') { <app-widget-equity-curve [settings]="widget().settings" /> }
      @case ('cumulative-profit') { <app-widget-cumulative-profit [settings]="widget().settings" /> }
      @case ('daily-pnl') { <app-widget-daily-pnl [settings]="widget().settings" /> }
      @case ('drawdown') { <app-widget-drawdown [settings]="widget().settings" /> }
      @case ('distribution') { <app-widget-distribution [settings]="widget().settings" /> }
      @case ('long-short') { <app-widget-long-short [settings]="widget().settings" /> }
      @case ('heatmap-hours') { <app-widget-heatmap-hours [settings]="widget().settings" /> }
      @case ('duration-scatter') { <app-widget-duration-scatter [settings]="widget().settings" /> }
      @case ('pnl-calendar') { <app-widget-pnl-calendar [settings]="widget().settings" /> }
      @case ('recent-trades') { <app-widget-recent-trades [settings]="widget().settings" /> }
      @case ('open-positions') { <app-widget-open-positions [settings]="widget().settings" /> }
      @case ('best-worst') { <app-widget-best-worst [settings]="widget().settings" /> }
    }
    }
  `,
  styles: `
    :host { display: block; height: 100%; }
    :host > * { height: 100%; }
    .soon { display: flex; align-items: center; justify-content: center; padding: 16px; }
    .soon app-soon { height: auto; max-width: 340px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHost {
  readonly widget = input.required<WidgetInstance>();

  protected readonly soon = computed(() => soonReason(this.widget()));
  protected readonly title = computed(() => defaultWidgetTitle(this.widget()));
}
