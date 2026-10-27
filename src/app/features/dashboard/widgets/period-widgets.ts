import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetBase } from './widget-base';
import { JournalStore } from '../../journal/journal-store';
import { ReviewsStore } from '../../journal/reviews-store';
import { REVIEW_GRADE_LABELS } from '../../journal/data/review.model';
import { PnlValue } from '../../../shared/ui/pnl-value';
import { EmptyState } from '../../../shared/ui/empty-state';

/**
 * Итоги последних недель или месяцев: результат, мини-столбики дней и статус
 * закрытия. Клик — в журнал, где неделю можно закрыть.
 */
@Component({
  selector: 'app-widget-period-results',
  imports: [RouterLink, PnlValue, EmptyState],
  template: `
    @if (rows().length > 0) {
      <div class="list">
        @for (row of rows(); track row.period.key) {
          <a class="row" routerLink="/diary" [queryParams]="{ view: view() }" [fragment]="row.period.key">
            <span class="label">
              {{ row.period.label }}
              <span class="status" [class]="'status ' + row.status">{{ row.statusText }}</span>
            </span>
            <span class="bars" aria-hidden="true">
              @for (bar of row.bars; track $index) {
                <i [class.pos]="(bar ?? 0) > 0" [class.neg]="(bar ?? 0) < 0" [class.none]="bar === null"
                   [style.height.%]="bar === null ? 0 : row.scale(bar)"></i>
              }
            </span>
            <span class="wr">{{ row.winRate }}</span>
            <app-pnl class="net" [value]="row.period.net" />
          </a>
        }
      </div>
    } @else {
      <app-empty-state icon="calendar" title="Итогов пока нет" />
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; overflow-y: auto; container-type: inline-size; @include styled-scrollbar; }
    .list { display: flex; flex-direction: column; padding: 0 $space-2 $space-2; }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto 44px 92px;
      align-items: center;
      gap: $space-3;
      padding: 7px $space-2;
      border-radius: $radius-md;
      color: var(--fg-default);
      text-decoration: none;
      transition: background $duration-instant $ease-apple;
      &:hover { background: var(--canvas-overlay); }
    }
    .label { display: flex; flex-direction: column; font-size: $text-sm; font-weight: 600; min-width: 0; }
    .status { font-size: $text-xs; font-weight: 400; color: var(--fg-subtle); }
    .status.closed { color: var(--success-fg); }
    .status.pending { @include coach-voice(14px); color: var(--accent-fg); }
    .status.current { color: var(--accent-fg); }
    .bars { display: flex; align-items: center; gap: 2px; height: 28px; }
    .bars i { display: block; width: 6px; min-height: 2px; max-height: 50%; border-radius: 1px; background: var(--fg-subtle); }
    .bars i.pos { background: var(--success-fg); transform: translateY(-50%); }
    .bars i.neg { background: var(--danger-fg); transform: translateY(50%); }
    .bars i.none { height: 3px !important; width: 3px; border-radius: 50%; background: var(--border-default); }
    .wr { font-family: $font-mono; font-size: $text-xs; color: var(--fg-muted); text-align: right; }
    .net { text-align: right; font-weight: 600; }

    @container (max-width: 380px) {
      .row { grid-template-columns: minmax(0, 1fr) 92px; }
      .bars, .wr { display: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPeriodResults extends WidgetBase {
  private readonly journal = inject(JournalStore);
  private readonly reviews = inject(ReviewsStore);

  protected readonly view = computed(() => (this.settings().span === 'month' ? 'months' : 'weeks'));

  protected readonly rows = computed(() => {
    const month = this.settings().span === 'month';
    const periods = (month ? this.journal.months() : this.journal.weeks()).slice(0, this.settings().limit ?? 8);
    const reviews = this.reviews.reviews();
    return periods.map((period) => {
      const review = reviews[period.key] as (typeof reviews)[string] | undefined;
      const max = Math.max(1e-9, ...period.bars.map((b) => Math.abs(b.value ?? 0)));
      const [status, statusText] = period.isCurrent
        ? ['current', 'идёт']
        : review
          ? ['closed', `✓ закрыт${month ? '' : 'а'}${review.grade ? ' · ' + REVIEW_GRADE_LABELS[review.grade] : ''}`]
          : ['pending', 'закрыть →'];
      return {
        period,
        status,
        statusText,
        winRate: `${Math.round(period.winRate * 100)}%`,
        bars: period.bars.map((b) => b.value),
        scale: (v: number) => Math.max(6, (Math.abs(v) / max) * 50),
      };
    });
  });
}
