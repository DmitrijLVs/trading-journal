import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

/**
 * Цвета графиков — дублируют дизайн-токены (_tokens.scss).
 * P&L кодируется полюсами success/danger + обязательным знаком в подписи;
 * категориальные серии — синий/оранжевый/фиолетовый/бирюза (без соседства
 * красного с зелёным — CVD).
 */
export const CHART = {
  pos: '#3fb950',
  posSubtle: 'rgba(63, 185, 80, 0.16)',
  neg: '#f85149',
  negSubtle: 'rgba(248, 81, 73, 0.16)',
  accent: '#0a84ff',
  accentSubtle: 'rgba(10, 132, 255, 0.16)',
  orange: '#ff9f0a',
  purple: '#bf5af2',
  teal: '#40c8e0',
  fg: '#e6edf3',
  fgMuted: '#7d8590',
  fgSubtle: '#6e7681',
  grid: '#21262d',
  border: '#30363d',
  surface: '#161b22',
  overlay: '#1c2128',
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

/** Категориальный порядок — фиксированный, не циклится. */
export const CATEGORICAL = [CHART.accent, CHART.orange, CHART.purple, CHART.teal] as const;

let registered = false;

/** Регистрирует echarts-модули и тему один раз на приложение. */
export function setupECharts(): void {
  if (registered) return;
  registered = true;

  echarts.use([
    LineChart,
    BarChart,
    PieChart,
    ScatterChart,
    HeatmapChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    VisualMapComponent,
    CalendarComponent,
    MarkLineComponent,
    DataZoomComponent,
    CanvasRenderer,
  ]);

  echarts.registerTheme('tj-dark', {
    darkMode: true,
    backgroundColor: 'transparent',
    color: [...CATEGORICAL],
    textStyle: { fontFamily: CHART.sans, color: CHART.fgMuted },
    categoryAxis: axisDefaults(),
    valueAxis: axisDefaults(),
    timeAxis: axisDefaults(),
    legend: {
      textStyle: { color: CHART.fgMuted, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
  });
}

function axisDefaults(): Record<string, unknown> {
  return {
    axisLine: { lineStyle: { color: CHART.border } },
    axisTick: { show: false },
    axisLabel: { color: CHART.fgSubtle, fontSize: 10, fontFamily: CHART.mono },
    splitLine: { lineStyle: { color: CHART.grid, type: [2, 3] } },
    splitArea: { show: false },
  };
}

/** Базовый tooltip: тёмная плашка, моноширинные значения. */
export function baseTooltip(): Record<string, unknown> {
  return {
    backgroundColor: CHART.overlay,
    borderColor: CHART.border,
    borderWidth: 1,
    padding: [6, 10],
    textStyle: { color: CHART.fg, fontSize: 11, fontFamily: CHART.mono },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.5); border-radius: 8px;',
    confine: true,
  };
}

/** Компактная сетка виджета. */
export function baseGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { left: 8, right: 12, top: 14, bottom: 4, containLabel: true, ...overrides };
}

export { echarts };
