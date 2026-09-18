import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { WidgetBase } from './widget-base';
import { EChart } from '../../../shared/charts/echart';
import { EmptyState } from '../../../shared/ui/empty-state';
import { CHART, alpha, baseGrid, baseTooltip, mix } from '../../../shared/charts/chart-theme';
import {
  GroupStat,
  WEEKDAY_LABELS,
  dailyPnl,
  equityCurve,
  groupBy,
  groupByHour,
  groupBySession,
  groupByWeekday,
  hourWeekdayHeatmap,
  rHistogram,
} from '../../analytics/data/metrics';
import {
  calculatePnl,
  calculateRMultiple,
  durationMs,
  formatCompact,
  formatMoney,
  formatPercent,
} from '../../trades/data/trade.model';
import { GroupKey } from '../data/workspace.model';

/** Общий каркас чартового виджета: график или пустое состояние. */
const CHART_WIDGET_TEMPLATE = `
  @if (hasData()) {
    <app-echart [options]="options()" />
  } @else {
    <app-empty-state icon="chart-line" title="Нет данных за период" description="Измените период или добавьте сделки." />
  }
`;

const CHART_WIDGET_STYLE = `
  :host { display: block; height: 100%; padding: 6px 6px 8px; }
`;

// ── Кривая капитала ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-widget-equity-curve',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetEquityCurve extends WidgetBase {
  private readonly curve = computed(() => equityCurve(this.trades()));
  protected readonly hasData = computed(() => this.curve().length > 1);

  protected readonly options = computed<EChartsCoreOption>(() => {
    const points = this.curve();
    const showDrawdown = this.settings().showDrawdown ?? true;
    const equityData = points.map((p) => [p.time, round2(p.equity)]);
    const drawdownData = points.map((p) => [p.time, round2(-p.drawdown)]);

    return {
      tooltip: {
        ...baseTooltip(),
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: CHART.overlay } },
        valueFormatter: (v: unknown) => formatMoney(Number(v), { sign: true }),
      },
      grid: baseGrid(),
      xAxis: { type: 'time' },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => formatCompact(v) },
      },
      series: [
        {
          name: 'Капитал',
          type: 'line',
          data: equityData,
          showSymbol: false,
          lineStyle: { width: 2, color: CHART.accent },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: alpha(CHART.accent, 0.22) },
                { offset: 1, color: alpha(CHART.accent, 0) },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: CHART.border, type: 'dashed' },
            data: [{ yAxis: 0 }],
          },
        },
        ...(showDrawdown
          ? [
              {
                name: 'Просадка',
                type: 'line',
                data: drawdownData,
                showSymbol: false,
                lineStyle: { width: 1, color: CHART.neg, opacity: 0.5 },
                areaStyle: { color: CHART.negSubtle },
              },
            ]
          : []),
      ],
    };
  });
}

// ── Аккумулятивный профит ────────────────────────────────────────────────────

/**
 * Накопленный результат нарастающим итогом: по умолчанию в процентах от
 * капитала на начало периода (прирост к депозиту), в настройках — в деньгах.
 * Цвет кривой — по знаку итога, ноль подчёркнут пунктиром.
 */
@Component({
  selector: 'app-widget-cumulative-profit',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCumulativeProfit extends WidgetBase {
  private readonly curve = computed(() => equityCurve(this.trades()));
  protected readonly hasData = computed(() => this.curve().length > 1);

  /** Проценты, если попросили и есть от чего считать; иначе деньги. */
  private readonly asPercent = computed(
    () => (this.settings().valueMode ?? 'percent') === 'percent' && this.baseBalance() > 0,
  );

  protected readonly options = computed<EChartsCoreOption>(() => {
    const points = this.curve();
    const base = this.baseBalance();
    const percent = this.asPercent();
    const scale = percent ? 100 / base : 1;
    const data = points.map((p) => [p.time, round2(p.equity * scale)]);
    const last = points[points.length - 1]?.equity ?? 0;
    const color = last >= 0 ? CHART.pos : CHART.neg;
    const fmt = (value: number) =>
      percent ? formatPercent(value, { sign: true }) : formatMoney(value, { sign: true });

    return {
      tooltip: {
        ...baseTooltip(),
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: CHART.overlay } },
        valueFormatter: (v: unknown) => fmt(Number(v)),
      },
      grid: baseGrid(),
      xAxis: { type: 'time' },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => (percent ? `${v.toFixed(0)}%` : formatCompact(v)),
        },
      },
      series: [
        {
          name: percent ? 'Прирост к депозиту' : 'Накопленный профит',
          type: 'line',
          data,
          showSymbol: false,
          lineStyle: { width: 2, color },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: alpha(color, 0.28) },
                { offset: 1, color: alpha(color, 0) },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: CHART.border, type: 'dashed' },
            data: [{ yAxis: 0 }],
          },
        },
      ],
    };
  });
}

// ── Просадка ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-widget-drawdown',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDrawdown extends WidgetBase {
  private readonly curve = computed(() => equityCurve(this.trades()));
  protected readonly hasData = computed(() => this.curve().length > 1);

  protected readonly options = computed<EChartsCoreOption>(() => ({
    tooltip: {
      ...baseTooltip(),
      trigger: 'axis',
      valueFormatter: (v: unknown) => formatMoney(Number(v), { sign: true }),
    },
    grid: baseGrid(),
    xAxis: { type: 'time' },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCompact(v) } },
    series: [
      {
        name: 'Просадка',
        type: 'line',
        data: this.curve().map((p) => [p.time, round2(-p.drawdown)]),
        showSymbol: false,
        lineStyle: { width: 1.5, color: CHART.neg },
        areaStyle: { color: CHART.negSubtle },
      },
    ],
  }));
}

// ── Дневной P&L ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-widget-daily-pnl',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDailyPnl extends WidgetBase {
  private readonly days = computed(() => dailyPnl(this.trades()));
  protected readonly hasData = computed(() => this.days().length > 0);

  protected readonly options = computed<EChartsCoreOption>(() => {
    const days = this.days();
    return {
      tooltip: {
        ...baseTooltip(),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0];
          const day = days[p.dataIndex];
          return `${day.date}<br/>${formatMoney(day.pnl, { sign: true })} · ${day.count} сд.`;
        },
      },
      grid: baseGrid(),
      xAxis: {
        type: 'category',
        data: days.map((d) => d.date.slice(5)),
        axisLabel: { interval: Math.max(0, Math.ceil(days.length / 14) - 1) },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCompact(v) } },
      series: [
        {
          name: 'P&L',
          type: 'bar',
          data: days.map((d) => ({
            value: round2(d.pnl),
            itemStyle: { color: d.pnl >= 0 ? CHART.pos : CHART.neg, borderRadius: barRadius(d.pnl) },
          })),
          barMaxWidth: 26,
          barCategoryGap: '25%',
        },
      ],
    };
  });
}

// ── Распределение по ключу ──────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  pnl: 'P&L',
  count: 'Сделки',
  winrate: 'Винрейт',
  avgR: 'Средний R',
};

@Component({
  selector: 'app-widget-distribution',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDistribution extends WidgetBase {
  private readonly groups = computed<GroupStat[]>(() => {
    const key = this.settings().groupBy ?? 'symbol';
    const trades = this.trades();
    const stats = groupStats(trades, key);
    const limit = this.settings().limit ?? 10;
    // Сортировка по |метрике| — важное видно сразу; время оставляем по порядку.
    if (key === 'weekday' || key === 'hour') return stats;
    const metric = this.settings().metric ?? 'pnl';
    return [...stats]
      .sort((a, b) => Math.abs(metricValue(b, metric)) - Math.abs(metricValue(a, metric)))
      .slice(0, limit);
  });

  protected readonly hasData = computed(() => this.groups().length > 0);

  protected readonly options = computed<EChartsCoreOption>(() => {
    const metric = this.settings().metric ?? 'pnl';
    const key = this.settings().groupBy ?? 'symbol';
    const horizontal = key !== 'weekday' && key !== 'hour';
    // Горизонтальные бары читаются сверху вниз — разворачиваем порядок.
    const groups = horizontal ? [...this.groups()].reverse() : this.groups();

    const values = groups.map((g) => {
      const v = metricValue(g, metric);
      return {
        value: round2(v),
        itemStyle: {
          color: metricColor(v, metric),
          borderRadius: horizontal ? hBarRadius(v) : barRadius(v),
        },
      };
    });

    const catAxis = { type: 'category', data: groups.map((g) => g.key) };
    const valAxis = {
      type: 'value',
      axisLabel: {
        formatter: (v: number) => (metric === 'winrate' ? `${v}%` : formatCompact(v)),
      },
    };

    return {
      tooltip: {
        ...baseTooltip(),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.04)' } },
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0];
          const g = groups[p.dataIndex];
          return [
            `<b>${g.key}</b>`,
            `${METRIC_LABELS[metric]}: ${formatMetric(metricValue(g, metric), metric)}`,
            `${g.count} сд. · винрейт ${(g.winRate * 100).toFixed(0)}%`,
          ].join('<br/>');
        },
      },
      grid: baseGrid(horizontal ? { left: 4 } : {}),
      xAxis: horizontal ? valAxis : catAxis,
      yAxis: horizontal ? catAxis : valAxis,
      series: [
        {
          name: METRIC_LABELS[metric],
          type: 'bar',
          data: values,
          barMaxWidth: horizontal ? 16 : 30,
          barCategoryGap: '30%',
          label: horizontal
            ? {
                show: true,
                position: 'insideLeft',
                distance: 6,
                color: CHART.fg,
                fontSize: 10,
                fontFamily: CHART.mono,
                formatter: (p: { dataIndex: number }) =>
                  formatMetric(metricValue(groups[p.dataIndex], metric), metric),
              }
            : { show: false },
        },
      ],
    };
  });
}

// ── Гистограмма R ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-widget-r-histogram',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetRHistogram extends WidgetBase {
  private readonly buckets = computed(() => rHistogram(this.trades()));
  protected readonly hasData = computed(() => this.buckets().length > 0);

  protected readonly options = computed<EChartsCoreOption>(() => {
    const buckets = this.buckets();
    return {
      tooltip: {
        ...baseTooltip(),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = (params as { dataIndex: number }[])[0];
          const b = buckets[p.dataIndex];
          return `${fmtR(b.from)}…${fmtR(b.from + 0.5)}<br/>${b.count} сделок`;
        },
      },
      grid: baseGrid(),
      xAxis: {
        type: 'category',
        data: buckets.map((b) => fmtR(b.from)),
      },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: 'Сделки',
          type: 'bar',
          data: buckets.map((b) => ({
            value: b.count,
            itemStyle: {
              color: b.from >= 0 ? CHART.pos : CHART.neg,
              borderRadius: [3, 3, 0, 0],
              opacity: 0.45 + Math.min(0.55, Math.abs(b.from) / 4),
            },
          })),
          barCategoryGap: '18%',
        },
      ],
    };
  });
}

// ── Лонг / Шорт ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-widget-long-short',
  imports: [EChart, EmptyState],
  template: `
    @if (hasData()) {
      <div class="split">
        <app-echart [options]="options()" />
        <div class="legend">
          @for (row of rows(); track row.key) {
            <div class="row">
              <span class="dot" [style.background]="row.color"></span>
              <span class="name">{{ row.key }}</span>
              <span class="val" [class.pos]="row.pnl > 0" [class.neg]="row.pnl < 0">
                {{ fmt(row.pnl) }}
              </span>
              <span class="meta">{{ row.count }} сд. · {{ (row.winRate * 100).toFixed(0) }}%</span>
            </div>
          }
        </div>
      </div>
    } @else {
      <app-empty-state icon="chart-pie" title="Нет данных за период" />
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; }
    .split { display: flex; height: 100%; align-items: center; padding: $space-2 $space-3; gap: $space-2; }
    app-echart { flex: 1.1; min-width: 0; height: 100%; }
    .legend { flex: 1; display: flex; flex-direction: column; gap: $space-3; min-width: 0; }
    .row { display: grid; grid-template-columns: 8px 1fr; gap: 3px $space-2; align-items: center; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .name { font-size: $text-sm; font-weight: 600; }
    .val { grid-column: 2; font-family: $font-mono; font-size: $text-sm; }
    .val.pos { color: var(--success-fg); }
    .val.neg { color: var(--danger-fg); }
    .meta { grid-column: 2; color: var(--fg-subtle); font-size: $text-xs; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLongShort extends WidgetBase {
  protected readonly rows = computed(() => {
    const stats = groupBy(this.trades(), (t) => (t.side === 'long' ? 'Лонг' : 'Шорт'));
    return stats.map((s) => ({ ...s, color: s.key === 'Лонг' ? CHART.pos : CHART.neg }));
  });

  protected readonly hasData = computed(() => this.rows().length > 0);

  protected readonly options = computed<EChartsCoreOption>(() => ({
    tooltip: {
      ...baseTooltip(),
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number; percent: number };
        return `${item.name}: ${item.value} сд. (${item.percent}%)`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '82%'],
        center: ['50%', '50%'],
        // 2px разрыв между сегментами — spacer из спецификации marks.
        itemStyle: { borderColor: CHART.surface, borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        data: this.rows().map((r) => ({
          name: r.key,
          value: r.count,
          itemStyle: { color: r.color },
        })),
      },
    ],
  }));

  protected fmt(value: number): string {
    return formatMoney(value, { sign: true });
  }
}

// ── Теплокарта часы × дни ───────────────────────────────────────────────────

@Component({
  selector: 'app-widget-heatmap-hours',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHeatmapHours extends WidgetBase {
  private readonly cells = computed(() => hourWeekdayHeatmap(this.trades()));
  protected readonly hasData = computed(() => this.cells().length > 0);

  protected readonly options = computed<EChartsCoreOption>(() => {
    const cells = this.cells();
    const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(c.pnl)));
    return {
      tooltip: {
        ...baseTooltip(),
        formatter: (p: unknown) => {
          const { value } = p as { value: [number, number, number] };
          const cell = cells.find((c) => c.hour === value[0] && c.weekday === value[1]);
          return `${WEEKDAY_LABELS[value[1]]}, ${String(value[0]).padStart(2, '0')}:00 UTC<br/>${formatMoney(value[2], { sign: true })} · ${cell?.count ?? 0} сд.`;
        },
      },
      grid: baseGrid({ top: 6, bottom: 30 }),
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
        splitArea: { show: false },
        axisLabel: { interval: 2 },
      },
      yAxis: {
        type: 'category',
        data: [...WEEKDAY_LABELS],
        inverse: true,
      },
      visualMap: {
        type: 'continuous',
        min: -maxAbs,
        max: maxAbs,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemHeight: 90,
        itemWidth: 10,
        textStyle: { color: CHART.fgSubtle, fontSize: 9 },
        // Дивергентная шкала: полюса P&L с нейтральной серединой.
        inRange: {
          color: [CHART.neg, mix(CHART.neg, CHART.grid, 0.7), CHART.grid, mix(CHART.pos, CHART.grid, 0.7), CHART.pos],
        },
        formatter: (v: number) => formatCompact(v),
      },
      series: [
        {
          name: 'P&L',
          type: 'heatmap',
          data: cells.map((c) => [c.hour, c.weekday, round2(c.pnl)]),
          itemStyle: { borderColor: CHART.surface, borderWidth: 2, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: CHART.fgSubtle } },
        },
      ],
    };
  });
}

// ── P&L × длительность ──────────────────────────────────────────────────────

@Component({
  selector: 'app-widget-duration-scatter',
  imports: [EChart, EmptyState],
  template: CHART_WIDGET_TEMPLATE,
  styles: CHART_WIDGET_STYLE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDurationScatter extends WidgetBase {
  private readonly points = computed(() =>
    this.trades()
      .filter((t) => t.status === 'closed')
      .map((t) => ({
        minutes: Math.max(1, durationMs(t) / 60_000),
        pnl: calculatePnl(t),
        r: calculateRMultiple(t),
        symbol: t.symbol,
      })),
  );

  protected readonly hasData = computed(() => this.points().length > 0);

  protected readonly options = computed<EChartsCoreOption>(() => {
    const points = this.points();
    return {
      tooltip: {
        ...baseTooltip(),
        formatter: (p: unknown) => {
          const { dataIndex } = p as { dataIndex: number };
          const pt = points[dataIndex];
          return `<b>${pt.symbol}</b><br/>${formatMoney(pt.pnl, { sign: true })} · ${fmtDurationMin(pt.minutes)}`;
        },
      },
      grid: baseGrid(),
      xAxis: {
        type: 'log',
        logBase: 10,
        name: 'длительность',
        nameTextStyle: { color: CHART.fgSubtle, fontSize: 9 },
        axisLabel: { formatter: (v: number) => fmtDurationMin(v) },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCompact(v) } },
      series: [
        {
          type: 'scatter',
          data: points.map((pt) => ({
            value: [pt.minutes, round2(pt.pnl)],
            itemStyle: {
              color: pt.pnl >= 0 ? CHART.pos : CHART.neg,
              opacity: 0.65,
              borderColor: CHART.surface,
              borderWidth: 1,
            },
          })),
          symbolSize: (v: [number, number], p: { dataIndex: number }) => {
            const r = points[p.dataIndex].r;
            return 6 + Math.min(10, Math.abs(r ?? 1) * 2.5);
          },
        },
      ],
    };
  });
}

// ── Вспомогательные ────────────────────────────────────────────────────────

function groupStats(trades: Parameters<typeof groupBy>[0], key: GroupKey): GroupStat[] {
  switch (key) {
    case 'symbol':
      return groupBy(trades, (t) => t.symbol);
    case 'strategy':
      return groupBy(trades, (t) => t.strategy);
    case 'tag':
      return groupBy(trades, (t) => t.tags);
    case 'mistake':
      return groupBy(trades, (t) => t.mistakes);
    case 'setup':
      return groupBy(trades, (t) => (t.setupGrade ? `Сетап ${t.setupGrade}` : ''));
    case 'session':
      return groupBySession(trades);
    case 'weekday':
      return groupByWeekday(trades);
    case 'hour':
      return groupByHour(trades);
  }
}

function metricValue(g: GroupStat, metric: string): number {
  switch (metric) {
    case 'count':
      return g.count;
    case 'winrate':
      return g.winRate * 100;
    case 'avgR':
      return g.avgR ?? 0;
    default:
      return g.pnl;
  }
}

function metricColor(value: number, metric: string): string {
  if (metric === 'count') return CHART.accent;
  if (metric === 'winrate') return value >= 50 ? CHART.pos : CHART.orange;
  return value >= 0 ? CHART.pos : CHART.neg;
}

function formatMetric(value: number, metric: string): string {
  switch (metric) {
    case 'count':
      return String(Math.round(value));
    case 'winrate':
      return `${value.toFixed(0)}%`;
    case 'avgR':
      return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}R`;
    default:
      return formatMoney(value, { sign: true });
  }
}

function fmtR(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}R`;
}

function fmtDurationMin(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}м`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)}ч`;
  return `${(minutes / 1440).toFixed(1)}д`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Скругление конца бара — со стороны значения (спека mark specs). */
function barRadius(value: number): [number, number, number, number] {
  return value >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3];
}

function hBarRadius(value: number): [number, number, number, number] {
  return value >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3];
}
