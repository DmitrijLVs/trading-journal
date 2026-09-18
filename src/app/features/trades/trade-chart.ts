import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { NightVision } from 'night-vision';
import JOURNAL_SCRIPT from './trade-journal.navy';
import { Trade, calculatePnlPercent, priceDecimals } from './data/trade.model';
import { CHART_TIMEFRAMES, TradeChartData, TradeFill } from '../../core/mock/mock-candles';
import { alpha, cssVar, currentThemeTick } from '../../shared/charts/chart-theme';
import { Icon } from '../../shared/ui/icon';

/** Цвета графика — читаются из токенов темы (:root), как и echarts. */
const COLORS = {
  get back() { return cssVar('--canvas-subtle', '#161b22'); },
  get grid() { return cssVar('--border-muted', '#21262d'); },
  get text() { return cssVar('--fg-muted', '#7d8590'); },
  get textHL() { return cssVar('--fg-default', '#e6edf3'); },
  get cross() { return cssVar('--fg-subtle', '#6e7681'); },
  get candleUp() { return cssVar('--success-fg', '#3fb950'); },
  get candleDw() { return cssVar('--danger-fg', '#f85149'); },
  get wickUp() { return this.candleUp; },
  get wickDw() { return this.candleDw; },
  get volUp() { return alpha(this.candleUp, 0.3); },
  get volDw() { return alpha(this.candleDw, 0.3); },
  get llValue() { return cssVar('--accent-fg', '#0a84ff'); },
  get canvas() { return cssVar('--canvas-default', '#0d1117'); },
};

/** Сколько свечей воздуха справа от последней. */
const RIGHT_PAD_CANDLES = 8;

/**
 * Свечной график сделки на night-vision: тулбар с символом, таймфреймами
 * и результатом; на свечах — исполнения (шевроны на каждом), ступенчатые
 * средние входа/выхода и пилюля результата (скрипт TradeJournal).
 */
@Component({
  selector: 'app-trade-chart',
  imports: [Icon],
  template: `
    <div class="bar">
      <span class="sym">{{ trade().symbol }}</span>
      <div class="tfs" role="tablist" aria-label="Таймфрейм">
        @for (tf of timeframes; track tf) {
          <button
            type="button"
            class="tf"
            role="tab"
            [class.active]="tf === timeframe()"
            [attr.aria-selected]="tf === timeframe()"
            (click)="timeframe.set(tf)"
          >
            {{ tf }}
          </button>
        }
      </div>
      <span class="spacer"></span>
      <span class="side" [class.long]="trade().side === 'long'" [class.short]="trade().side === 'short'">
        <app-icon [name]="trade().side" style="--icon-size: 13px" />
        {{ trade().side === 'long' ? 'LONG' : 'SHORT' }}
        @if (pnlLabel(); as label) {
          <span class="dot">·</span>
          <span class="pnl" [class.pos]="isProfit()" [class.neg]="!isProfit()">{{ label }}</span>
        }
      </span>
    </div>
    <div [id]="chartId" class="chart"></div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 320px;
    }

    .bar {
      display: flex;
      align-items: center;
      gap: $space-3;
      height: 32px;
      padding: 0 $space-2;
      flex: none;
    }

    .sym {
      font-size: $text-sm;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .tfs {
      display: flex;
      gap: 2px;
      padding: 2px;
      border: 1px solid var(--border-muted);
      border-radius: $radius-md;
    }

    .tf {
      appearance: none;
      background: none;
      border: none;
      border-radius: $radius-sm;
      padding: 2px 7px;
      font-family: $font-mono;
      font-size: $text-xs;
      color: var(--fg-muted);
      cursor: pointer;
      transition: background $duration-fast $ease-apple, color $duration-fast $ease-apple;

      &:hover { color: var(--fg-default); }

      &.active {
        background: var(--canvas-overlay);
        color: var(--fg-default);
      }
    }

    .spacer { flex: 1; }

    .side {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: $font-mono;
      font-size: $text-xs;
      font-weight: 600;
      letter-spacing: 0.04em;

      &.long { color: var(--success-fg); }
      &.short { color: var(--danger-fg); }
    }

    .dot { color: var(--fg-subtle); }
    .pnl.pos { color: var(--success-fg); }
    .pnl.neg { color: var(--danger-fg); }

    .chart {
      flex: 1;
      min-height: 0;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeChart {
  private static sequence = 0;

  private readonly destroyRef = inject(DestroyRef);

  readonly trade = input.required<Trade>();
  readonly chartData = input.required<TradeChartData>();
  /** Таймфрейм — двусторонний: родитель перезапрашивает свечи. */
  readonly timeframe = model<string>('15m');

  protected readonly timeframes = CHART_TIMEFRAMES;
  protected readonly chartId = `nv-trade-${(TradeChart.sequence += 1)}`;

  protected readonly isProfit = computed(() => calculatePnlPercent(this.trade()) >= 0);
  protected readonly pnlLabel = computed(() => {
    const t = this.trade();
    if (t.status !== 'closed') return '';
    const pct = calculatePnlPercent(t);
    return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
  });

  private readonly ready = signal(false);
  private chart: NightVision | null = null;
  private chartStep = 0;
  private renderedTick = currentThemeTick();

  constructor() {
    afterNextRender(() => this.ready.set(true));

    effect(() => {
      const trade = this.trade();
      const data = this.chartData();
      const tick = currentThemeTick();
      if (!this.ready()) return;
      if (this.chart && tick !== this.renderedTick) {
        // Палитра night-vision задаётся при создании — пересоздаём график.
        this.chart.destroy();
        this.chart = null;
      }
      this.renderedTick = tick;
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
        ZOOM_Y_SENS: 0,
      },
      data: { panes: [{ overlays: this.overlays(trade, data) }] },
    });
    this.chartStep = candleStep(data);
    const range = viewRange(data);
    if (range) this.chart.range = range;
  }

  private refresh(trade: Trade, data: TradeChartData): void {
    if (!this.chart) return;
    const overlays = this.chart.data.panes[0].overlays as unknown as Record<string, unknown>[];
    const next = this.overlays(trade, data);
    for (let i = 0; i < overlays.length; i += 1) {
      overlays[i]['data'] = next[i]['data'];
      if (next[i]['settings']) overlays[i]['settings'] = next[i]['settings'];
      const nextProps = next[i]['props'] as Record<string, unknown> | undefined;
      if (nextProps) {
        const props = (overlays[i]['props'] ?? {}) as Record<string, unknown>;
        Object.assign(props, nextProps);
        overlays[i]['props'] = props;
      }
    }
    // Смена таймфрейма меняет шаг свечей — нужен полный пересчёт.
    const step = candleStep(data);
    const rescan = step !== this.chartStep;
    this.chartStep = step;
    this.chart.update(rescan ? 'full' : 'data');
    const range = viewRange(data);
    if (range) this.chart.range = range;
  }

  private overlays(trade: Trade, data: TradeChartData): Record<string, unknown>[] {
    const isLong = trade.side === 'long';
    const isProfit = calculatePnlPercent(trade) >= 0;
    const fills = data.fills?.length ? data.fills : fallbackFills(trade, data);
    const entrySide: TradeFill['side'] = isLong ? 'buy' : 'sell';
    const entryFills = fills.filter((f) => f.side === entrySide);
    const exitFills = fills.filter((f) => f.side !== entrySide);

    return [
      {
        name: trade.symbol,
        type: 'Candles',
        main: true,
        data: data.candles,
        settings: { precision: priceDecimals(trade.entryPrice) },
        props: { showValueTracker: false, priceLine: false },
      },
      {
        name: 'Сделка',
        type: 'TradeJournal',
        data: data.candles,
        props: {
          entryLine: runningAverage(entryFills),
          exitLine: runningAverage(exitFills),
          markers: fills.map((f) => [f.index, f.side === 'buy' ? 1 : -1, f.price]),
          entryColor: isLong ? COLORS.candleUp : COLORS.candleDw,
          exitColor: isLong ? COLORS.candleDw : COLORS.candleUp,
          buyColor: COLORS.candleUp,
          sellColor: COLORS.candleDw,
          pnlColor: isProfit ? COLORS.candleUp : COLORS.candleDw,
          onColor: COLORS.canvas,
          backColor: COLORS.back,
          exitPrice: trade.status === 'closed' ? trade.exitPrice : 0,
          pnlLabel: this.pnlLabel(),
        },
      },
    ];
  }
}

function candleStep(data: TradeChartData): number {
  const c = data.candles;
  return c.length < 2 ? 0 : c[1][0] - c[0][0];
}

function viewRange(data: TradeChartData): number[] | null {
  const step = candleStep(data);
  if (!step) return null;
  const c = data.candles;
  return [c[0][0] - step * 0.5, c[c.length - 1][0] + step * RIGHT_PAD_CANDLES];
}

/** Бегущая средневзвешенная по исполнениям: [[индекс свечи, средняя цена], …]. */
function runningAverage(fills: readonly TradeFill[]): number[][] {
  let qty = 0;
  let cost = 0;
  return fills.map((f) => {
    qty += f.qty;
    cost += f.qty * f.price;
    return [f.index, cost / qty];
  });
}

/** Данные без исполнений (реальный бэкенд без fills): одно на вход, одно на выход. */
function fallbackFills(trade: Trade, data: TradeChartData): TradeFill[] {
  const entrySide: TradeFill['side'] = trade.side === 'long' ? 'buy' : 'sell';
  const fills: TradeFill[] = [
    { index: data.entryIndex, side: entrySide, price: trade.entryPrice, qty: trade.quantity },
  ];
  if (data.exitIndex >= 0 && trade.status === 'closed') {
    fills.push({
      index: data.exitIndex,
      side: entrySide === 'buy' ? 'sell' : 'buy',
      price: trade.exitPrice,
      qty: trade.quantity,
    });
  }
  return fills;
}
