import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WidgetInstance } from './data/workspace.model';
import {
  WidgetStatPnl,
  WidgetStatProfitFactor,
  WidgetStatStreak,
  WidgetStatWinrate,
} from './widgets/stat-tiles';
import {
  WidgetDailyPnl,
  WidgetDistribution,
  WidgetDrawdown,
  WidgetDurationScatter,
  WidgetEquityCurve,
  WidgetHeatmapHours,
  WidgetLongShort,
  WidgetRHistogram,
} from './widgets/chart-widgets';
import { WidgetPnlCalendar } from './widgets/pnl-calendar';
import { WidgetBestWorst, WidgetOpenPositions, WidgetRecentTrades } from './widgets/table-widgets';

/** Резолвит тип виджета в компонент. */
@Component({
  selector: 'app-widget-host',
  imports: [
    WidgetStatPnl,
    WidgetStatWinrate,
    WidgetStatProfitFactor,
    WidgetStatStreak,
    WidgetEquityCurve,
    WidgetDailyPnl,
    WidgetDrawdown,
    WidgetDistribution,
    WidgetLongShort,
    WidgetRHistogram,
    WidgetHeatmapHours,
    WidgetDurationScatter,
    WidgetPnlCalendar,
    WidgetRecentTrades,
    WidgetOpenPositions,
    WidgetBestWorst,
  ],
  template: `
    @switch (widget().type) {
      @case ('stat-pnl') { <app-widget-stat-pnl [settings]="widget().settings" /> }
      @case ('stat-winrate') { <app-widget-stat-winrate [settings]="widget().settings" /> }
      @case ('stat-profit-factor') { <app-widget-stat-profit-factor [settings]="widget().settings" /> }
      @case ('stat-streak') { <app-widget-stat-streak [settings]="widget().settings" /> }
      @case ('equity-curve') { <app-widget-equity-curve [settings]="widget().settings" /> }
      @case ('daily-pnl') { <app-widget-daily-pnl [settings]="widget().settings" /> }
      @case ('drawdown') { <app-widget-drawdown [settings]="widget().settings" /> }
      @case ('distribution') { <app-widget-distribution [settings]="widget().settings" /> }
      @case ('long-short') { <app-widget-long-short [settings]="widget().settings" /> }
      @case ('r-histogram') { <app-widget-r-histogram [settings]="widget().settings" /> }
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
