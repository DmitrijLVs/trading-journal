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
import { currentThemeTick } from '../../core/state/theme-tick';

export { bumpThemeTick, currentThemeTick } from '../../core/state/theme-tick';

/** Читает CSS-переменную темы с :root; fallback — на случай SSR/тестов без DOM. */
export function cssVar(name: string, fallback: string): string {
  currentThemeTick(); // зависимость: пересчёт опций графиков при смене темы
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** `#rrggbb` → `rgba(r, g, b, a)` — canvas не понимает color-mix(). */
export function alpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Смешивает два `#rrggbb` (t = доля второго) — для промежуточных ступеней шкал. */
export function mix(hexA: string, hexB: string, t: number): string {
  const parse = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    return m ? parseInt(m[1], 16) : 0;
  };
  const a = parse(hexA);
  const b = parse(hexB);
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/**
 * Цвета графиков — читаются из дизайн-токенов (_tokens.scss → :root), поэтому
 * смена палитры в одном файле перекрашивает и canvas-графики.
 * P&L кодируется полюсами success/danger + обязательным знаком в подписи;
 * категориальные серии — синий/оранжевый/фиолетовый/бирюза (без соседства
 * красного с зелёным — CVD).
 */
export const CHART = {
  get pos() { return cssVar('--success-fg', '#3fb950'); },
  get posSubtle() { return alpha(this.pos, 0.16); },
  get neg() { return cssVar('--danger-fg', '#f85149'); },
  get negSubtle() { return alpha(this.neg, 0.16); },
  get accent() { return cssVar('--accent-fg', '#0a84ff'); },
  get accentSubtle() { return alpha(this.accent, 0.16); },
  get orange() { return cssVar('--attention-fg', '#ff9f0a'); },
  get purple() { return cssVar('--done-fg', '#bf5af2'); },
  get teal() { return cssVar('--teal-fg', '#40c8e0'); },
  get fg() { return cssVar('--fg-default', '#e6edf3'); },
  get fgMuted() { return cssVar('--fg-muted', '#7d8590'); },
  get fgSubtle() { return cssVar('--fg-subtle', '#6e7681'); },
  get grid() { return cssVar('--border-muted', '#21262d'); },
  get border() { return cssVar('--border-default', '#30363d'); },
  get surface() { return cssVar('--canvas-subtle', '#161b22'); },
  get overlay() { return cssVar('--canvas-overlay', '#1c2128'); },
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

/** Категориальный порядок — фиксированный, не циклится. */
export function categorical(): string[] {
  return [CHART.accent, CHART.orange, CHART.purple, CHART.teal];
}

let registered = false;

/** Регистрирует echarts-модули (один раз) и тему из текущих токенов. */
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

  registerChartTheme();
}

/** (Пере)регистрирует тему `tj` из актуальных токенов — вызывать при смене темы. */
export function registerChartTheme(): void {
  echarts.registerTheme('tj', {
    backgroundColor: 'transparent',
    color: categorical(),
    textStyle: { fontFamily: CHART.sans, color: CHART.fgMuted },
    categoryAxis: axisDefaults(),
    valueAxis: axisDefaults(),
    timeAxis: axisDefaults(),
    legend: {
      textStyle: { color: CHART.fgMuted, fontSize: 12 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
  });
}

function axisDefaults(): Record<string, unknown> {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: CHART.fgMuted, fontSize: 12, fontFamily: CHART.mono, margin: 12 },
    splitLine: { lineStyle: { color: CHART.grid, width: 1 } },
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
    textStyle: { color: CHART.fg, fontSize: 13, fontFamily: CHART.mono },
    extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,.5); border-radius: 10px;',
    confine: true,
  };
}

/** Компактная сетка виджета. */
export function baseGrid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { left: 10, right: 16, top: 18, bottom: 6, containLabel: true, ...overrides };
}

export { echarts };
