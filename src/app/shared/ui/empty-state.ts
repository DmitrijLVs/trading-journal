import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';
import { IconName } from './icons';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="wrap">
      <div class="glyph">
        <app-icon [name]="icon()" style="--icon-size: 24px" />
      </div>
      <h3>{{ title() }}</h3>
      @if (description()) {
        <p>{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: $space-2;
      padding: $space-8 $space-5;
      text-align: center;
      height: 100%;
    }

    // Иконка в стеклянном круге с бликом — тот же материал, что у панелей.
    .glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: $radius-lg;
      background: var(--canvas-overlay);
      border: 1px solid var(--border-muted);
      box-shadow: var(--inner-highlight);
      color: var(--fg-muted);
      margin-bottom: $space-2;
    }

    h3 {
      margin: 0;
      font-size: $text-lg;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--fg-default);
    }

    p {
      margin: 0;
      max-width: 320px;
      color: var(--fg-muted);
      font-size: $text-sm;
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly description = input('');
}
