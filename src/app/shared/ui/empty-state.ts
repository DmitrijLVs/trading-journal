import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';
import { IconName } from './icons';
import { SketchFrame } from './sketch/sketch-frame';

@Component({
  selector: 'app-empty-state',
  imports: [Icon, SketchFrame],
  template: `
    <div class="wrap">
      <div class="glyph" appSketchFrame [sketchRadius]="26" [sketchRoughness]="1.4">
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

    .glyph {
      --sketch-stroke: var(--border-strong);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      color: var(--fg-subtle);
      margin-bottom: $space-2;
    }

    h3 {
      margin: 0;
      font-family: $font-hand;
      font-size: 18px;
      font-weight: 400;
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
