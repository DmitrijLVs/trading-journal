import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

/** Компактный статус/тег: <span app-badge tone="success">…</span>.
 *  `hand` — рукописный вариант для пользовательских тегов и пометок. */
@Component({
  selector: 'span[app-badge]',
  template: `<ng-content />`,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: inline-flex;
      align-items: center;
      gap: $space-1;
      height: 20px;
      padding: 0 $space-2;
      border-radius: $radius-full;
      font-size: $text-xs;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      border: 1px solid transparent;
    }

    :host(.tone-neutral) {
      background: var(--canvas-overlay);
      border-color: var(--border-muted);
      color: var(--fg-muted);
    }
    :host(.tone-success) { background: var(--success-subtle); color: var(--success-fg); }
    :host(.tone-danger) { background: var(--danger-subtle); color: var(--danger-fg); }
    :host(.tone-accent) { background: var(--accent-subtle); color: var(--accent-fg); }
    :host(.tone-attention) { background: var(--attention-subtle); color: var(--attention-fg); }
    :host(.tone-purple) { background: var(--done-subtle); color: var(--done-fg); }
    :host(.tone-outline) {
      background: transparent;
      border-color: var(--border-default);
      color: var(--fg-muted);
    }
    :host(.hand) {
      font-family: $font-hand;
      font-size: 13px;
      height: 22px;
      border-radius: $radius-md;
    }
  `,
  host: { '[class]': '"tone-" + tone()', '[class.hand]': 'hand()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly tone = input<'neutral' | 'success' | 'danger' | 'accent' | 'attention' | 'purple' | 'outline'>(
    'neutral',
  );
  readonly hand = input(false, { transform: booleanAttribute });
}
