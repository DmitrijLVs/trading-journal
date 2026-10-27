import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { WidgetBase } from './widget-base';
import { Icon } from '../../../shared/ui/icon';
import { Tooltip } from '../../../shared/ui/tooltip';
import {
  MONEY_MASK,
  calculatePnl,
  formatCompact,
  formatMoney,
  isMoneyHidden,
  localDay,
  notional,
  tradeCosts,
} from '../../trades/data/trade.model';

interface DayStat {
  pnl: number;
  count: number;
  volume: number;
  fees: number;
}

interface CalendarCell {
  day: number;
  date: string;
  pnl: number | null;
  count: number;
  volume: number;
  fees: number;
  /** Интенсивность подсветки 0..1 относительно лучшего дня месяца. */
  intensity: number;
  isToday: boolean;
  /** День уже прошёл (строго до сегодня) — без сделок он «пустой», серый. */
  isPast: boolean;
}

/** Итог недели — правая колонка календаря. */
interface WeekTotal {
  pnl: number;
  count: number;
  /** В неделе были сделки. */
  active: boolean;
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

  /** Закрытые сделки по дню закрытия: P&L, число, оборот, комиссии. */
  private readonly dayMap = computed(() => {
    const map = new Map<string, DayStat>();
    for (const t of this.trades()) {
      if (t.status !== 'closed') continue;
      const key = localDay(t.closedAt);
      const stat = map.get(key) ?? { pnl: 0, count: 0, volume: 0, fees: 0 };
      stat.pnl += calculatePnl(t);
      stat.count += 1;
      stat.volume += notional(t);
      stat.fees += tradeCosts(t);
      map.set(key, stat);
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
    const todayKey = localDay(Date.now());

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
        volume: stat?.volume ?? 0,
        fees: stat?.fees ?? 0,
        intensity: stat ? 0.2 + 0.8 * Math.min(1, Math.abs(stat.pnl) / monthMax) : 0,
        isToday: date === todayKey,
        isPast: date < todayKey,
      });
    }
    // Хвост последней недели — пустые ячейки, чтобы колонка итогов не съезжала.
    while (cells.length % 7) cells.push(null);
    return cells;
  });

  /** Ячейки по неделям + итог каждой недели. */
  protected readonly weeks = computed(() => {
    const cells = this.cells();
    const weeks: { cells: (CalendarCell | null)[]; total: WeekTotal }[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const traded = week.filter((c): c is CalendarCell => c !== null && c.pnl !== null);
      weeks.push({
        cells: week,
        total: {
          pnl: traded.reduce((s, c) => s + (c.pnl ?? 0), 0),
          count: traded.reduce((s, c) => s + c.count, 0),
          active: traded.length > 0,
        },
      });
    }
    return weeks;
  });

  protected readonly monthTotal = computed(() => {
    const d = this.monthDate();
    const prefix = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
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

  /** Без «$» — ячейка узкая; при скрытых суммах — только знак и точки. */
  protected compact(value: number): string {
    const body = formatCompact(Math.abs(value));
    if (body === '0') return '0';
    return (value > 0 ? '+' : '−') + (isMoneyHidden() ? MONEY_MASK : body);
  }

  protected isIdle(cell: CalendarCell): boolean {
    return cell.pnl === null && cell.isPast;
  }

  protected tooltipFor(cell: CalendarCell): string {
    if (cell.pnl === null) return cell.isPast ? `${cell.date}: без сделок` : '';
    return (
      `${cell.date}: ${formatMoney(cell.pnl, { sign: true })} · ${cell.count} сд. · ` +
      `оборот ${formatMoney(cell.volume)} · комиссии ${formatMoney(cell.fees)}`
    );
  }

  protected money(value: number): string {
    return formatMoney(value, { sign: true });
  }

  protected readonly isCurrentMonth = computed(() => this.monthOffset() === 0);
}
