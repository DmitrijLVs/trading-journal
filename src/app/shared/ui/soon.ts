import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Возможность, которой ещё нет в API платформы: честная заглушка вместо
 * моковых данных — что будет и что пометка «скоро».
 */
@Component({
  selector: 'app-soon',
  template: `
    <div class="head">
      <span class="title">{{ title() }}</span>
      <span class="pill">скоро</span>
    </div>
    @if (description()) {
      <p>{{ description() }}</p>
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      padding: $space-3 $space-4;
      border: 1px dashed var(--border-default);
      border-radius: $radius-lg;
      color: var(--fg-muted);
    }

    .head {
      display: flex;
      align-items: center;
      gap: $space-2;
    }

    .title {
      font-size: $text-sm;
      font-weight: 600;
      color: var(--fg-default);
    }

    .pill {
      padding: 1px $space-2;
      border-radius: $radius-full;
      background: var(--accent-subtle);
      color: var(--accent-fg);
      font-size: $text-xs;
      font-weight: 600;
    }

    p {
      margin: $space-1 0 0;
      font-size: $text-xs;
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Soon {
  readonly title = input.required<string>();
  readonly description = input('');
}
