import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { EChartsCoreOption, ECharts } from 'echarts/core';
import { currentThemeTick, echarts, registerChartTheme, setupECharts } from './chart-theme';

/**
 * Обёртка ECharts: сигнал options → setOption, авторесайз через
 * ResizeObserver (виджеты дашборда постоянно меняют размер).
 */
@Component({
  selector: 'app-echart',
  template: `<div #host class="host"></div>`,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .host {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EChart {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly destroyRef = inject(DestroyRef);

  readonly options = input.required<EChartsCoreOption>();

  private readonly ready = signal(false);
  private chart: ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private renderedTick = currentThemeTick();

  constructor() {
    setupECharts();

    afterNextRender(() => {
      const el = this.host().nativeElement;
      this.chart = echarts.init(el, 'tj', { renderer: 'canvas' });

      this.resizeObserver = new ResizeObserver(() => {
        this.chart?.resize({ animation: { duration: 160 } });
      });
      this.resizeObserver.observe(el);
      this.ready.set(true);
    });

    effect(() => {
      const options = this.options();
      const tick = currentThemeTick();
      if (!this.ready() || !this.chart) return;
      if (tick !== this.renderedTick) {
        // Цвета осей/легенды живут в теме echarts — пересобираем её и график.
        this.renderedTick = tick;
        registerChartTheme();
        const el = this.host().nativeElement;
        this.chart.dispose();
        this.chart = echarts.init(el, 'tj', { renderer: 'canvas' });
      }
      this.chart.setOption(options, { notMerge: true });
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.chart?.dispose();
      this.chart = null;
    });
  }
}
