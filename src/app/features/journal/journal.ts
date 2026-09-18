import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { JournalStore } from './journal-store';
import { JournalDayCard } from './journal-day-card';
import { Segmented } from '../../shared/ui/segmented';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { formatMoney } from '../trades/data/trade.model';

type DayFilter = 'all' | 'profit' | 'loss' | 'noted';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-journal',
  imports: [JournalDayCard, Segmented, EmptyState, Skeleton],
  template: `
    <section class="tj-page narrow">
      <header class="tj-page-head">
        <div>
          <h1>Журнал</h1>
          <p class="tj-page-sub">
            {{ store.days().length }} торговых дней ·
            {{ notedCount() }} с заметками
          </p>
        </div>
        <span class="spacer"></span>
        <app-segmented [options]="filterOptions" [(value)]="filterValue" />
      </header>

      @if (store.isLoading() && store.days().length === 0) {
        <div class="loading">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-skeleton height="86px" />
          }
        </div>
      } @else if (visibleDays().length > 0) {
        <div class="days">
          @for (day of visibleDays(); track day.date) {
            <app-journal-day-card [day]="day" />
          }
        </div>
        @if (hasMore()) {
          <button type="button" class="more" (click)="showMore()">
            Показать ещё {{ remaining() }}
          </button>
        }
      } @else {
        <app-empty-state
          icon="journal"
          title="Дней не найдено"
          description="Измените фильтр или период анализа — записи появятся здесь."
        />
      }
    </section>
  `,
  styles: `
    @use 'styles/index' as *;

    .narrow { max-width: 920px; }

    .days {
      display: flex;
      flex-direction: column;
      gap: $space-3;
    }

    .loading {
      display: flex;
      flex-direction: column;
      gap: $space-3;
    }

    .more {
      appearance: none;
      display: block;
      width: 100%;
      margin-top: $space-3;
      padding: $space-2;
      background: none;
      border: 1px dashed var(--border-default);
      border-radius: $radius-md;
      color: var(--fg-muted);
      font-size: $text-sm;
      cursor: pointer;
      transition: all $duration-fast $ease-apple;

      &:hover {
        color: var(--fg-default);
        border-color: var(--border-strong);
        background: var(--canvas-overlay);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Journal {
  protected readonly store = inject(JournalStore);

  protected readonly filterValue = signal<string>('all');
  protected readonly visibleCount = signal(PAGE_SIZE);

  protected readonly filterOptions = [
    { value: 'all', label: 'Все' },
    { value: 'profit', label: 'Плюсовые' },
    { value: 'loss', label: 'Минусовые' },
    { value: 'noted', label: 'С заметкой' },
  ];

  protected readonly notedCount = computed(
    () => this.store.days().filter((d) => d.entry?.note).length,
  );

  private readonly filteredDays = computed(() => {
    const filter = this.filterValue() as DayFilter;
    return this.store.days().filter((day) => {
      switch (filter) {
        case 'profit':
          return day.pnl > 1;
        case 'loss':
          return day.pnl < -1;
        case 'noted':
          return Boolean(day.entry?.note);
        default:
          return true;
      }
    });
  });

  protected readonly visibleDays = computed(() => this.filteredDays().slice(0, this.visibleCount()));
  protected readonly hasMore = computed(() => this.filteredDays().length > this.visibleCount());
  protected readonly remaining = computed(() => this.filteredDays().length - this.visibleCount());

  protected showMore(): void {
    this.visibleCount.update((v) => v + PAGE_SIZE);
  }

  protected readonly fmtMoney = formatMoney;
}
