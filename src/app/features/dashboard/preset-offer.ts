import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorkspacesStore } from './workspaces-store';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';

/** Раскладка сохранена до появления готовых листов — предлагаем их один раз. */
@Component({
  selector: 'app-preset-offer',
  imports: [Button, Icon],
  template: `
    <span class="note">новые листы</span>
    <span class="text">
      Готовые наборы виджетов под вопросы трейдера:
      @for (preset of store.missingPresets(); track preset.id; let last = $last) {
        <b>{{ preset.name }}</b>{{ last ? '' : ', ' }}
      }
      — ваши листы останутся как есть.
    </span>
    <button app-button variant="primary" size="sm" (click)="store.addMissingPresets()">Добавить</button>
    <button app-button variant="ghost" size="sm" [iconOnly]="true" aria-label="Не нужно" (click)="store.dismissPresetOffer()">
      <app-icon name="x" style="--icon-size: 14px" />
    </button>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: flex;
      align-items: center;
      gap: $space-3;
      margin: $space-2 $space-3 0;
      padding: $space-2 $space-3 $space-2 $space-4;
      border: 1px dashed var(--accent-muted);
      border-radius: $radius-lg;
      background: var(--accent-subtle);
    }

    .note { @include coach-voice(20px); color: var(--accent-fg); white-space: nowrap; }
    .text { flex: 1; font-size: $text-sm; color: var(--fg-muted); }
    b { color: var(--fg-default); font-weight: 600; }

    @media (max-width: 760px) {
      :host { flex-wrap: wrap; margin: $space-2 $space-2 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresetOffer {
  protected readonly store = inject(WorkspacesStore);
}
