import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  WIDGET_CATEGORY_LABELS,
  WIDGET_REGISTRY,
  WidgetCategory,
  WidgetDef,
} from './data/workspace.model';
import { WorkspacesStore } from './workspaces-store';
import { DialogShell } from '../../shared/ui/dialog-shell';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Segmented } from '../../shared/ui/segmented';
import { ToastService } from '../../shared/ui/toast';

/** Галерея виджетов: карточки по категориям, клик добавляет на активное пространство. */
@Component({
  imports: [DialogShell, Icon, Button, Segmented],
  template: `
    <app-dialog-shell
      title="Галерея виджетов"
      subtitle="Кликните, чтобы добавить на текущее пространство. Размер и место можно поменять потом."
    >
      <app-segmented class="tabs" [options]="tabs" [(value)]="category" />

      <div class="cards">
        @for (def of visible(); track def.id) {
          <button type="button" class="card" (click)="add(def)">
            <span class="glyph"><app-icon [name]="def.icon" style="--icon-size: 18px" /></span>
            <span class="meta">
              <span class="title">{{ def.title }}</span>
              <span class="desc">{{ def.description }}</span>
            </span>
            <span class="plus"><app-icon name="plus" style="--icon-size: 14px" /></span>
          </button>
        }
      </div>

      <ng-container dialog-footer>
        <button app-button variant="primary" (click)="ref.close()">Готово</button>
      </ng-container>
    </app-dialog-shell>
  `,
  styles: `
    @use 'styles/index' as *;

    .tabs { display: block; margin-bottom: $space-4; max-width: 480px; }

    .cards {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: $space-2;
    }

    .card {
      appearance: none;
      display: flex;
      align-items: flex-start;
      gap: $space-3;
      padding: $space-3;
      background: var(--canvas-inset);
      border: 1px solid var(--border-muted);
      border-radius: $radius-lg;
      cursor: pointer;
      text-align: left;
      transition:
        border-color $duration-fast $ease-apple,
        background $duration-fast $ease-apple,
        transform $duration-fast $ease-out;

      &:hover {
        border-color: var(--accent-muted);
        background: var(--canvas-overlay);
        transform: translateY(-1px);

        .plus { opacity: 1; }
      }

      &:active { transform: scale(0.99); }
    }

    .glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex: none;
      border-radius: $radius-md;
      background: var(--accent-subtle);
      color: var(--accent-fg);
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .title {
      font-size: $text-md;
      font-weight: 600;
      color: var(--fg-default);
    }

    .desc {
      font-size: $text-xs;
      color: var(--fg-muted);
      line-height: 1.4;
    }

    .plus {
      margin-left: auto;
      color: var(--accent-fg);
      opacity: 0;
      transition: opacity $duration-fast $ease-apple;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetGallery {
  protected readonly ref = inject(DialogRef);
  private readonly store = inject(WorkspacesStore);
  private readonly toast = inject(ToastService);

  protected readonly category = signal<WidgetCategory>('stats');

  protected readonly tabs = (Object.keys(WIDGET_CATEGORY_LABELS) as WidgetCategory[]).map(
    (key) => ({ value: key, label: WIDGET_CATEGORY_LABELS[key] }),
  );

  protected readonly visible = computed(() =>
    WIDGET_REGISTRY.filter((d) => d.category === this.category()),
  );

  protected add(def: WidgetDef): void {
    this.store.addWidget(def);
    this.toast.success(`«${def.title}» добавлен`);
  }
}
