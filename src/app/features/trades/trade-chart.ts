import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MarketExchange, TIMEFRAMES, TIMEFRAME_MS, Timeframe } from '../../core/market/market.model';
import { Trade, calculatePnlPercent } from './data/trade.model';
import { TradeChartData, TradeFill, candleIndexAt, tradeFills } from './data/trade-chart.model';
import { TradeChartFeed } from './trade-chart-feed';
import { TradeLayer, TradePalette, tradeMarkup } from './trade-layer';
import { cssVar, currentThemeTick } from '../../shared/charts/chart-theme';
import { ChartDrawingsStore } from '../../shared/nv-chart/chart-drawings-store';
import { NvCandleChart } from '../../shared/nv-chart/nv-candle-chart';
import { candleMeta } from '../../shared/nv-chart/nv-candles';
import { BarRange } from '../../shared/nv-chart/nv-chart.types';
import { DRAWING_TOOLS, DRAWING_TOOL_NAMES } from '../../shared/nv-chart/nv-drawing-tools';
import { NvRuntime } from '../../shared/nv-chart/nv-runtime';
import { Icon } from '../../shared/ui/icon';
import { Tooltip } from '../../shared/ui/tooltip';

/** Сколько свечей воздуха справа от последней у открытой сделки. */
const RIGHT_PAD_CANDLES = 8;

/**
 * Свечной график сделки на chart-engine: тулбар с символом, таймфреймами,
 * инструментами рисования и результатом; на свечах — исполнения, средние
 * входа/выхода и пилюля результата. Свечи — с биржи: история подгружается
 * при прокрутке, текущая свеча обновляется потоком, пока график открыт.
 */
@Component({
  selector: 'app-trade-chart',
  imports: [Icon, Tooltip],
  providers: [TradeChartFeed],
  template: `
    <div class="bar">
      <span class="sym">{{ trade().symbol }}</span>
      <div class="seg" role="tablist" aria-label="Таймфрейм">
        @for (tf of timeframes; track tf) {
          <button
            type="button"
            class="seg-btn tf"
            role="tab"
            [class.active]="tf === timeframe()"
            [attr.aria-selected]="tf === timeframe()"
            (click)="timeframe.set(tf)"
          >
            {{ tf }}
          </button>
        }
      </div>
      <div class="seg" role="toolbar" aria-label="Рисование">
        <button
          type="button"
          class="seg-btn"
          appTooltip="Курсор · Esc"
          aria-label="Курсор"
          [class.active]="activeTool() === null"
          (click)="selectTool(null)"
        >
          <app-icon name="cursor" style="--icon-size: 14px" />
        </button>
        @for (tool of tools; track tool.name) {
          <button
            type="button"
            class="seg-btn"
            [appTooltip]="tool.label + ' · ' + tool.hint"
            [attr.aria-label]="tool.label"
            [attr.aria-pressed]="activeTool() === tool.name"
            [class.active]="activeTool() === tool.name"
            (click)="selectTool(tool.name)"
          >
            <app-icon [name]="tool.icon" style="--icon-size: 14px" />
          </button>
        }
        <button
          type="button"
          class="seg-btn"
          appTooltip="Удалить рисунки"
          aria-label="Удалить рисунки"
          [disabled]="drawingCount() === 0"
          (click)="clearDrawings()"
        >
          <app-icon name="trash" style="--icon-size: 14px" />
        </button>
      </div>
      <span class="spacer"></span>
      @if (feed.loading()) {
        <span class="status">загрузка…</span>
      }
      <span class="side" [class.long]="trade().side === 'long'" [class.short]="trade().side === 'short'">
        <app-icon [name]="trade().side" style="--icon-size: 13px" />
        <b>{{ trade().side === 'long' ? 'LONG' : 'SHORT' }}</b>
        @if (pnlLabel(); as label) {
          <span class="dot">·</span>
          <span class="pnl" [class.pos]="isProfit()" [class.neg]="!isProfit()">{{ label }}</span>
        }
      </span>
    </div>
    <div #host class="chart"></div>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 320px;
      container-type: inline-size;
    }

    .bar {
      display: flex;
      align-items: center;
      gap: $space-3;
      height: 32px;
      padding: 0 $space-2;
      flex: none;
      white-space: nowrap;
    }

    // Узкий график (рядом с таблицей): направление — только значком.
    @container (max-width: 720px) {
      .bar { gap: $space-2; }
      .side b,
      .side .dot { display: none; }
    }

    .sym {
      font-size: $text-sm;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .seg {
      display: flex;
      gap: 2px;
      padding: 2px;
      border: 1px solid var(--border-muted);
      border-radius: $radius-md;
    }

    .seg-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 20px;
      background: none;
      border: none;
      border-radius: $radius-sm;
      padding: 0 5px;
      color: var(--fg-muted);
      cursor: pointer;
      transition: background $duration-fast $ease-apple, color $duration-fast $ease-apple;

      &:hover:not(:disabled) { color: var(--fg-default); }
      &:disabled { opacity: 0.4; cursor: default; }

      &.active {
        background: var(--canvas-overlay);
        color: var(--fg-default);
      }
    }

    .tf {
      padding: 0 7px;
      font-family: $font-mono;
      font-size: $text-xs;
    }

    .spacer { flex: 1; }

    .status {
      font-size: $text-xs;
      color: var(--fg-subtle);
    }

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

      b { font-weight: inherit; }
    }

    .dot { color: var(--fg-subtle); }
    .pnl.pos { color: var(--success-fg); }
    .pnl.neg { color: var(--danger-fg); }

    .chart {
      position: relative;
      flex: 1;
      min-height: 0;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeChart {
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(NvRuntime);
  private readonly drawingsStore = inject(ChartDrawingsStore);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly view = new NvCandleChart(this.runtime);
  protected readonly feed = inject(TradeChartFeed);

  readonly trade = input.required<Trade>();
  readonly chartData = input.required<TradeChartData>();
  /** Биржа счёта сделки — с неё свечи и поток. */
  readonly exchange = input<MarketExchange>('binance');
  /** Таймфрейм — двусторонний: родитель перезапрашивает свечи. */
  readonly timeframe = model<Timeframe>('15m');

  protected readonly timeframes = TIMEFRAMES;
  protected readonly tools = DRAWING_TOOLS;
  protected readonly activeTool = this.runtime.activeTool;
  protected readonly drawingCount = signal(0);

  protected readonly isProfit = computed(() => calculatePnlPercent(this.trade()) >= 0);
  protected readonly pnlLabel = computed(() => {
    const t = this.trade();
    if (t.status !== 'closed') return '';
    const pct = calculatePnlPercent(t);
    return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
  });

  private readonly ready = signal(false);
  private readonly layer = new TradeLayer();
  private shown: TradeChartData | null = null;
  private symbol = '';
  private restoring = false;
  private readonly unsubscribers: (() => void)[] = [];

  constructor() {
    afterNextRender(() => void this.mountChart());

    effect(() => {
      const data = this.chartData();
      if (this.ready()) untracked(() => this.showCandles(data));
    });

    effect(() => {
      const trade = this.trade();
      const data = this.chartData();
      const palette = this.palette();
      if (this.ready()) untracked(() => this.paintTrade(trade, data, palette));
    });

    effect(() => {
      currentThemeTick();
      if (this.ready()) this.view.chart?.refreshTheme();
    });

    effect(() => {
      const live = this.feed.live();
      if (this.ready()) this.view.chart?.setOptions({ candleTimer: live });
    });

    this.destroyRef.onDestroy(() => this.teardown());
  }

  protected selectTool(name: string | null): void {
    this.runtime.setTool(name !== null && this.activeTool() === name ? null : name);
  }

  protected clearDrawings(): void {
    const chart = this.view.chart;
    if (!chart) return;
    this.view.tools?.clear(chart, { undoable: true });
    this.saveDrawings();
  }

  private async mountChart(): Promise<void> {
    const mounted = await this.view.mount(
      this.host().nativeElement,
      { candleTimer: false },
      { history: () => this.feed.loadHistory(), forward: () => this.feed.loadForward() },
    );
    const chart = this.view.chart;
    const tools = this.view.tools;
    if (!mounted || !chart || !tools) return;
    tools.setChartTools(chart, DRAWING_TOOL_NAMES);
    this.view.scene?.add(this.layer);
    for (const event of ['created', 'updated', 'removed'] as const) {
      this.unsubscribers.push(
        tools.on(event, (e) => {
          if (e.chart === chart) this.saveDrawings();
        }),
      );
    }
    this.ready.set(true);
  }

  private showCandles(data: TradeChartData): void {
    if (data === this.shown) return;
    this.shown = data;
    const trade = this.trade();
    const meta = candleMeta(data.priceDecimals, TIMEFRAME_MS[data.timeframe]);
    const open = trade.status === 'open';
    this.view.reset(data.candles, meta, focusRange(data, tradeFills(trade, data), open));
    this.feed.start(this.view, { exchange: this.exchange(), symbol: trade.symbol }, data.timeframe, data.candles);
    if (trade.symbol !== this.symbol) {
      this.symbol = trade.symbol;
      this.restoreDrawings();
    }
  }

  private paintTrade(trade: Trade, data: TradeChartData, palette: TradePalette): void {
    this.layer.set(tradeMarkup(trade, tradeFills(trade, data), this.pnlLabel()), palette);
    this.view.scene?.refresh();
  }

  /** Рисунки символа из хранилища — на любом таймфрейме и любой его сделке. */
  private restoreDrawings(): void {
    const chart = this.view.chart;
    const tools = this.view.tools;
    if (!chart || !tools) return;
    this.restoring = true;
    try {
      tools.clear(chart);
      for (const drawing of this.drawingsStore.load(this.symbol)) {
        try {
          tools.add(chart, drawing);
        } catch {
          // рисунок неизвестного движку инструмента — пропускаем
        }
      }
    } finally {
      this.restoring = false;
    }
    this.drawingCount.set(tools.list(chart).length);
  }

  private saveDrawings(): void {
    const chart = this.view.chart;
    const tools = this.view.tools;
    if (!chart || !tools || this.restoring) return;
    const drawings = tools.list(chart);
    this.drawingsStore.save(this.symbol, drawings);
    this.drawingCount.set(drawings.length);
  }

  /** Цвета разметки — из токенов темы (cssVar отслеживает её смену). */
  private palette(): TradePalette {
    return {
      up: cssVar('--success-fg', '#3fb950'),
      down: cssVar('--danger-fg', '#f85149'),
      back: cssVar('--canvas-subtle', '#161b22'),
      onColor: cssVar('--canvas-default', '#0d1117'),
    };
  }

  private teardown(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.feed.stop();
    this.view.destroy();
  }
}

/** Вид на сделку: от входа до выхода с запасом по краям; у открытой — до последней свечи. */
function focusRange(data: TradeChartData, fills: readonly TradeFill[], open: boolean): BarRange {
  const candles = data.candles;
  const last = candles.length - 1;
  if (fills.length === 0) return { from: last - 120, to: last + RIGHT_PAD_CANDLES };
  const entry = candleIndexAt(candles, fills[0].time);
  const exit = open ? last : candleIndexAt(candles, fills[fills.length - 1].time);
  const span = exit - entry;
  const from = entry - Math.max(40, Math.round(span * 0.5));
  const to = Math.max(exit + Math.max(16, Math.round(span * 0.3)), from + 60);
  return { from, to: Math.min(to, last + RIGHT_PAD_CANDLES) };
}
