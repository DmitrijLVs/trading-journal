import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { WidgetInstance, defaultWidgetTitle } from './data/workspace.model';
import { PERIOD_LABELS } from '../../core/state/period-store';
import { Icon } from '../../shared/ui/icon';

/**
 * Оболочка виджета: шапка-ручка для перетаскивания, бейдж локального
 * периода, меню действий. Контент — через проекцию.
 */
@Component({
  selector: 'app-widget-shell',
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, Icon],
  host: { '[class.is-new]': 'highlight()' },
  templateUrl: './widget-shell.html',
  styleUrl: './widget-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetShell {
  readonly widget = input.required<WidgetInstance>();
  readonly maximized = input(false);
  readonly locked = input(false);
  /** Только что добавлен — рамка на пару секунд становится акцентной. */
  readonly highlight = input(false);

  readonly configure = output<void>();
  readonly duplicate = output<void>();
  readonly toggleMaximize = output<void>();
  readonly remove = output<void>();

  protected readonly title = computed(() => defaultWidgetTitle(this.widget()));

  protected readonly periodBadge = computed(() => {
    const period = this.widget().settings.period;
    if (!period || period === 'global') return null;
    return PERIOD_LABELS[period];
  });
}
