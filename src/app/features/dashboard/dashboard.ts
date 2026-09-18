import { Dialog } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
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
import { WidgetInstance, WidgetSettings, widgetDefFor } from './data/workspace.model';
import { WidgetShell } from './widget-shell';
import { WidgetHost } from './widget-host';
import { AddWidgetPanel, AddWidgetPanelData } from './add-widget-panel';
import { WidgetSettingsDialog } from './widget-settings-dialog';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Tooltip } from '../../shared/ui/tooltip';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { SketchArrow } from '../../shared/ui/sketch/sketch-arrow';
import { SketchUnderline } from '../../shared/ui/sketch/sketch-underline';

const GRID_MARGIN = 6;

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
    SketchArrow,
    SketchUnderline,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly store = inject(WorkspacesStore);
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly confirm = inject(ConfirmService);

  protected readonly items = signal<DashGridItem[]>([]);
  protected readonly editingWorkspaceId = signal<string | null>(null);
  protected readonly maximizedId = signal<string | null>(null);
  /** Только что добавленный виджет — рамка мигает акцентом. */
  protected readonly highlightId = signal<string | null>(null);
  private highlightTimer = 0;

  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private readonly gridArea = viewChild<ElementRef<HTMLElement>>('gridArea');

  private renderedWorkspaceId = '';
  private suppressLayoutSave = false;

  /**
   * Высота строки сетки в px. Считается от высоты холста так, чтобы стартовые
   * 24 строки заполняли экран, и дальше не меняется: новые виджеты уходят
   * вниз под прокрутку, а не сжимают соседей (режим Fit делал именно это,
   * и контент виджетов резался по высоте).
   */
  private readonly rowHeight = signal(32);
  private gridResize: ResizeObserver | null = null;

  /** Options — сигнал: смена ссылки объявляет gridster о новых опциях. */
  protected readonly gridsterOptions = signal<GridsterConfig>(this.buildOptions(false, 32));

  private buildOptions(locked: boolean, rowHeight: number): GridsterConfig {
    return {
      gridType: GridType.VerticalFixed,
      fixedRowHeight: rowHeight,
      compactType: 'none',
      margin: GRID_MARGIN,
      outerMargin: true,
      displayGrid: DisplayGrid.OnDragAndResize,
      minCols: GRID_COLS,
      maxCols: GRID_COLS,
      minRows: GRID_ROWS,
      maxRows: 400,
      scrollToNewItems: true,
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
    effect(() =>
      this.gridsterOptions.set(this.buildOptions(this.store.layoutLocked(), this.rowHeight())),
    );
    afterNextRender(() => this.observeGridArea());
    inject(DestroyRef).onDestroy(() => {
      this.gridResize?.disconnect();
      window.clearTimeout(this.highlightTimer);
    });
  }

  /** Строка = (высота холста − отступы) / 24, но не меньше 26 px (ниже контент плиток режется). */
  private observeGridArea(): void {
    const el = this.gridArea()?.nativeElement;
    if (!el) return;
    const measure = () => {
      const usable = el.clientHeight - GRID_MARGIN * (GRID_ROWS + 1);
      this.rowHeight.set(Math.max(26, Math.floor(usable / GRID_ROWS)));
    };
    measure();
    this.gridResize = new ResizeObserver(measure);
    this.gridResize.observe(el);
  }

  protected readonly maximizedWidget = () =>
    this.items().find((i) => i.widget.instanceId === this.maximizedId())?.widget ?? null;

  // ── Раскладка ↔ стор ──────────────────────────────────────────────────────

  private applyWorkspace(): void {
    const workspace = this.store.activeWorkspace();

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
    this.items.set(workspace.widgets.map(toGridItem));
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

  /** Панель добавления — выезжает справа, лист остаётся виден. */
  protected openAddPanel(): void {
    const data: AddWidgetPanelData = { onAdded: (id) => this.flashWidget(id) };
    this.dialog.open(AddWidgetPanel, {
      data,
      panelClass: 'tj-drawer-panel',
      backdropClass: 'tj-drawer-backdrop',
      positionStrategy: this.overlay.position().global().right('0').top('0'),
      width: '420px',
      height: '100vh',
    });
  }

  private flashWidget(instanceId: string): void {
    window.clearTimeout(this.highlightTimer);
    this.highlightId.set(instanceId);
    this.highlightTimer = window.setTimeout(() => this.highlightId.set(null), 1800);
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

/** Экземпляр → конфиг gridster; минимальный размер — из реестра, чтобы
 *  виджет нельзя было ужать до нечитаемого. */
function toGridItem(w: WidgetInstance): DashGridItem {
  const def = widgetDefFor(w);
  return {
    x: w.x,
    y: w.y,
    cols: w.cols,
    rows: w.rows,
    minItemCols: def?.minCols,
    minItemRows: def?.minRows,
    widget: w,
  };
}
