import { WidgetInstance, WidgetSettings, Workspace, widgetDef } from './workspace.model';

interface LayoutSlot {
  /** id карточки реестра (не type: у распределений несколько карточек). */
  id: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  /** Поверх настроек карточки: свой период, заголовок, метрика. */
  settings?: WidgetSettings;
}

/** Готовый лист: каждый отвечает на один вопрос трейдера. */
export interface WorkspacePreset {
  id: string;
  name: string;
  /** Вопрос, на который отвечает лист, — для меню «Лист из набора». */
  question: string;
  layout: readonly LayoutSlot[];
}

/** Сетка 24×24: верхняя половина — главное, ниже — подробности. */
export const WORKSPACE_PRESETS: readonly WorkspacePreset[] = [
  {
    id: 'today',
    name: 'Сегодня',
    question: 'Как идёт сессия?',
    layout: [
      { id: 'day-hero', x: 0, y: 0, cols: 24, rows: 4 },
      { id: 'day-timeline', x: 0, y: 4, cols: 16, rows: 11 },
      { id: 'open-positions', x: 16, y: 4, cols: 8, rows: 11 },
      { id: 'alerts', x: 0, y: 15, cols: 9, rows: 10 },
      {
        id: 'recent-trades',
        x: 9,
        y: 15,
        cols: 15,
        rows: 10,
        settings: { period: 'today', limit: 12, title: 'Сделки дня' },
      },
    ],
  },
  {
    id: 'review',
    name: 'Разбор',
    question: 'Где я теряю?',
    layout: [
      { id: 'insights', x: 0, y: 0, cols: 12, rows: 16 },
      { id: 'dist-mistakes', x: 12, y: 0, cols: 12, rows: 8 },
      { id: 'dist-hold', x: 12, y: 8, cols: 12, rows: 8 },
      { id: 'pnl-calendar', x: 0, y: 16, cols: 12, rows: 14 },
      { id: 'weeks', x: 12, y: 16, cols: 12, rows: 14 },
    ],
  },
  {
    id: 'costs',
    name: 'Издержки',
    question: 'Сколько я отдаю бирже?',
    layout: [
      { id: 'fee-lab', x: 0, y: 0, cols: 24, rows: 5 },
      { id: 'fee-waterfall', x: 0, y: 5, cols: 10, rows: 10 },
      { id: 'dist-order', x: 10, y: 5, cols: 14, rows: 10 },
      { id: 'dist-symbol-fees', x: 0, y: 15, cols: 12, rows: 10 },
      {
        id: 'dist-hold',
        x: 12,
        y: 15,
        cols: 12,
        rows: 10,
        settings: { metric: 'avg', title: 'Средняя сделка по удержанию' },
      },
    ],
  },
  {
    id: 'discipline',
    name: 'Дисциплина',
    question: 'Когда я ломаюсь?',
    layout: [
      { id: 'dist-streak', x: 0, y: 0, cols: 8, rows: 10 },
      { id: 'dist-dayload', x: 8, y: 0, cols: 8, rows: 10 },
      { id: 'dist-mistakes', x: 16, y: 0, cols: 8, rows: 10 },
      { id: 'heatmap-hours', x: 0, y: 10, cols: 14, rows: 10 },
      { id: 'dist-weekday', x: 14, y: 10, cols: 10, rows: 10 },
    ],
  },
  {
    id: 'overview',
    name: 'Обзор',
    question: 'Как в целом?',
    layout: [
      { id: 'stat-pnl', x: 0, y: 0, cols: 6, rows: 6 },
      { id: 'summary', x: 6, y: 0, cols: 8, rows: 6 },
      { id: 'pnl-calendar', x: 14, y: 0, cols: 10, rows: 14 },
      { id: 'equity-curve', x: 0, y: 6, cols: 14, rows: 8 },
      { id: 'daily-pnl', x: 0, y: 14, cols: 8, rows: 10 },
      { id: 'long-short', x: 8, y: 14, cols: 8, rows: 10 },
      { id: 'recent-trades', x: 16, y: 14, cols: 8, rows: 10 },
    ],
  },
];

let sequence = 0;

export function newWidgetId(): string {
  return `w-${Date.now().toString(36)}-${(sequence++).toString(36)}`;
}

export function newWorkspaceId(): string {
  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Материализует раскладку набора в экземпляры с уникальными id. */
export function presetWidgets(preset: WorkspacePreset): WidgetInstance[] {
  return preset.layout.flatMap((slot) => {
    const def = widgetDef(slot.id);
    if (!def) return [];
    return [
      {
        instanceId: newWidgetId(),
        type: def.type,
        x: slot.x,
        y: slot.y,
        cols: slot.cols,
        rows: slot.rows,
        settings: { ...(def.defaultSettings ?? {}), ...(slot.settings ?? {}) },
      },
    ];
  });
}

export function presetWorkspace(preset: WorkspacePreset): Workspace {
  return { id: newWorkspaceId(), name: preset.name, widgets: presetWidgets(preset) };
}

/** Первый запуск: все готовые листы, открыт «Сегодня». */
export function defaultWorkspaces(): Workspace[] {
  return WORKSPACE_PRESETS.map(presetWorkspace);
}
