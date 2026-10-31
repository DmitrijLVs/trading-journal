import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JournalDay } from './journal-store';
import { calculatePnl, calculatePnlPercent, formatDuration, formatMoney } from '../trades/data/trade.model';
import { AUTO_TAG_SHORT } from '../analytics/data/behavior';
import { Icon } from '../../shared/ui/icon';
import { PnlValue } from '../../shared/ui/pnl-value';
import { SparkLine } from '../../shared/ui/spark-line';
import { AiReviewPanel } from '../analytics/ai-review-panel';
import { AiReviewStore } from '../analytics/ai-review-store';

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Карточка торгового дня: результат и сделки дня. */
@Component({
  selector: 'app-journal-day-card',
  imports: [RouterLink, Icon, PnlValue, SparkLine, AiReviewPanel],
  templateUrl: './journal-day-card.html',
  styleUrl: './journal-day-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalDayCard {
  private readonly ai = inject(AiReviewStore);

  readonly day = input.required<JournalDay>();

  protected readonly aiKey = computed(() => this.ai.dayKey(this.day().date, this.day().trades));

  protected readonly expanded = signal(false);

  protected readonly title = computed(() => {
    const d = new Date(`${this.day().date}T12:00:00`);
    const year = d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${year}`;
  });

  protected readonly winRate = computed(() => {
    const day = this.day();
    return day.trades.length === 0 ? 0 : (day.wins / day.trades.length) * 100;
  });

  protected readonly tagLabels = AUTO_TAG_SHORT;

  /** Сделки дня, автотеги и правила — тренеру-ИИ. */
  protected reviewWithAi(): void {
    this.ai.reviewDay(this.day().date, this.day().trades);
  }

  protected readonly fees = computed(() => formatMoney(this.day().fees));

  protected readonly rows = computed(() =>
    this.day().trades.map((trade) => ({
      trade,
      pnl: calculatePnl(trade),
      pct: calculatePnlPercent(trade),
      duration: formatDuration(trade.openedAt, trade.closedAt),
      time: formatTime(trade.closedAt),
    })),
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
