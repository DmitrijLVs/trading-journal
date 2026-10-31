import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AUTO_TAG_LABELS, AUTO_TAG_SHORT, TagMark } from '../analytics/data/behavior';
import { Tooltip } from '../../shared/ui/tooltip';

/**
 * Теги сделки: автотеги — пометки тренера «от руки» (причина — в подсказке;
 * `detailed` — списком с причинами), затем ручные теги трейдера чистым шрифтом.
 */
@Component({
  selector: 'app-trade-tags',
  imports: [Tooltip],
  template: `
    @if (detailed()) {
      <ul class="detailed">
        @for (mark of marks(); track mark.tag) {
          <li [class]="mark.tag">
            <span class="tj-tag" [class]="'tj-tag ' + mark.tag">{{ labels[mark.tag] }}</span>
            <span class="reason">{{ mark.reason }}</span>
          </li>
        }
      </ul>
    } @else {
      @for (mark of marks(); track mark.tag) {
        <span class="tj-tag" [class]="'tj-tag ' + mark.tag" [appTooltip]="labels[mark.tag] + ': ' + mark.reason">{{ short[mark.tag] }}</span>
      }
      @for (tag of manual(); track tag) {
        <span class="tj-chip">{{ tag }}</span>
      }
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: inline-flex; flex-wrap: wrap; gap: 4px; }
    // В строке таблицы — в одну линию.
    :host(.inline) { flex-wrap: nowrap; }



    .detailed { display: flex; flex-direction: column; gap: $space-2; margin: 0; padding: 0; list-style: none; }
    .detailed li { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .reason { font-size: $text-sm; color: var(--fg-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeTags {
  readonly marks = input.required<readonly TagMark[]>();
  readonly detailed = input(false);
  /** Ручные теги — только в строке (в панели разбора их правит TradeTagEditor). */
  readonly manual = input<readonly string[]>([]);

  protected readonly labels = AUTO_TAG_LABELS;
  protected readonly short = AUTO_TAG_SHORT;
}
