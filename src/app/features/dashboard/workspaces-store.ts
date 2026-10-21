import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { PERIOD_LABELS } from '../../core/state/period-store';
import { LayoutsApi } from './data/layouts-api';
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

/** Сохранение на сервер — не на каждый пиксель перетаскивания. */
const SAVE_DEBOUNCE_MS = 1500;

/**
 * Рабочие пространства дашборда. Раскладка — в профиле пользователя
 * (`/config/widgets/overview`), localStorage — кэш для мгновенного старта.
 */
@Injectable({ providedIn: 'root' })
export class WorkspacesStore {
  private readonly api = inject(LayoutsApi);
  private readonly auth = inject(AuthStore);
  private readonly _state = signal<DashboardState>(restore());
  /** То, что уже лежит на сервере: загруженное оттуда обратно не отправляем. */
  private synced: string | null = null;
  private loadedFor: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

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
      const json = JSON.stringify(this._state());
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch {
        // приватный режим — не персистим
      }
      untracked(() => this.scheduleSave(json));
    });
    effect(() => {
      const owner = this.auth.user()?.id ?? null;
      if (owner && owner !== this.loadedFor) untracked(() => void this.loadFromServer(owner));
    });
  }

  /** Раскладка из профиля; её ещё нет — отправляем туда текущую (локальную или стартовую). */
  private async loadFromServer(owner: string): Promise<void> {
    this.loadedFor = owner;
    try {
      const raw = await this.api.load('overview');
      const state = raw ? sanitize(raw as DashboardState) : null;
      if (state && state.workspaces.length && state.activeWorkspaceId) {
        this.synced = JSON.stringify(state);
        this._state.set(state);
        return;
      }
      this.synced = null;
      this.scheduleSave(JSON.stringify(this._state()));
    } catch {
      // профиль недоступен — работаем на локальной копии, сохраним при следующем изменении
      this.loadedFor = null;
    }
  }

  private scheduleSave(json: string): void {
    if (!this.loadedFor || json === this.synced) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.api.save('overview', JSON.parse(json)).then(
        () => (this.synced = json),
        () => undefined,
      );
    }, SAVE_DEBOUNCE_MS);
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
        // Пресеты «год» и «всё время» убраны (история — 183 дня): такие виджеты — на общий период.
        const period = w.settings?.period;
        const settings =
          period && period !== 'global' && !(period in PERIOD_LABELS)
            ? { ...w.settings, period: 'global' as const }
            : (w.settings ?? {});
        const def = widgetDefFor({ ...w, settings });
        const sized = def
          ? { cols: Math.max(w.cols, def.minCols), rows: Math.max(w.rows, def.minRows) }
          : {};
        return { ...w, settings, ...sized };
      }),
  }));
  const activeWorkspaceId = workspaces.some((ws) => ws.id === state.activeWorkspaceId)
    ? state.activeWorkspaceId
    : (workspaces[0]?.id ?? '');
  return { workspaces, activeWorkspaceId, layoutLocked: Boolean(state.layoutLocked) };
}

export { GRID_COLS, GRID_ROWS };
