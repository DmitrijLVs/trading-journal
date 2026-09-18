import { Injectable, computed, effect, signal } from '@angular/core';
import {
  DashboardState,
  GRID_COLS,
  GRID_ROWS,
  WidgetDef,
  WidgetInstance,
  WidgetSettings,
  Workspace,
  isKnownWidgetType,
  widgetDefFor,
} from './data/workspace.model';
import { DEFAULT_WORKSPACE_NAME, defaultWidgets, newWidgetId } from './data/default-workspace';

// v2: без шаблонов и трёх убранных стат-плиток; старое хранилище не мигрируем.
const STORAGE_KEY = 'tj.dashboard.v2';

/**
 * Рабочие пространства дашборда: раскладка живёт в localStorage
 * (на реальном бэкенде — в профиле пользователя).
 */
@Injectable({ providedIn: 'root' })
export class WorkspacesStore {
  private readonly _state = signal<DashboardState>(restore());

  readonly workspaces = computed(() => this._state().workspaces);
  readonly activeWorkspaceId = computed(() => this._state().activeWorkspaceId);
  readonly layoutLocked = computed(() => this._state().layoutLocked);

  readonly activeWorkspace = computed<Workspace>(() => {
    const state = this._state();
    return (
      state.workspaces.find((ws) => ws.id === state.activeWorkspaceId) ?? state.workspaces[0]
    );
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state()));
      } catch {
        // приватный режим — не персистим
      }
    });
  }

  // ── Рабочие пространства ─────────────────────────────────────────────────

  setActive(id: string): void {
    this._state.update((s) => ({ ...s, activeWorkspaceId: id }));
  }

  addWorkspace(name?: string): void {
    const ws: Workspace = { id: newId('ws'), name: name ?? this.nextName(), widgets: [] };
    this._state.update((s) => ({
      ...s,
      workspaces: [...s.workspaces, ws],
      activeWorkspaceId: ws.id,
    }));
  }

  rename(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this._state.update((s) => ({
      ...s,
      workspaces: s.workspaces.map((ws) => (ws.id === id ? { ...ws, name: trimmed } : ws)),
    }));
  }

  remove(id: string): void {
    this._state.update((s) => {
      const workspaces = s.workspaces.filter((ws) => ws.id !== id);
      if (workspaces.length === 0) {
        const fallback: Workspace = { id: newId('ws'), name: 'Лист 1', widgets: [] };
        return { ...s, workspaces: [fallback], activeWorkspaceId: fallback.id };
      }
      return {
        ...s,
        workspaces,
        activeWorkspaceId:
          s.activeWorkspaceId === id ? workspaces[0].id : s.activeWorkspaceId,
      };
    });
  }

  duplicate(id: string): void {
    this._state.update((s) => {
      const source = s.workspaces.find((ws) => ws.id === id);
      if (!source) return s;
      const copy: Workspace = {
        id: newId('ws'),
        name: `${source.name} (копия)`,
        widgets: source.widgets.map((w) => ({ ...w, instanceId: newWidgetId(), settings: { ...w.settings } })),
      };
      return { ...s, workspaces: [...s.workspaces, copy], activeWorkspaceId: copy.id };
    });
  }

  clearActive(): void {
    this.updateActive((ws) => ({ ...ws, widgets: [] }));
  }

  setLayoutLocked(locked: boolean): void {
    this._state.update((s) => ({ ...s, layoutLocked: locked }));
  }

  // ── Виджеты ──────────────────────────────────────────────────────────────

  /** Добавляет виджет на первое свободное место; возвращает id экземпляра. */
  addWidget(def: WidgetDef): string {
    const instanceId = newWidgetId();
    this.updateActive((ws) => {
      const spot = findSpot(ws.widgets, def.cols, def.rows);
      const widget: WidgetInstance = {
        instanceId,
        type: def.type,
        x: spot.x,
        y: spot.y,
        cols: def.cols,
        rows: def.rows,
        settings: { ...(def.defaultSettings ?? {}) },
      };
      return { ...ws, widgets: [...ws.widgets, widget] };
    });
    return instanceId;
  }

  removeWidget(instanceId: string): void {
    this.updateActive((ws) => ({
      ...ws,
      widgets: ws.widgets.filter((w) => w.instanceId !== instanceId),
    }));
  }

  duplicateWidget(instanceId: string): void {
    this.updateActive((ws) => {
      const source = ws.widgets.find((w) => w.instanceId === instanceId);
      if (!source) return ws;
      const spot = findSpot(ws.widgets, source.cols, source.rows);
      const copy: WidgetInstance = {
        ...source,
        instanceId: newWidgetId(),
        x: spot.x,
        y: spot.y,
        settings: { ...source.settings },
      };
      return { ...ws, widgets: [...ws.widgets, copy] };
    });
  }

  updateWidgetSettings(instanceId: string, settings: WidgetSettings): void {
    this.updateActive((ws) => ({
      ...ws,
      widgets: ws.widgets.map((w) =>
        w.instanceId === instanceId ? { ...w, settings: { ...settings } } : w,
      ),
    }));
  }

  /** Позиции после drag/resize из gridster. */
  updateLayout(positions: readonly { instanceId: string; x: number; y: number; cols: number; rows: number }[]): void {
    this.updateActive((ws) => ({
      ...ws,
      widgets: ws.widgets.map((w) => {
        const p = positions.find((pos) => pos.instanceId === w.instanceId);
        return p ? { ...w, x: p.x, y: p.y, cols: p.cols, rows: p.rows } : w;
      }),
    }));
  }

  private updateActive(fn: (ws: Workspace) => Workspace): void {
    this._state.update((s) => ({
      ...s,
      workspaces: s.workspaces.map((ws) => (ws.id === s.activeWorkspaceId ? fn(ws) : ws)),
    }));
  }

  private nextName(): string {
    const names = new Set(this.workspaces().map((ws) => ws.name));
    for (let i = 1; ; i++) {
      const candidate = `Лист ${i}`;
      if (!names.has(candidate)) return candidate;
    }
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Первое свободное окно сетки под размер cols×rows (скан сверху вниз). */
function findSpot(widgets: readonly WidgetInstance[], cols: number, rows: number): { x: number; y: number } {
  const maxY = widgets.reduce((m, w) => Math.max(m, w.y + w.rows), 0);
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= GRID_COLS - cols; x++) {
      const collides = widgets.some(
        (w) => x < w.x + w.cols && x + cols > w.x && y < w.y + w.rows && y + rows > w.y,
      );
      if (!collides) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

function restore(): DashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = sanitize(JSON.parse(raw) as DashboardState);
      if (state.workspaces.length && state.activeWorkspaceId) return state;
    }
  } catch {
    // повреждённое хранилище — пересоздаём дефолт
  }
  // Первый запуск: один лист со стартовой раскладкой.
  const overview: Workspace = {
    id: newId('ws'),
    name: DEFAULT_WORKSPACE_NAME,
    widgets: defaultWidgets(),
  };
  return { workspaces: [overview], activeWorkspaceId: overview.id, layoutLocked: false };
}

/** Выбрасывает виджеты неизвестных типов и не даёт им быть меньше минимума. */
function sanitize(state: DashboardState): DashboardState {
  const workspaces = (state.workspaces ?? []).map((ws) => ({
    ...ws,
    widgets: (ws.widgets ?? [])
      .filter((w) => isKnownWidgetType(w.type))
      .map((w) => {
        const def = widgetDefFor(w);
        return def
          ? { ...w, cols: Math.max(w.cols, def.minCols), rows: Math.max(w.rows, def.minRows) }
          : w;
      }),
  }));
  const activeWorkspaceId = workspaces.some((ws) => ws.id === state.activeWorkspaceId)
    ? state.activeWorkspaceId
    : (workspaces[0]?.id ?? '');
  return { workspaces, activeWorkspaceId, layoutLocked: Boolean(state.layoutLocked) };
}

export { GRID_COLS, GRID_ROWS };
