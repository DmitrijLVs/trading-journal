import { PeriodPreset } from '../../../core/state/period-store';
import { IconName } from '../../../shared/ui/icons';

/** Типы виджетов — по одному компоненту на тип. */
export type WidgetType =
  | 'stat-pnl'
  | 'stat-winrate'
  | 'stat-profit-factor'
  | 'stat-streak'
  | 'equity-curve'
  | 'daily-pnl'
  | 'drawdown'
  | 'pnl-calendar'
  | 'distribution'
  | 'long-short'
  | 'r-histogram'
  | 'heatmap-hours'
  | 'duration-scatter'
  | 'recent-trades'
  | 'open-positions'
  | 'best-worst';

export type GroupKey =
  | 'symbol'
  | 'strategy'
  | 'tag'
  | 'mistake'
  | 'session'
  | 'weekday'
  | 'hour'
  | 'setup';

export type DistributionMetric = 'pnl' | 'count' | 'winrate' | 'avgR';

/** Настройки экземпляра виджета; каждый виджет читает своё подмножество. */
export interface WidgetSettings {
  /** Пользовательский заголовок (иначе — из реестра). */
  title?: string;
  /** Период данных: 'global' — следовать глобальному периоду. */
  period?: PeriodPreset | 'global';
  groupBy?: GroupKey;
  metric?: DistributionMetric;
  limit?: number;
  showDrawdown?: boolean;
}

export interface WidgetInstance {
  instanceId: string;
  type: WidgetType;
  x: number;
  y: number;
  cols: number;
  rows: number;
  settings: WidgetSettings;
}

export interface Workspace {
  id: string;
  name: string;
  widgets: WidgetInstance[];
}

export interface DashboardState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  layoutLocked: boolean;
}

export const GRID_COLS = 24;
export const GRID_ROWS = 24;

export type WidgetCategory = 'stats' | 'charts' | 'time' | 'tables';

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  stats: 'Показатели',
  charts: 'Графики',
  time: 'Время и календарь',
  tables: 'Таблицы',
};

/** Карточка галереи: тип + дефолтные настройки и размер. */
export interface WidgetDef {
  /** Уникален в галерее; несколько карточек могут давать один type. */
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  icon: IconName;
  category: WidgetCategory;
  cols: number;
  rows: number;
  minCols: number;
  minRows: number;
  defaultSettings?: WidgetSettings;
}

export const WIDGET_REGISTRY: readonly WidgetDef[] = [
  // ── Показатели ──
  {
    id: 'stat-pnl',
    type: 'stat-pnl',
    title: 'Чистый P&L',
    description: 'Итог за период, спарклайн капитала, комиссии.',
    icon: 'coins',
    category: 'stats',
    cols: 6,
    rows: 4,
    minCols: 4,
    minRows: 3,
  },
  {
    id: 'stat-winrate',
    type: 'stat-winrate',
    title: 'Винрейт',
    description: 'Доля прибыльных сделок, счёт побед/поражений.',
    icon: 'percent',
    category: 'stats',
    cols: 6,
    rows: 4,
    minCols: 4,
    minRows: 3,
  },
  {
    id: 'stat-profit-factor',
    type: 'stat-profit-factor',
    title: 'Профит-фактор',
    description: 'Отношение прибыли к убытку, матожидание на сделку.',
    icon: 'scale',
    category: 'stats',
    cols: 6,
    rows: 4,
    minCols: 4,
    minRows: 3,
  },
  {
    id: 'stat-streak',
    type: 'stat-streak',
    title: 'Серии',
    description: 'Текущая серия, лучшие и худшие полосы.',
    icon: 'fire',
    category: 'stats',
    cols: 6,
    rows: 4,
    minCols: 4,
    minRows: 3,
  },
  // ── Графики ──
  {
    id: 'equity-curve',
    type: 'equity-curve',
    title: 'Кривая капитала',
    description: 'Накопленный P&L по закрытию сделок, зоны просадки.',
    icon: 'chart-line',
    category: 'charts',
    cols: 14,
    rows: 10,
    minCols: 8,
    minRows: 6,
  },
  {
    id: 'daily-pnl',
    type: 'daily-pnl',
    title: 'Дневной P&L',
    description: 'Результат по дням: столбцы прибыльных и убыточных дней.',
    icon: 'chart-bar',
    category: 'charts',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 5,
  },
  {
    id: 'drawdown',
    type: 'drawdown',
    title: 'Просадка',
    description: 'Глубина просадки от пика капитала во времени.',
    icon: 'arrow-down-right',
    category: 'charts',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 5,
  },
  {
    id: 'dist-symbol',
    type: 'distribution',
    title: 'По инструментам',
    description: 'P&L, число сделок или винрейт в разрезе тикеров.',
    icon: 'chart-bar',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
    defaultSettings: { groupBy: 'symbol', metric: 'pnl', limit: 10 },
  },
  {
    id: 'dist-strategy',
    type: 'distribution',
    title: 'По стратегиям',
    description: 'Какие сетапы зарабатывают, а какие сливают.',
    icon: 'target',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
    defaultSettings: { groupBy: 'strategy', metric: 'pnl', limit: 10 },
  },
  {
    id: 'dist-tags',
    type: 'distribution',
    title: 'По тегам',
    description: 'Свободная категоризация: результат в разрезе тегов.',
    icon: 'tag',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
    defaultSettings: { groupBy: 'tag', metric: 'pnl', limit: 12 },
  },
  {
    id: 'dist-mistakes',
    type: 'distribution',
    title: 'Цена ошибок',
    description: 'Сколько стоит каждая типовая ошибка.',
    icon: 'alert',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
    defaultSettings: { groupBy: 'mistake', metric: 'pnl', limit: 10 },
  },
  {
    id: 'long-short',
    type: 'long-short',
    title: 'Лонг / Шорт',
    description: 'Баланс направлений и их результативность.',
    icon: 'chart-pie',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 5,
    minRows: 5,
  },
  {
    id: 'r-histogram',
    type: 'r-histogram',
    title: 'Гистограмма R',
    description: 'Распределение исходов в R-multiple: хвосты и стопы.',
    icon: 'chart-bar',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
  },
  {
    id: 'duration-scatter',
    type: 'duration-scatter',
    title: 'P&L × длительность',
    description: 'Сколько держите победителей и убыточные позиции.',
    icon: 'chart-scatter',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
  },
  // ── Время ──
  {
    id: 'pnl-calendar',
    type: 'pnl-calendar',
    title: 'Календарь P&L',
    description: 'Месяц как теплокарта: результат каждого торгового дня.',
    icon: 'calendar',
    category: 'time',
    cols: 10,
    rows: 10,
    minCols: 7,
    minRows: 7,
  },
  {
    id: 'heatmap-hours',
    type: 'heatmap-hours',
    title: 'Часы × дни недели',
    description: 'Когда вы зарабатываете: теплокарта по времени входа.',
    icon: 'grid',
    category: 'time',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 5,
  },
  {
    id: 'dist-session',
    type: 'distribution',
    title: 'По сессиям',
    description: 'Азия, Лондон, Нью-Йорк — где ваш рынок.',
    icon: 'clock',
    category: 'time',
    cols: 8,
    rows: 8,
    minCols: 5,
    minRows: 5,
    defaultSettings: { groupBy: 'session', metric: 'pnl' },
  },
  {
    id: 'dist-weekday',
    type: 'distribution',
    title: 'По дням недели',
    description: 'Результат в разрезе дней недели.',
    icon: 'calendar',
    category: 'time',
    cols: 8,
    rows: 8,
    minCols: 5,
    minRows: 5,
    defaultSettings: { groupBy: 'weekday', metric: 'pnl' },
  },
  // ── Таблицы ──
  {
    id: 'recent-trades',
    type: 'recent-trades',
    title: 'Последние сделки',
    description: 'Свежие сделки с быстрым переходом к разбору.',
    icon: 'table',
    category: 'tables',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 5,
    defaultSettings: { limit: 8 },
  },
  {
    id: 'open-positions',
    type: 'open-positions',
    title: 'Открытые позиции',
    description: 'Текущие позиции с риском и целями.',
    icon: 'zap',
    category: 'tables',
    cols: 12,
    rows: 6,
    minCols: 8,
    minRows: 4,
  },
  {
    id: 'best-worst',
    type: 'best-worst',
    title: 'Лучшие и худшие',
    description: 'Топ прибыльных и убыточных сделок периода.',
    icon: 'star',
    category: 'tables',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 5,
    defaultSettings: { limit: 5 },
  },
];

export function widgetDef(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((d) => d.id === id);
}

export function defaultWidgetTitle(widget: WidgetInstance): string {
  if (widget.settings.title) return widget.settings.title;
  // Ищем карточку реестра, максимально совпадающую по типу и groupBy.
  const match = WIDGET_REGISTRY.find(
    (d) => d.type === widget.type && (d.defaultSettings?.groupBy ?? null) === (widget.settings.groupBy ?? null),
  );
  return match?.title ?? WIDGET_REGISTRY.find((d) => d.type === widget.type)?.title ?? widget.type;
}
