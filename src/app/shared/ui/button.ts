import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Кнопка библиотеки: атрибут-селектор поверх нативных button/a —
 * сохраняет семантику и доступность.
 *
 * <button app-button>…</button>
 * <button app-button variant="primary" size="sm">…</button>
 */
@Component({
  selector: 'button[app-button], a[app-button]',
  template: `<ng-content />`,
  styleUrl: './button.scss',
  host: {
    '[class]': '"btn btn--" + variant() + " btn--" + size()',
    '[class.btn--icon-only]': 'iconOnly()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly variant = input<'primary' | 'subtle' | 'ghost' | 'outline' | 'danger'>('subtle');
  readonly size = input<'xs' | 'sm' | 'md'>('md');
  /** Квадратная кнопка под одну иконку. */
  readonly iconOnly = input(false);
}
