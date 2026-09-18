import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { WidgetBase } from './widget-base';
import { Icon } from '../../../shared/ui/icon';
import { Tooltip } from '../../../shared/ui/tooltip';
import { dailyPnl } from '../../analytics/data/metrics';
import { formatCompact, formatMoney } from '../../trades/data/trade.model';

interface CalendarCell {
  day: number;
  date: string;
  pnl: number | null;
  count: number;
  /** Интенсивность подсветки 0..1 относительно лучшего дня месяца. */
  intensity: number;
  isToday: boolean;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Месяц-теплокарта дневного P&L (как в tradermake / edgewonk). */
@Component({
  selector: 'app-widget-pnl-calendar',
  imports: [Icon, Tooltip],
  templateUrl: './pnl-calendar.html',
  styleUrl: './pnl-calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPnlCalendar extends WidgetBase {
  /** Смещение месяца от текущего (0 — текущий). */
  private readonly monthOffset = signal(0);

  protected readonly weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  private readonly monthDate = computed(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + this.monthOffset(), 1));
  });

  protected readonly monthLabel = computed(() => {
    const d = this.monthDate();
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });

  private readonly dayMap = computed(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    for (const day of dailyPnl(this.trades())) {
      map.set(day.date, { pnl: day.pnl, count: day.count });
    }
    return map;
  });

  protected readonly cells = computed<(CalendarCell | null)[]>(() => {
    const first = this.monthDate();
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // понедельник — первый
    const map = this.dayMap();
    const todayKey = new Date().toISOString().slice(0, 10);

    const monthMax = Math.max(
      1,
      ...[...map.entries()]
        .filter(([date]) => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
        .map(([, v]) => Math.abs(v.pnl)),
    );

    const cells: (CalendarCell | null)[] = Array(lead).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const stat = map.get(date);
      cells.push({
        day,
        date,
        pnl: stat?.pnl ?? null,
        count: stat?.count ?? 0,
        intensity: stat ? 0.25 + 0.75 * Math.min(1, Math.abs(stat.pnl) / monthMax) : 0,
        isToday: date === todayKey,
      });
    }
    return cells;
  });

  protected readonly monthTotal = computed(() => {
    const prefix = this.monthDate().toISOString().slice(0, 7);
    let pnl = 0;
    let count = 0;
    for (const [date, v] of this.dayMap()) {
      if (date.startsWith(prefix)) {
        pnl += v.pnl;
        count += v.count;
      }
    }
    return { pnl, count };
  });

  protected shift(delta: number): void {
    this.monthOffset.update((v) => v + delta);
  }

  protected reset(): void {
    this.monthOffset.set(0);
  }

  protected compact(value: number): string {
    return (value > 0 ? '+' : value < 0 ? '−' : '') + formatCompact(Math.abs(value));
  }

  protected tooltipFor(cell: CalendarCell): string {
    if (cell.pnl === null) return '';
    return `${cell.date}: ${formatMoney(cell.pnl, { sign: true })} · ${cell.count} сд.`;
  }

  protected money(value: number): string {
    return formatMoney(value, { sign: true });
  }

  protected readonly isCurrentMonth = computed(() => this.monthOffset() === 0);
}
