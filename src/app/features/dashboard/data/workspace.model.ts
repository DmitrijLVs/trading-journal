import { PeriodPreset } from '../../../core/state/period-store';
import { PeriodSpan } from '../../analytics/data/periods';
import { IconName } from '../../../shared/ui/icons';

/** Типы виджетов — по одному компоненту на тип. */
export type WidgetType =
  | 'day-hero'
  | 'day-timeline'
  | 'alerts'
  | 'insights'
  | 'period-results'
  | 'fee-lab'
  | 'fee-waterfall'
  | 'stat-pnl'
  | 'summary'
  | 'equity-curve'
  | 'cumulative-profit'
  | 'daily-pnl'
  | 'drawdown'
  | 'pnl-calendar'
  | 'distribution'
  | 'long-short'
  | 'heatmap-hours'
  | 'duration-scatter'
  | 'recent-trades'
  | 'open-positions'
  | 'best-worst';

/** Разрезы распределения. `tag` — автотеги разбора (реванш, тильт…). */
export type GroupKey =
  | 'symbol'
  | 'tag'
  | 'session'
  | 'weekday'
  | 'hour'
  | 'hold'
  | 'dayLoad'
  | 'streak'
  | 'orderType';

/** `avg` — средний итог сделки в группе, `fees` — сумма комиссий. */
export type DistributionMetric = 'pnl' | 'avg' | 'count' | 'winrate' | 'fees';

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
  /** Аккумулятивный профит: в процентах от депозита или в деньгах. */
  valueMode?: 'percent' | 'money';
  /** Итоги: по неделям или по месяцам. */
  span?: PeriodSpan;
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
  /** Готовые листы уже предлагали (добавили или отказались) — плашку не показываем. */
  presetsOffered?: boolean;
}

export const GRID_COLS = 24;
export const GRID_ROWS = 24;

export type WidgetCategory = 'today' | 'review' | 'costs' | 'stats' | 'charts' | 'time' | 'tables';

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  today: 'Сегодня',
  review: 'Разбор',
  costs: 'Издержки',
  stats: 'Показатели',
  charts: 'Графики',
  time: 'Время',
  tables: 'Таблицы',
};

/**
 * Ранг виджета задаёт его оболочку: `hero` — главная полоса листа без шапки,
 * `insight` — голос тренера (рукописный заголовок), `tool` — тихий инструмент.
 */
export type WidgetRank = 'hero' | 'insight' | 'tool';

/** Вид рукописной миниатюры в панели добавления (см. WidgetPreview). */
export type PreviewKind =
  | 'hero'
  | 'tile'
  | 'summary'
  | 'line'
  | 'area'
  | 'bars'
  | 'drawdown'
  | 'hbars'
  | 'ring'
  | 'scatter'
  | 'calendar'
  | 'heatmap'
  | 'table'
  | 'timeline'
  | 'notes';

/** Карточка панели добавления: тип + дефолтные настройки и размер. */
export interface WidgetDef {
  /** Уникален в панели; несколько карточек могут давать один type. */
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  icon: IconName;
  preview: PreviewKind;
  category: WidgetCategory;
  rank?: WidgetRank;
  cols: number;
  rows: number;
  minCols: number;
  minRows: number;
  defaultSettings?: WidgetSettings;
}

export const WIDGET_REGISTRY: readonly WidgetDef[] = [
  // ── Сегодня ──
  {
    id: 'day-hero',
    type: 'day-hero',
    title: 'Итог дня',
    description: 'Сегодняшний результат, лимит убытка, серия и открытые позиции — крупно, на всю ширину.',
    icon: 'zap',
    preview: 'hero',
    category: 'today',
    rank: 'hero',
    cols: 24,
    rows: 4,
    minCols: 12,
    minRows: 4,
  },
  {
    id: 'day-timeline',
    type: 'day-timeline',
    title: 'Лента дня',
    description: 'Накопленный итог и каждая сделка на оси времени — видно, где день пошёл не так.',
    icon: 'clock',
    preview: 'timeline',
    category: 'today',
    cols: 16,
    rows: 11,
    minCols: 8,
    minRows: 6,
  },
  {
    id: 'alerts',
    type: 'alerts',
    title: 'Предупреждения',
    description: 'Реванш, серия убытков, овертрейд и дневной лимит — по вашим правилам, в реальном времени.',
    icon: 'alert',
    preview: 'notes',
    category: 'today',
    rank: 'insight',
    cols: 9,
    rows: 10,
    minCols: 6,
    minRows: 6,
  },
  {
    id: 'open-positions',
    type: 'open-positions',
    title: 'Открытые позиции',
    description: 'Текущие позиции с нереализованным P&L по данным биржи.',
    icon: 'zap',
    preview: 'table',
    category: 'today',
    cols: 8,
    rows: 11,
    minCols: 6,
    minRows: 5,
  },
  // ── Разбор ──
  {
    id: 'insights',
    type: 'insights',
    title: 'Что важно',
    description: 'Что журнал заметил сам: где вы теряете и что работает — с цифрами и ссылкой на сделки.',
    icon: 'brain',
    preview: 'notes',
    category: 'review',
    rank: 'insight',
    cols: 12,
    rows: 16,
    minCols: 7,
    minRows: 8,
  },
  {
    id: 'weeks',
    type: 'period-results',
    title: 'Итоги недель',
    description: 'Результат каждой недели, дни в плюсе и в минусе, какие недели уже закрыты.',
    icon: 'calendar',
    preview: 'table',
    category: 'review',
    cols: 12,
    rows: 12,
    minCols: 6,
    minRows: 6,
    defaultSettings: { span: 'week', limit: 8 },
  },
  {
    id: 'months',
    type: 'period-results',
    title: 'Итоги месяцев',
    description: 'Месяц за месяцем: результат, винрейт и закрытие месяца.',
    icon: 'calendar',
    preview: 'table',
    category: 'review',
    cols: 12,
    rows: 8,
    minCols: 6,
    minRows: 5,
    defaultSettings: { span: 'month', limit: 6 },
  },
  {
    id: 'dist-mistakes',
    type: 'distribution',
    title: 'Цена ошибок',
    description: 'Сколько стоит каждый автотег: реванш, тильт, овертрейд, передержанный убыток.',
    icon: 'alert',
    preview: 'hbars',
    category: 'review',
    cols: 12,
    rows: 8,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'tag', metric: 'pnl' },
  },
  {
    id: 'dist-hold',
    type: 'distribution',
    title: 'По времени удержания',
    description: 'Какая длительность сделок приносит деньги, а какая — забирает.',
    icon: 'clock',
    preview: 'hbars',
    category: 'review',
    cols: 12,
    rows: 8,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'hold', metric: 'pnl' },
  },
  {
    id: 'dist-streak',
    type: 'distribution',
    title: 'После серии убытков',
    description: 'Как меняется винрейт после 1, 2, 3+ убытков подряд — нужна ли пауза.',
    icon: 'fire',
    preview: 'hbars',
    category: 'review',
    cols: 8,
    rows: 10,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'streak', metric: 'winrate' },
  },
  {
    id: 'dist-dayload',
    type: 'distribution',
    title: 'Нагрузка дня',
    description: 'Результат в днях с разным числом сделок — где начинается овертрейд.',
    icon: 'layers',
    preview: 'hbars',
    category: 'review',
    cols: 8,
    rows: 10,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'dayLoad', metric: 'pnl' },
  },
  // ── Издержки ──
  {
    id: 'fee-lab',
    type: 'fee-lab',
    title: 'Комиссии',
    description: 'Сколько ушло бирже, движение до безубытка, маркет против лимиток и сколько можно сэкономить.',
    icon: 'coins',
    preview: 'summary',
    category: 'costs',
    rank: 'hero',
    cols: 24,
    rows: 5,
    minCols: 12,
    minRows: 4,
  },
  {
    id: 'fee-waterfall',
    type: 'fee-waterfall',
    title: 'Из чего итог',
    description: 'Водопад: биржевой результат → комиссии → фандинг → итог.',
    icon: 'chart-bar',
    preview: 'bars',
    category: 'costs',
    cols: 10,
    rows: 10,
    minCols: 6,
    minRows: 6,
  },
  {
    id: 'dist-order',
    type: 'distribution',
    title: 'Маркет или лимит',
    description: 'Результат по типам ордеров входа и выхода.',
    icon: 'scale',
    preview: 'hbars',
    category: 'costs',
    cols: 14,
    rows: 10,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'orderType', metric: 'pnl' },
  },
  {
    id: 'dist-symbol-fees',
    type: 'distribution',
    title: 'Комиссии по монетам',
    description: 'Где больше всего платите бирже.',
    icon: 'coins',
    preview: 'hbars',
    category: 'costs',
    cols: 12,
    rows: 10,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'symbol', metric: 'fees', limit: 10 },
  },
  // ── Показатели ──
  {
    id: 'stat-pnl',
    type: 'stat-pnl',
    title: 'Чистый P&L',
    description: 'Итог за период, результат до комиссий и спарклайн капитала.',
    icon: 'coins',
    preview: 'tile',
    category: 'stats',
    cols: 6,
    rows: 6,
    minCols: 4,
    minRows: 5,
  },
  {
    id: 'summary',
    type: 'summary',
    title: 'Качество',
    description: 'Сделки, винрейт, средний плюс и минус, профит-фактор.',
    icon: 'layers',
    preview: 'summary',
    category: 'stats',
    cols: 8,
    rows: 6,
    minCols: 5,
    minRows: 5,
  },
  // ── Графики, время, таблицы ──
  {
    id: 'equity-curve',
    type: 'equity-curve',
    title: 'Кривая капитала',
    description: 'Накопленный P&L по закрытию сделок, зоны просадки.',
    icon: 'chart-line',
    preview: 'line',
    category: 'charts',
    cols: 14,
    rows: 9,
    minCols: 8,
    minRows: 6,
  },
  {
    id: 'cumulative-profit',
    type: 'cumulative-profit',
    title: 'Аккумулятивный профит',
    description: 'Накопленный результат в процентах от депозита или в деньгах.',
    icon: 'percent',
    preview: 'area',
    category: 'charts',
    cols: 12,
    rows: 9,
    minCols: 8,
    minRows: 6,
    defaultSettings: { valueMode: 'percent' },
  },
  {
    id: 'daily-pnl',
    type: 'daily-pnl',
    title: 'Дневной P&L',
    description: 'Результат по дням: столбцы прибыльных и убыточных дней.',
    icon: 'chart-bar',
    preview: 'bars',
    category: 'charts',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 6,
  },
  {
    id: 'drawdown',
    type: 'drawdown',
    title: 'Просадка',
    description: 'Глубина просадки от пика капитала во времени.',
    icon: 'arrow-down-right',
    preview: 'drawdown',
    category: 'charts',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 6,
  },
  {
    id: 'dist-symbol',
    type: 'distribution',
    title: 'По инструментам',
    description: 'P&L, число сделок или винрейт в разрезе тикеров.',
    icon: 'chart-bar',
    preview: 'hbars',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'symbol', metric: 'pnl', limit: 10 },
  },
  {
    id: 'long-short',
    type: 'long-short',
    title: 'Лонг / Шорт',
    description: 'Результативность направлений: P&L, сделки, винрейт.',
    icon: 'chart-pie',
    preview: 'ring',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 6,
  },
  {
    id: 'duration-scatter',
    type: 'duration-scatter',
    title: 'P&L × длительность',
    description: 'Сколько держите победителей и убыточные позиции.',
    icon: 'chart-scatter',
    preview: 'scatter',
    category: 'charts',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 6,
  },
  {
    id: 'pnl-calendar',
    type: 'pnl-calendar',
    title: 'Календарь P&L',
    description: 'Месяц как теплокарта: результат каждого торгового дня.',
    icon: 'calendar',
    preview: 'calendar',
    category: 'time',
    cols: 10,
    rows: 14,
    minCols: 7,
    minRows: 9,
  },
  {
    id: 'heatmap-hours',
    type: 'heatmap-hours',
    title: 'Часы × дни недели',
    description: 'Когда вы зарабатываете: теплокарта по времени входа.',
    icon: 'grid',
    preview: 'heatmap',
    category: 'time',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 6,
  },
  {
    id: 'dist-session',
    type: 'distribution',
    title: 'По сессиям',
    description: 'Азия, Лондон, Нью-Йорк — где ваш рынок.',
    icon: 'clock',
    preview: 'hbars',
    category: 'time',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'session', metric: 'pnl' },
  },
  {
    id: 'dist-weekday',
    type: 'distribution',
    title: 'По дням недели',
    description: 'Результат в разрезе дней недели.',
    icon: 'calendar',
    preview: 'hbars',
    category: 'time',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 6,
    defaultSettings: { groupBy: 'weekday', metric: 'pnl' },
  },
  {
    id: 'recent-trades',
    type: 'recent-trades',
    title: 'Последние сделки',
    description: 'Свежие сделки с быстрым переходом к разбору.',
    icon: 'table',
    preview: 'table',
    category: 'tables',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 5,
    defaultSettings: { limit: 8 },
  },
  {
    id: 'best-worst',
    type: 'best-worst',
    title: 'Лучшие и худшие',
    description: 'Топ прибыльных и убыточных сделок периода.',
    icon: 'star',
    preview: 'table',
    category: 'tables',
    cols: 8,
    rows: 8,
    minCols: 6,
    minRows: 6,
    defaultSettings: { limit: 5 },
  },
  {
    id: 'dist-hour',
    type: 'distribution',
    title: 'По часам',
    description: 'Результат по часу входа — в вашем часовом поясе.',
    icon: 'clock',
    preview: 'bars',
    category: 'time',
    cols: 12,
    rows: 8,
    minCols: 8,
    minRows: 6,
    defaultSettings: { groupBy: 'hour', metric: 'pnl' },
  },
];

export function widgetDef(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((d) => d.id === id);
}

/** Карточка реестра, максимально совпадающая с экземпляром (тип + разрез + метрика). */
export function widgetDefFor(widget: Pick<WidgetInstance, 'type' | 'settings'>): WidgetDef | undefined {
  const groupBy = widget.settings.groupBy ?? null;
  const metric = widget.settings.metric ?? null;
  const span = widget.settings.span ?? null;
  const sameType = WIDGET_REGISTRY.filter((d) => d.type === widget.type);
  return (
    sameType.find((d) => span !== null && (d.defaultSettings?.span ?? null) === span) ??
    sameType.find(
      (d) => (d.defaultSettings?.groupBy ?? null) === groupBy && (d.defaultSettings?.metric ?? null) === metric,
    ) ??
    sameType.find((d) => (d.defaultSettings?.groupBy ?? null) === groupBy) ??
    sameType[0]
  );
}

export function widgetRank(widget: Pick<WidgetInstance, 'type' | 'settings'>): WidgetRank {
  return widgetDefFor(widget)?.rank ?? 'tool';
}

export function isKnownWidgetType(type: string): type is WidgetType {
  return WIDGET_REGISTRY.some((d) => d.type === type);
}

export function defaultWidgetTitle(widget: WidgetInstance): string {
  return widget.settings.title || widgetDefFor(widget)?.title || widget.type;
}
