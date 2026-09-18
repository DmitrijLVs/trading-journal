import { WidgetInstance, widgetDef } from './workspace.model';

interface LayoutSlot {
  /** id карточки реестра (не type: у распределений несколько карточек). */
  id: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export const DEFAULT_WORKSPACE_NAME = 'Обзор';

/**
 * Стартовая раскладка первого листа (сетка 24×24): показатели сверху,
 * календарь крупно справа на всю высоту верхней половины, ниже — дневной
 * результат, разрез по инструментам и свежие сделки.
 */
const DEFAULT_LAYOUT: readonly LayoutSlot[] = [
  { id: 'stat-pnl', x: 0, y: 0, cols: 6, rows: 6 },
  { id: 'summary', x: 6, y: 0, cols: 8, rows: 6 },
  { id: 'pnl-calendar', x: 14, y: 0, cols: 10, rows: 14 },
  { id: 'equity-curve', x: 0, y: 6, cols: 14, rows: 8 },
  { id: 'daily-pnl', x: 0, y: 14, cols: 8, rows: 10 },
  { id: 'dist-symbol', x: 8, y: 14, cols: 8, rows: 10 },
  { id: 'recent-trades', x: 16, y: 14, cols: 8, rows: 10 },
];

let sequence = 0;

export function newWidgetId(): string {
  return `w-${Date.now().toString(36)}-${(sequence++).toString(36)}`;
}

/** Материализует стартовую раскладку в экземпляры с уникальными id. */
export function defaultWidgets(): WidgetInstance[] {
  return DEFAULT_LAYOUT.flatMap((slot) => {
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
        settings: { ...(def.defaultSettings ?? {}) },
      },
    ];
  });
}
