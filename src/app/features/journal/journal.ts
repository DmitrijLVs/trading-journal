import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JournalStore } from './journal-store';
import { JournalDayCard } from './journal-day-card';
import { AccountsStore } from '../accounts/accounts-store';
import { Segmented } from '../../shared/ui/segmented';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { Button } from '../../shared/ui/button';
import { Soon } from '../../shared/ui/soon';

type DayFilter = 'all' | 'profit' | 'loss';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-journal',
  imports: [RouterLink, JournalDayCard, Segmented, EmptyState, Skeleton, Button, Soon],
  template: `
    <section class="tj-page">
      <div class="toolbar">
        <span class="stat">{{ store.days().length }} торговых дней</span>
        <app-segmented [options]="filterOptions" [(value)]="filterValue" />
      </div>

      <app-soon
        class="soon"
        title="Заметки дня"
        description="Итоги дня, настроение и «торговал ли по плану» появятся, когда их начнёт хранить платформа. Пока здесь результат и сделки каждого дня."
      />

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
      } @else if (accounts.hasLoaded() && !accounts.hasAccounts()) {
        <app-empty-state
          icon="link"
          title="Здесь будут ваши торговые дни"
          description="Подключите Binance read-only ключом — дни соберутся из сделок автоматически."
        >
          <a app-button variant="primary" size="sm" routerLink="/dashboard">Подключить Binance</a>
        </app-empty-state>
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

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $space-3;
      margin-bottom: $space-4;
    }

    .stat {
      color: var(--fg-muted);
      font-size: $text-sm;
    }

    .soon { margin-bottom: $space-4; }

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
  protected readonly accounts = inject(AccountsStore);

  protected readonly filterValue = signal<string>('all');
  protected readonly visibleCount = signal(PAGE_SIZE);

  protected readonly filterOptions = [
    { value: 'all', label: 'Все' },
    { value: 'profit', label: 'Плюсовые' },
    { value: 'loss', label: 'Минусовые' },
  ];

  private readonly filteredDays = computed(() => {
    const filter = this.filterValue() as DayFilter;
    return this.store.days().filter((day) => {
      switch (filter) {
        case 'profit':
          return day.pnl > 1;
        case 'loss':
          return day.pnl < -1;
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
}
