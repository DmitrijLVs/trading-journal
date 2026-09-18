import { WidgetInstance, WidgetSettings, WidgetType } from './workspace.model';

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  widgets: TemplateWidget[];
}

interface TemplateWidget {
  type: WidgetType;
  x: number;
  y: number;
  cols: number;
  rows: number;
  settings?: WidgetSettings;
}

/** Готовые раскладки — быстрый старт вместо пустой сетки. */
export const WORKSPACE_TEMPLATES: readonly WorkspaceTemplate[] = [
  {
    id: 'overview',
    name: 'Обзор',
    description: 'Ключевые метрики, капитал, календарь и структура результата.',
    widgets: [
      { type: 'stat-pnl', x: 0, y: 0, cols: 6, rows: 4 },
      { type: 'stat-winrate', x: 6, y: 0, cols: 6, rows: 4 },
      { type: 'stat-profit-factor', x: 12, y: 0, cols: 6, rows: 4 },
      { type: 'stat-streak', x: 18, y: 0, cols: 6, rows: 4 },
      { type: 'equity-curve', x: 0, y: 4, cols: 14, rows: 10 },
      { type: 'pnl-calendar', x: 14, y: 4, cols: 10, rows: 10 },
      { type: 'daily-pnl', x: 0, y: 14, cols: 10, rows: 10 },
      { type: 'distribution', x: 10, y: 14, cols: 7, rows: 10, settings: { groupBy: 'symbol', metric: 'pnl', limit: 9 } },
      { type: 'long-short', x: 17, y: 14, cols: 7, rows: 10 },
    ],
  },
  {
    id: 'risk',
    name: 'Риск и дисциплина',
    description: 'R-распределение, просадка, ошибки и их цена.',
    widgets: [
      { type: 'stat-profit-factor', x: 0, y: 0, cols: 6, rows: 4 },
      { type: 'stat-streak', x: 6, y: 0, cols: 6, rows: 4 },
      { type: 'drawdown', x: 12, y: 0, cols: 12, rows: 9 },
      { type: 'r-histogram', x: 0, y: 4, cols: 12, rows: 9 },
      { type: 'distribution', x: 12, y: 9, cols: 12, rows: 11, settings: { groupBy: 'mistake', metric: 'pnl', limit: 8 } },
      { type: 'duration-scatter', x: 0, y: 13, cols: 12, rows: 11 },
    ],
  },
  {
    id: 'timing',
    name: 'Тайминг',
    description: 'Когда вы торгуете лучше всего: часы, дни, сессии.',
    widgets: [
      { type: 'heatmap-hours', x: 0, y: 0, cols: 14, rows: 10 },
      { type: 'distribution', x: 14, y: 0, cols: 10, rows: 10, settings: { groupBy: 'session', metric: 'pnl' } },
      { type: 'distribution', x: 0, y: 10, cols: 12, rows: 14, settings: { groupBy: 'weekday', metric: 'pnl' } },
      { type: 'distribution', x: 12, y: 10, cols: 12, rows: 14, settings: { groupBy: 'hour', metric: 'pnl' } },
    ],
  },
  {
    id: 'trades',
    name: 'Сделки',
    description: 'Открытые позиции, свежие сделки, лучшие и худшие.',
    widgets: [
      { type: 'open-positions', x: 0, y: 0, cols: 14, rows: 8 },
      { type: 'best-worst', x: 14, y: 0, cols: 10, rows: 16, settings: { limit: 6 } },
      { type: 'recent-trades', x: 0, y: 8, cols: 14, rows: 16, settings: { limit: 14 } },
    ],
  },
];

let instanceSeq = 0;

/** Материализует шаблонный виджет в экземпляр с уникальным id. */
export function instantiateWidget(template: TemplateWidget): WidgetInstance {
  return {
    instanceId: `w-${Date.now().toString(36)}-${(instanceSeq++).toString(36)}`,
    type: template.type,
    x: template.x,
    y: template.y,
    cols: template.cols,
    rows: template.rows,
    settings: { ...(template.settings ?? {}) },
  };
}
