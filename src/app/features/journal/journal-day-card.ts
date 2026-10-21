import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JournalDay } from './journal-store';
import { calculatePnl, calculatePnlPercent, formatDuration } from '../trades/data/trade.model';
import { Icon } from '../../shared/ui/icon';
import { PnlValue } from '../../shared/ui/pnl-value';

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Карточка торгового дня: результат и сделки дня. */
@Component({
  selector: 'app-journal-day-card',
  imports: [RouterLink, Icon, PnlValue],
  templateUrl: './journal-day-card.html',
  styleUrl: './journal-day-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalDayCard {
  readonly day = input.required<JournalDay>();

  protected readonly expanded = signal(false);

  protected readonly title = computed(() => {
    const d = new Date(`${this.day().date}T12:00:00Z`);
    return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });

  protected readonly winRate = computed(() => {
    const day = this.day();
    return day.trades.length === 0 ? 0 : (day.wins / day.trades.length) * 100;
  });

  protected readonly rows = computed(() =>
    this.day().trades.map((trade) => ({
      trade,
      pnl: calculatePnl(trade),
      pct: calculatePnlPercent(trade),
      duration: formatDuration(trade.openedAt, trade.closedAt),
    })),
  );
}
