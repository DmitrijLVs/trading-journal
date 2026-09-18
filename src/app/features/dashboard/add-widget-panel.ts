import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  WIDGET_CATEGORY_LABELS,
  WIDGET_REGISTRY,
  WidgetCategory,
  WidgetDef,
} from './data/workspace.model';
import { WorkspacesStore } from './workspaces-store';
import { WidgetPreview } from './widget-preview';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { ToastService } from '../../shared/ui/toast';
import { SketchUnderline } from '../../shared/ui/sketch/sketch-underline';

export interface AddWidgetPanelData {
  /** Вызывается после добавления — дашборд подсвечивает новый виджет. */
  onAdded?: (instanceId: string) => void;
}

type Filter = WidgetCategory | 'all';

interface PanelItem {
  def: WidgetDef;
  /** Сколько таких уже на активном листе. */
  count: number;
}

/**
 * Панель добавления виджетов — выезжает справа, лист остаётся виден.
 * Поиск + фильтр по категории, рукописные миниатюры, клик — виджет встаёт
 * на первое свободное место и подсвечивается; панель не закрывается, чтобы
 * добавить несколько подряд.
 */
@Component({
  imports: [Icon, Button, WidgetPreview, SketchUnderline],
  template: `
    <aside class="panel">
      <header class="head">
        <div class="titles">
          <h2 class="title" appSketchUnderline sketchSeed="add-panel" [sketchInset]="0">Добавить виджет</h2>
          <p class="sub">На лист «{{ store.activeWorkspace().name }}»</p>
        </div>
        <button app-button variant="ghost" size="sm" [iconOnly]="true" aria-label="Закрыть" (click)="ref.close()">
          <app-icon name="x" />
        </button>
      </header>

      <label class="search">
        <app-icon name="search" style="--icon-size: 14px" />
        <input
          #q
          type="text"
          placeholder="Найти: календарь, R, сессии…"
          [value]="query()"
          (input)="query.set(q.value)"
          autocomplete="off"
        />
        @if (query()) {
          <button type="button" class="clear" aria-label="Очистить" (click)="query.set('')">
            <app-icon name="x" style="--icon-size: 12px" />
          </button>
        }
      </label>

      <div class="chips" role="tablist">
        @for (chip of chips; track chip.value) {
          <button
            type="button"
            class="chip"
            role="tab"
            [class.active]="chip.value === filter()"
            [attr.aria-selected]="chip.value === filter()"
            (click)="filter.set(chip.value)"
          >
            {{ chip.label }}
            @if (chip.value === filter()) {
              <i class="chip-ink" appSketchUnderline [sketchSeed]="'chip-' + chip.value" [sketchInset]="0"></i>
            }
          </button>
        }
      </div>

      <div class="list">
        @for (item of visible(); track item.def.id) {
          <button type="button" class="item" (click)="add(item.def)">
            <app-widget-preview class="preview" [kind]="item.def.preview" />
            <span class="meta">
              <span class="name">{{ item.def.title }}</span>
              <span class="desc">{{ item.def.description }}</span>
              <span class="hint">
                <span class="size">{{ item.def.cols }}×{{ item.def.rows }}</span>
                @if (item.count > 0) {
                  <span class="count">на листе: {{ item.count }}</span>
                }
              </span>
            </span>
            <span class="plus"><app-icon name="plus" style="--icon-size: 14px" /></span>
          </button>
        } @empty {
          <p class="nothing">Ничего не нашлось. Попробуйте другое слово или снимите фильтр.</p>
        }
      </div>

      <footer class="foot">
        <span class="foot-hint">
          Виджет встаёт на первое свободное место. Потом его можно тянуть за шапку и растягивать за угол.
        </span>
        <button app-button variant="primary" size="sm" (click)="ref.close()">Готово</button>
      </footer>
    </aside>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      height: 100%;
    }

    .panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .head {
      display: flex;
      align-items: flex-start;
      gap: $space-3;
      padding: $space-5 $space-5 $space-3;
    }

    .titles {
      flex: 1;
      min-width: 0;
    }

    .title {
      --sketch-stroke: var(--accent-fg);
      position: relative;
      display: inline-block;
      margin: 0;
      padding-bottom: 5px;
      font-size: $text-xl;
      font-weight: 650;
      line-height: 1.2;
    }

    .sub {
      margin: $space-1 0 0;
      color: var(--fg-muted);
      font-size: $text-sm;
    }

    .search {
      display: flex;
      align-items: center;
      gap: $space-2;
      margin: 0 $space-5;
      height: 34px;
      padding: 0 $space-3;
      background: var(--canvas-inset);
      border: 1px solid var(--border-default);
      border-radius: $radius-md;
      color: var(--fg-subtle);
      transition: border-color $duration-fast $ease-apple;

      &:focus-within {
        border-color: var(--accent-fg);
      }

      input {
        flex: 1;
        min-width: 0;
        background: none;
        border: none;
        outline: none;
        color: var(--fg-default);
        font-size: $text-md;

        &::placeholder { color: var(--fg-subtle); }
      }
    }

    .clear {
      appearance: none;
      display: inline-flex;
      background: none;
      border: none;
      color: var(--fg-subtle);
      cursor: pointer;
      padding: 2px;

      &:hover { color: var(--fg-default); }
    }

    .chips {
      display: flex;
      gap: 2px;
      padding: $space-3 $space-4 $space-2;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .chip {
      --sketch-stroke: var(--accent-fg);
      position: relative;
      appearance: none;
      background: none;
      border: none;
      border-radius: $radius-md;
      padding: 5px $space-2 7px;
      font-size: $text-sm;
      font-weight: 500;
      color: var(--fg-muted);
      cursor: pointer;
      white-space: nowrap;
      transition: color $duration-fast $ease-apple, background $duration-fast $ease-apple;

      &:hover { color: var(--fg-default); background: var(--canvas-overlay); }
      &.active { color: var(--fg-default); }
    }

    .chip-ink {
      position: absolute;
      left: $space-2;
      right: $space-2;
      bottom: 1px;
      height: 5px;
    }

    .list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 0 $space-3 $space-3;
      display: flex;
      flex-direction: column;
      gap: 2px;
      @include styled-scrollbar;
    }

    .item {
      appearance: none;
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr) auto;
      align-items: center;
      gap: $space-3;
      padding: $space-2 $space-2;
      background: none;
      border: none;
      border-radius: $radius-lg;
      text-align: left;
      color: var(--fg-default);
      cursor: pointer;
      transition: background $duration-fast $ease-apple;
      @include focus-ring(var(--accent-fg), -2px);

      &:hover {
        background: var(--canvas-overlay);

        .preview { color: var(--fg-default); }
        .plus { opacity: 1; transform: none; }
      }

      &:active { background: var(--canvas-inset); }
    }

    .preview {
      transition: color $duration-fast $ease-apple;
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .name {
      font-size: $text-md;
      font-weight: 600;
      line-height: 1.25;
    }

    .desc {
      font-size: $text-xs;
      color: var(--fg-muted);
      line-height: 1.4;
    }

    .hint {
      display: flex;
      gap: $space-2;
      font-size: $text-xs;
      color: var(--fg-subtle);
      font-family: $font-mono;
    }

    .count {
      color: var(--accent-fg);
      font-family: $font-sans;
      font-size: $text-xs;
    }

    .plus {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: $radius-full;
      background: var(--accent-subtle);
      color: var(--accent-fg);
      opacity: 0;
      transform: translateX(4px);
      transition: opacity $duration-fast $ease-apple, transform $duration-fast $ease-out;
    }

    .nothing {
      margin: $space-6 $space-3;
      text-align: center;
      color: var(--fg-muted);
    }

    .foot {
      display: flex;
      align-items: center;
      gap: $space-3;
      padding: $space-3 $space-5 $space-4;
      border-top: 1px solid var(--border-muted);
    }

    .foot-hint {
      flex: 1;
      font-size: $text-xs;
      color: var(--fg-subtle);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddWidgetPanel {
  protected readonly ref = inject(DialogRef);
  protected readonly store = inject(WorkspacesStore);
  private readonly toast = inject(ToastService);
  private readonly data = inject<AddWidgetPanelData | null>(DIALOG_DATA, { optional: true });

  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');

  protected readonly chips: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'Все' },
    ...(Object.keys(WIDGET_CATEGORY_LABELS) as WidgetCategory[]).map((value) => ({
      value,
      label: WIDGET_CATEGORY_LABELS[value],
    })),
  ];

  protected readonly visible = computed<PanelItem[]>(() => {
    const filter = this.filter();
    const q = this.query().trim().toLowerCase();
    const widgets = this.store.activeWorkspace().widgets;
    return WIDGET_REGISTRY.filter(
      (def) =>
        (filter === 'all' || def.category === filter) &&
        (!q || `${def.title} ${def.description}`.toLowerCase().includes(q)),
    ).map((def) => ({
      def,
      count: widgets.filter(
        (w) =>
          w.type === def.type &&
          (w.settings.groupBy ?? null) === (def.defaultSettings?.groupBy ?? null),
      ).length,
    }));
  });

  protected add(def: WidgetDef): void {
    const id = this.store.addWidget(def);
    this.data?.onAdded?.(id);
    this.toast.success(`«${def.title}» на листе`);
  }
}
