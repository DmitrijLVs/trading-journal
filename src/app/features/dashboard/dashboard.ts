import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  DisplayGrid,
  GridType,
  Gridster,
  GridsterConfig,
  GridsterItem,
  GridsterItemConfig,
} from 'angular-gridster2';
import { firstValueFrom } from 'rxjs';
import { GRID_COLS, GRID_ROWS, WorkspacesStore } from './workspaces-store';
import { WidgetInstance, WidgetSettings } from './data/workspace.model';
import { WORKSPACE_TEMPLATES, WorkspaceTemplate } from './data/workspace-templates';
import { WidgetShell } from './widget-shell';
import { WidgetHost } from './widget-host';
import { WidgetGallery } from './widget-gallery';
import { WidgetSettingsDialog } from './widget-settings-dialog';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Tooltip } from '../../shared/ui/tooltip';
import { ConfirmService } from '../../shared/ui/confirm-dialog';

/** Gridster мутирует x/y/cols/rows прямо на элементах — работаем с локальными
 *  копиями, позиции возвращаются в стор через itemChangeCallback. */
interface DashGridItem extends GridsterItemConfig {
  widget: WidgetInstance;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    Gridster,
    GridsterItem,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    WidgetShell,
    WidgetHost,
    Icon,
    Button,
    Tooltip,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly store = inject(WorkspacesStore);
  private readonly dialog = inject(Dialog);
  private readonly confirm = inject(ConfirmService);

  protected readonly templates = WORKSPACE_TEMPLATES;

  protected readonly items = signal<DashGridItem[]>([]);
  protected readonly editingWorkspaceId = signal<string | null>(null);
  protected readonly maximizedId = signal<string | null>(null);

  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  private renderedWorkspaceId = '';
  private suppressLayoutSave = false;

  /** Options — сигнал: смена ссылки объявляет gridster о новых опциях. */
  protected readonly gridsterOptions = signal<GridsterConfig>(this.buildOptions(false));

  private buildOptions(locked: boolean): GridsterConfig {
    return {
      gridType: GridType.Fit,
      compactType: 'none',
      margin: 6,
      outerMargin: true,
      displayGrid: DisplayGrid.OnDragAndResize,
      minCols: GRID_COLS,
      maxCols: GRID_COLS,
      minRows: GRID_ROWS,
      maxRows: GRID_ROWS * 2,
      pushItems: true,
      disablePushOnDrag: true,
      disablePushOnResize: false,
      swap: false,
      draggable: {
        enabled: !locked,
        dragHandleClass: 'widget-drag-handle',
        ignoreContent: true,
      },
      resizable: { enabled: !locked },
      itemChangeCallback: (item) => this.persistItem(item as DashGridItem),
      itemResizeCallback: (item) => this.persistItem(item as DashGridItem),
    };
  }

  constructor() {
    effect(() => this.applyWorkspace());
  }

  protected readonly maximizedWidget = () =>
    this.items().find((i) => i.widget.instanceId === this.maximizedId())?.widget ?? null;

  // ── Раскладка ↔ стор ──────────────────────────────────────────────────────

  private applyWorkspace(): void {
    const workspace = this.store.activeWorkspace();
    const locked = this.store.layoutLocked();

    const draggableEnabled = this.gridsterOptions().draggable?.enabled ?? true;
    if (draggableEnabled === locked) {
      this.gridsterOptions.set(this.buildOptions(locked));
    }

    const items = this.items();
    const sameSet =
      workspace.id === this.renderedWorkspaceId &&
      workspace.widgets.length === items.length &&
      workspace.widgets.every((w, i) => items[i].widget.instanceId === w.instanceId);

    if (sameSet) {
      // Обновляем только payload (настройки/заголовок) — позиции у gridster.
      const payloadChanged = workspace.widgets.some((w, i) => items[i].widget !== w);
      if (payloadChanged) {
        this.items.set(items.map((item, i) => ({ ...item, widget: workspace.widgets[i] })));
      }
      return;
    }

    this.renderedWorkspaceId = workspace.id;
    this.maximizedId.set(null);
    this.suppressLayoutSave = true;
    this.items.set(
      workspace.widgets.map((w) => ({ x: w.x, y: w.y, cols: w.cols, rows: w.rows, widget: w })),
    );
    this.suppressLayoutSave = false;
  }

  /** Позиция одного виджета после drag/resize (gridster отдаёт конфиг). */
  private persistItem(item: DashGridItem): void {
    if (this.suppressLayoutSave || !item.widget) return;
    this.store.updateLayout([
      { instanceId: item.widget.instanceId, x: item.x, y: item.y, cols: item.cols, rows: item.rows },
    ]);
  }

  // ── Рабочие пространства ──────────────────────────────────────────────────

  protected selectWorkspace(id: string): void {
    if (this.editingWorkspaceId() && this.editingWorkspaceId() !== id) {
      this.editingWorkspaceId.set(null);
    }
    this.store.setActive(id);
  }

  protected startRename(id: string): void {
    this.editingWorkspaceId.set(id);
    setTimeout(() => {
      const input = this.renameInput()?.nativeElement;
      input?.focus();
      input?.select();
    });
  }

  protected commitRename(id: string, name: string): void {
    if (this.editingWorkspaceId() !== id) return;
    this.editingWorkspaceId.set(null);
    this.store.rename(id, name);
  }

  protected async removeWorkspace(id: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    const ws = this.store.workspaces().find((w) => w.id === id);
    if (ws && ws.widgets.length > 0) {
      const ok = await this.confirm.ask({
        title: 'Закрыть пространство?',
        message: `«${ws.name}» и его раскладка будут удалены. Действие необратимо.`,
        confirmLabel: 'Закрыть',
        danger: true,
      });
      if (!ok) return;
    }
    this.store.remove(id);
  }

  protected applyTemplate(template: WorkspaceTemplate): void {
    this.store.addFromTemplate(template);
  }

  protected async clearActive(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Очистить пространство?',
      message: 'Все виджеты текущего пространства будут удалены.',
      confirmLabel: 'Очистить',
      danger: true,
    });
    if (ok) this.store.clearActive();
  }

  // ── Виджеты ───────────────────────────────────────────────────────────────

  protected openGallery(): void {
    this.dialog.open(WidgetGallery, {
      panelClass: ['tj-dialog-panel', 'tj-dialog-panel--wide'],
      backdropClass: 'tj-dialog-backdrop',
    });
  }

  protected async configureWidget(widget: WidgetInstance): Promise<void> {
    const ref = this.dialog.open<WidgetSettings | undefined>(WidgetSettingsDialog, {
      data: widget,
      panelClass: 'tj-dialog-panel',
      backdropClass: 'tj-dialog-backdrop',
    });
    const settings = await firstValueFrom(ref.closed);
    if (settings) this.store.updateWidgetSettings(widget.instanceId, settings);
  }

  protected removeWidget(instanceId: string): void {
    if (this.maximizedId() === instanceId) this.maximizedId.set(null);
    this.store.removeWidget(instanceId);
  }

  protected duplicateWidget(instanceId: string): void {
    this.store.duplicateWidget(instanceId);
  }

  protected toggleMaximize(instanceId: string): void {
    this.maximizedId.update((current) => (current === instanceId ? null : instanceId));
    // Площадь под графиком изменилась — echarts пересчитает размер сам
    // (ResizeObserver), но подтолкнём и window-слушателей.
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
  }

  protected toggleLock(): void {
    this.store.setLayoutLocked(!this.store.layoutLocked());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.maximizedId()) {
      this.maximizedId.set(null);
    }
  }

  protected trackItem = (_: number, item: DashGridItem): string => item.widget.instanceId;
}
