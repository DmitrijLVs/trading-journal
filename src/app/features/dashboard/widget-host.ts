import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WidgetInstance } from './data/workspace.model';
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
import { WidgetAlerts, WidgetDayHero, WidgetDayTimeline } from './widgets/day-widgets';
import { WidgetInsights } from './widgets/insight-widgets';
import { WidgetPeriodResults } from './widgets/period-widgets';
import { WidgetFeeLab, WidgetFeeWaterfall } from './widgets/cost-widgets';

/** Резолвит тип виджета в компонент. */
@Component({
  selector: 'app-widget-host',
  imports: [
    WidgetDayHero,
    WidgetDayTimeline,
    WidgetAlerts,
    WidgetInsights,
    WidgetPeriodResults,
    WidgetFeeLab,
    WidgetFeeWaterfall,
    WidgetStatPnl,
    WidgetSummary,
    WidgetEquityCurve,
    WidgetCumulativeProfit,
    WidgetDailyPnl,
    WidgetDrawdown,
    WidgetDistribution,
    WidgetLongShort,
    WidgetHeatmapHours,
    WidgetDurationScatter,
    WidgetPnlCalendar,
    WidgetRecentTrades,
    WidgetOpenPositions,
    WidgetBestWorst,
  ],
  template: `
    @switch (widget().type) {
      @case ('day-hero') { <app-widget-day-hero [settings]="widget().settings" /> }
      @case ('day-timeline') { <app-widget-day-timeline [settings]="widget().settings" /> }
      @case ('alerts') { <app-widget-alerts [settings]="widget().settings" /> }
      @case ('insights') { <app-widget-insights [settings]="widget().settings" /> }
      @case ('period-results') { <app-widget-period-results [settings]="widget().settings" /> }
      @case ('fee-lab') { <app-widget-fee-lab [settings]="widget().settings" /> }
      @case ('fee-waterfall') { <app-widget-fee-waterfall [settings]="widget().settings" /> }
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
  `,
  styles: `
    :host { display: block; height: 100%; }
    :host > * { height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHost {
  readonly widget = input.required<WidgetInstance>();
}
