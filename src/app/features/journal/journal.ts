import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JournalStore } from './journal-store';
import { JournalDayCard } from './journal-day-card';
import { AccountsStore } from '../accounts/accounts-store';
import { Segmented } from '../../shared/ui/segmented';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { Button } from '../../shared/ui/button';
import { isLoss, isWin } from '../trades/data/trade.model';
import { PeriodCard, PeriodClose } from './period-card';
import { ReviewsStore } from './reviews-store';
import { PeriodSummary } from '../analytics/data/periods';
import { plural } from '../analytics/data/behavior';

type DayFilter = 'all' | 'profit' | 'loss';
/** Что листаем: дни, недели или месяцы (query-параметр `view`). */
type JournalView = 'days' | 'weeks' | 'months';

const PAGE_SIZE = 30;

@Component({
  selector: 'app-journal',
  imports: [RouterLink, JournalDayCard, PeriodCard, Segmented, EmptyState, Skeleton, Button],
  template: `
    <section class="tj-page">
      <div class="toolbar">
        <app-segmented class="views" [options]="viewOptions" [value]="mode()" (valueChange)="setView($event)" />
        <span class="stat" [title]="mode() === 'days' ? '' : 'Недели и месяцы — по всей истории счёта, без учёта периода анализа'">{{ stat() }}</span>
        <app-segmented [options]="filterOptions" [(value)]="filterValue" />
      </div>

      @if (mode() !== 'days') {
        @if (visiblePeriods().length > 0) {
          <div class="days">
            @for (period of visiblePeriods(); track period.key) {
              <app-period-card
                [period]="period"
                [review]="reviews.review(period.key)"
                [pending]="period.key === pendingKey()"
                (closePeriod)="closePeriod(period, $event)"
                (reopen)="reviews.reopen(period.key)"
              />
            }
          </div>
        } @else {
          <app-empty-state
            icon="calendar"
            [title]="mode() === 'weeks' ? 'Недель не найдено' : 'Месяцев не найдено'"
            description="Как только появятся закрытые сделки, здесь будут итоги."
          />
        }
      } @else if (store.isLoading() && store.days().length === 0) {
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
      flex: 1;
      color: var(--fg-muted);
      font-size: $text-sm;
    }

    .views { width: 300px; flex: none; }

    @media (max-width: 760px) {
      .toolbar { flex-wrap: wrap; }
      .views { width: 100%; }
      .stat { flex-basis: 100%; order: 3; }
    }

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
  protected readonly reviews = inject(ReviewsStore);
  private readonly router = inject(Router);

  /** Query-параметр `view` (withComponentInputBinding): ссылка ведёт сразу в недели. */
  readonly view = input<string>();

  protected readonly mode = computed<JournalView>(() => {
    const v = this.view();
    return v === 'weeks' || v === 'months' ? v : 'days';
  });

  protected readonly viewOptions = [
    { value: 'days', label: 'Дни' },
    { value: 'weeks', label: 'Недели' },
    { value: 'months', label: 'Месяцы' },
  ];

  private readonly periods = computed<readonly PeriodSummary[]>(() =>
    this.mode() === 'months' ? this.store.months() : this.store.weeks(),
  );

  protected readonly visiblePeriods = computed(() => {
    const filter = this.filterValue() as DayFilter;
    return this.periods().filter((p) =>
      filter === 'profit' ? isWin(p.net) : filter === 'loss' ? isLoss(p.net) : true,
    );
  });

  /** Последний завершённый период без закрытия — его подсвечиваем. */
  protected readonly pendingKey = computed(() => {
    const last = this.periods().find((p) => !p.isCurrent);
    return last && !this.reviews.reviews()[last.key] ? last.key : null;
  });

  protected readonly stat = computed(() => {
    const mode = this.mode();
    if (mode === 'days') return `${this.store.days().length} торговых дней`;
    const list = this.periods();
    const green = list.filter((p) => isWin(p.net)).length;
    const streak = mode === 'weeks' ? this.store.weekStreak() : this.store.monthStreak();
    const unit = mode === 'weeks' ? ['неделя', 'недели', 'недель'] : ['месяц', 'месяца', 'месяцев'];
    const open = list.filter((p) => !p.isCurrent && !this.reviews.reviews()[p.key]).length;
    const parts = [`${list.length} ${plural(list.length, unit[0], unit[1], unit[2])}, в плюсе ${green}`];
    if (streak > 1) parts.push(`${streak} подряд в плюсе`);
    if (open > 0) parts.push(`не закрыто: ${open}`);
    return parts.join(' · ');
  });

  /** Пришли из виджета итогов (#w:2026-10-19) — прокручиваем к этой неделе. */
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);

  constructor() {
    effect(() => {
      const key = this.fragment();
      if (!key || this.visiblePeriods().length === 0) return;
      setTimeout(() => document.getElementById(key)?.scrollIntoView({ block: 'center' }), 60);
    });
  }

  protected setView(view: string): void {
    void this.router.navigate([], {
      queryParams: { view: view === 'days' ? null : view },
      queryParamsHandling: 'merge',
    });
  }

  protected closePeriod(period: PeriodSummary, close: PeriodClose): void {
    this.reviews.close(period.key, close.note, close.grade);
  }

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
          return isWin(day.pnl);
        case 'loss':
          return isLoss(day.pnl);
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
