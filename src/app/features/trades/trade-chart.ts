import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NightVision } from 'night-vision';
import JOURNAL_SCRIPT from './trade-journal.navy';
import { Trade, calculatePnlPercent, priceDecimals } from './data/trade.model';
import { TradeChartData } from '../../core/mock/mock-candles';

/** Цвета графика — те же токены, что и вся тема. */
const COLORS = {
  back: '#161b22',
  grid: '#21262d',
  text: '#7d8590',
  textHL: '#e6edf3',
  cross: '#6e7681',
  candleUp: '#3fb950',
  candleDw: '#f85149',
  wickUp: '#3fb950',
  wickDw: '#f85149',
  volUp: 'rgba(63, 185, 80, 0.3)',
  volDw: 'rgba(248, 81, 73, 0.3)',
  llValue: '#0a84ff',
};

/** Свечной график сделки на night-vision с разметкой входа/выхода/TP/SL. */
@Component({
  selector: 'app-trade-chart',
  template: `<div [id]="chartId" class="chart"></div>`,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 320px;
    }
    .chart {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeChart {
  private static sequence = 0;

  private readonly destroyRef = inject(DestroyRef);

  readonly trade = input.required<Trade>();
  readonly chartData = input.required<TradeChartData>();

  protected readonly chartId = `nv-trade-${(TradeChart.sequence += 1)}`;

  private readonly ready = signal(false);
  private chart: NightVision | null = null;

  constructor() {
    afterNextRender(() => this.ready.set(true));

    effect(() => {
      const trade = this.trade();
      const data = this.chartData();
      if (!this.ready()) return;
      if (this.chart) {
        this.refresh(trade, data);
      } else {
        this.create(trade, data);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }

  private create(trade: Trade, data: TradeChartData): void {
    this.chart = new NightVision(this.chartId, {
      id: this.chartId,
      autoResize: true,
      colors: COLORS,
      scripts: [JOURNAL_SCRIPT],
      config: {
        TOOLBAR: 0,
        DEFAULT_LEN: data.candles.length,
        SBMIN: 60,
        SBMAX: Infinity,
        BOTBAR: 28,
      },
      data: { panes: [{ overlays: this.overlays(trade, data) }] },
    });
  }

  private refresh(trade: Trade, data: TradeChartData): void {
    if (!this.chart) return;
    const overlays = this.chart.data.panes[0].overlays as unknown as Record<string, unknown>[];
    const next = this.overlays(trade, data);
    for (let i = 0; i < overlays.length; i += 1) {
      overlays[i]['data'] = next[i]['data'];
      if (next[i]['settings']) overlays[i]['settings'] = next[i]['settings'];
      const props = overlays[i]['props'] as Record<string, unknown> | undefined;
      const nextProps = next[i]['props'] as Record<string, unknown> | undefined;
      if (props && nextProps) Object.assign(props, nextProps);
      else if (nextProps) overlays[i]['props'] = nextProps;
    }
    this.chart.update('data', { resetRange: true });
  }

  private overlays(trade: Trade, data: TradeChartData): Record<string, unknown>[] {
    const profit = trade.status === 'closed' ? calculatePnlPercent(trade) : 0;
    const isProfit = profit >= 0;
    const pnlLabel =
      trade.status === 'closed'
        ? `${isProfit ? '+' : '−'}${Math.abs(profit).toFixed(2)}%`
        : `${trade.side === 'long' ? 'LONG' : 'SHORT'} ×${trade.leverage}`;

    return [
      {
        name: trade.symbol,
        type: 'Candles',
        data: data.candles,
        settings: { precision: priceDecimals(trade.entryPrice) },
        props: { showValueTracker: false, priceLine: false },
      },
      {
        name: 'Сделка',
        type: 'TradeJournal',
        data: data.candles,
        props: {
          entryIndex: data.entryIndex,
          exitIndex: data.exitIndex,
          entry: trade.entryPrice,
          exit: trade.status === 'closed' ? trade.exitPrice : 0,
          long: trade.side === 'long' ? 1 : 0,
          sl: trade.stopLoss ?? 0,
          tp: trade.takeProfit ?? 0,
          buyColor: COLORS.candleUp,
          sellColor: COLORS.candleDw,
          pnlColor: isProfit ? COLORS.candleUp : COLORS.candleDw,
          backColor: COLORS.back,
          onColor: '#0d1117',
          pnlLabel,
        },
      },
    ];
  }
}
