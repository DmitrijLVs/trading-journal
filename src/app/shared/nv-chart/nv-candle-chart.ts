import type { CandleDataset, Chart, ChartOptions } from '@nv/core';
import type { Drawings } from '@nv/tools';
import type { Candle } from '../../core/market/market.model';
import { toCandleBar, toCandleSeries } from './nv-candles';
import { BarRange, CandleMeta, CandleSink, NvContext } from './nv-chart.types';
import { NvRuntime } from './nv-runtime';
import { Scene } from './nv-scene.types';

export interface CandleChartHandlers {
  /** Вид дошёл до первой загруженной свечи — пора подгрузить историю. */
  history(): void;
  /** Вид дошёл до последней загруженной свечи — пора догрузить вперёд. */
  forward(): void;
}

/**
 * Свечной график на chart-engine: монтирование в элемент, свечи в наборе
 * данных движка (история спереди, догрузка сзади, живая свеча) и вид на
 * заданный диапазон баров, который держится, пока график не узнал ширину.
 */
export class NvCandleChart implements CandleSink {
  private static sequence = 0;

  private context: NvContext | null = null;
  private current: Chart | null = null;
  private currentScene: Scene | null = null;
  private dataset: CandleDataset | null = null;
  private meta: CandleMeta | null = null;
  private rows = 0;
  private lastTime = -Infinity;
  private generation = 0;
  private kept: BarRange | null = null;
  private keptWidth = 0;

  constructor(private readonly runtime: NvRuntime) {}

  get chart(): Chart | null {
    return this.current;
  }

  get scene(): Scene | null {
    return this.currentScene;
  }

  get tools(): Drawings | null {
    return this.context?.tools ?? null;
  }

  async mount(host: HTMLElement, options: ChartOptions, handlers: CandleChartHandlers): Promise<boolean> {
    const generation = ++this.generation;
    const context = await this.runtime.load().catch(() => null);
    if (!context || generation !== this.generation) return false;
    this.release();
    const chart = context.runtime.createChart(host, { theme: 'css', legendActions: false, ...options });
    chart.pane(0).add('sceneBounds', {});
    chart.on('range', (range) => this.track(range.fromIndex, range.toIndex, handlers));
    chart.on('history', () => handlers.history());
    this.context = context;
    this.current = chart;
    this.currentScene = context.scenes.sceneOf(chart);
    return true;
  }

  /** Новые свечи целиком (смена сделки или таймфрейма); вид — на `focus`. */
  reset(candles: readonly Candle[], meta: CandleMeta, focus: BarRange): void {
    const context = this.context;
    const chart = this.current;
    if (!context || !chart) return;
    const series = toCandleSeries(candles, meta);
    // Свой набор на каждую загрузку: два графика одной сделки не делят догрузку.
    const dataset = context.runtime.dataset(`trade-chart-${++NvCandleChart.sequence}`, {
      tickSize: meta.tickSize,
      intervalMs: meta.intervalMs,
      pricePrecision: meta.decimals,
    });
    dataset.set(series);
    chart.setDataset(dataset);
    this.dataset?.release();
    this.dataset = dataset;
    this.meta = meta;
    this.rows = series.rows;
    this.lastTime = series.rows > 0 ? series.time[series.rows - 1] : -Infinity;
    this.fit(focus);
  }

  prepend(candles: readonly Candle[]): void {
    if (!this.dataset || !this.meta || candles.length === 0) return;
    this.rows += this.dataset.prepend(toCandleSeries(candles, this.meta));
  }

  append(candles: readonly Candle[]): void {
    const fresh = candles.filter((candle) => candle[0] > this.lastTime);
    if (!this.dataset || !this.meta || fresh.length === 0) return;
    this.dataset.append(toCandleSeries(fresh, this.meta));
    this.rows += fresh.length;
    this.lastTime = fresh[fresh.length - 1][0];
  }

  update(candle: Candle): void {
    if (!this.dataset || !this.meta || candle[0] < this.lastTime) return;
    this.dataset.update(toCandleBar(candle, this.meta));
    if (candle[0] > this.lastTime) {
      this.rows += 1;
      this.lastTime = candle[0];
    }
  }

  fit(range: BarRange): void {
    this.kept = range;
    this.keptWidth = 0;
    this.applyKept();
  }

  destroy(): void {
    this.generation += 1;
    this.release();
  }

  private track(from: number, to: number, handlers: CandleChartHandlers): void {
    const width = this.plotWidth();
    if (!width) return;
    if (this.kept) {
      // Раскладка или ресайз до первого жеста: держим заданный диапазон баров.
      if (width !== this.keptWidth) {
        this.applyKept();
        return;
      }
      // Пользователь сдвинул вид — дальше ширина плота (она меняется и
      // от подписей оси цен) вид не трогает.
      if (Math.abs(from - this.kept.from) > 0.5 || Math.abs(to - this.kept.to) > 0.5) {
        this.kept = null;
      }
    }
    if (this.rows > 0 && to >= this.rows - 1 - Math.max(10, (to - from) / 2)) handlers.forward();
  }

  private applyKept(): void {
    const chart = this.current;
    const width = this.plotWidth();
    if (!chart || !width || !this.kept) return;
    this.keptWidth = width;
    chart.timeScale().setLogicalRange(this.kept);
  }

  private plotWidth(): number {
    return this.current?.pane(0).box()?.width ?? 0;
  }

  private release(): void {
    this.current?.destroy();
    this.dataset?.release();
    this.current = null;
    this.currentScene = null;
    this.dataset = null;
    this.meta = null;
    this.rows = 0;
    this.lastTime = -Infinity;
    this.kept = null;
    this.keptWidth = 0;
  }
}
