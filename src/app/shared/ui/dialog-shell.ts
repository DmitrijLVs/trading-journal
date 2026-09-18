import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Icon } from './icon';
import { Button } from './button';

/**
 * Каркас диалога: шапка с заголовком и крестиком, контент и футер
 * через проекцию. Используется внутри компонент, открываемых через CDK Dialog.
 */
@Component({
  selector: 'app-dialog-shell',
  imports: [Icon, Button],
  template: `
    <header class="head">
      <div class="titles">
        <h2>{{ title() }}</h2>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <button app-button variant="ghost" size="sm" [iconOnly]="true" aria-label="Закрыть" (click)="dialogRef.close()">
        <app-icon name="x" />
      </button>
    </header>
    <div class="body">
      <ng-content />
    </div>
    <footer class="foot">
      <ng-content select="[dialog-footer]" />
    </footer>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: flex;
      flex-direction: column;
      max-height: min(84vh, 720px);
    }

    .head {
      display: flex;
      align-items: flex-start;
      gap: $space-3;
      padding: $space-4 $space-5;
      border-bottom: 1px solid var(--border-muted);
    }

    .titles {
      flex: 1;
      min-width: 0;

      h2 {
        margin: 0;
        font-size: $text-xl;
        font-weight: 650;
        line-height: 1.2;
      }

      p {
        margin: $space-1 0 0;
        color: var(--fg-muted);
        font-size: $text-sm;
      }
    }

    .body {
      flex: 1;
      overflow-y: auto;
      padding: $space-5;
      @include styled-scrollbar;
    }

    .foot {
      display: flex;
      justify-content: flex-end;
      gap: $space-2;
      padding: $space-3 $space-5;
      border-top: 1px solid var(--border-muted);

      &:empty {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogShell {
  protected readonly dialogRef = inject(DialogRef);

  readonly title = input.required<string>();
  readonly subtitle = input('');
}
