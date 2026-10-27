import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { PERIOD_LABELS } from '../../core/state/period-store';
import { LayoutsApi } from '../../core/config/layouts-api';
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
import {
  WORKSPACE_PRESETS,
  WorkspacePreset,
  defaultWorkspaces,
  newWidgetId,
  newWorkspaceId,
  presetWorkspace,
} from './data/default-workspace';

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

  /** Готовые листы, которых у пользователя ещё нет (по имени). */
  readonly missingPresets = computed<readonly WorkspacePreset[]>(() => {
    const names = new Set(this.workspaces().map((ws) => ws.name));
    return WORKSPACE_PRESETS.filter((p) => !names.has(p.name));
  });

  /** Раскладка сохранена до появления наборов — предложить их один раз. */
  readonly showPresetOffer = computed(
    () => !this._state().presetsOffered && this.missingPresets().length > 0,
  );

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

  /** Лист из набора: «Сегодня», «Разбор», «Издержки»… */
  addPreset(presetId: string): void {
    const preset = WORKSPACE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const ws = presetWorkspace(preset);
    this._state.update((s) => ({
      ...s,
      workspaces: [...s.workspaces, ws],
      activeWorkspaceId: ws.id,
      presetsOffered: true,
    }));
  }

  /** Все недостающие наборы разом; открывается первый из добавленных. */
  addMissingPresets(): void {
    const added = this.missingPresets().map(presetWorkspace);
    if (added.length === 0) return;
    this._state.update((s) => ({
      ...s,
      workspaces: [...added, ...s.workspaces],
      activeWorkspaceId: added[0].id,
      presetsOffered: true,
    }));
  }

  dismissPresetOffer(): void {
    this._state.update((s) => ({ ...s, presetsOffered: true }));
  }

  addWorkspace(name?: string): void {
    const ws: Workspace = { id: newWorkspaceId(), name: name ?? this.nextName(), widgets: [] };
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
        const fallback: Workspace = { id: newWorkspaceId(), name: 'Лист 1', widgets: [] };
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
        id: newWorkspaceId(),
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
  // Первый запуск: все готовые листы, открыт первый («Сегодня»).
  const workspaces = defaultWorkspaces();
  return { workspaces, activeWorkspaceId: workspaces[0].id, layoutLocked: false, presetsOffered: true };
}

/** Разрезы «скоро» (стратегия, ошибки, сетап) теперь — автотеги. */
const LEGACY_TAG_GROUPS = new Set(['strategy', 'mistake', 'setup']);

/** Чинит старые настройки: убранные периоды, разрезы и метрики. */
function migrateSettings(settings: WidgetSettings | undefined): WidgetSettings {
  const next: WidgetSettings = { ...(settings ?? {}) };
  // Пресеты «год» и «всё время» убраны (история — 183 дня): такие виджеты — на общий период.
  if (next.period && next.period !== 'global' && !(next.period in PERIOD_LABELS)) next.period = 'global';
  if (next.groupBy && LEGACY_TAG_GROUPS.has(next.groupBy)) next.groupBy = 'tag';
  if ((next.metric as string | undefined) === 'avgR') next.metric = 'pnl';
  return next;
}

/** Выбрасывает виджеты неизвестных типов и не даёт им быть меньше минимума. */
function sanitize(state: DashboardState): DashboardState {
  const workspaces = (state.workspaces ?? []).map((ws) => ({
    ...ws,
    widgets: (ws.widgets ?? [])
      .filter((w) => isKnownWidgetType(w.type))
      .map((w) => {
        const settings = migrateSettings(w.settings);
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
  return {
    workspaces,
    activeWorkspaceId,
    layoutLocked: Boolean(state.layoutLocked),
    presetsOffered: Boolean(state.presetsOffered),
  };
}

export { GRID_COLS, GRID_ROWS };
