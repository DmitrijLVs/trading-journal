import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { WidgetBase } from './widget-base';
import { Icon } from '../../../shared/ui/icon';
import { Tooltip } from '../../../shared/ui/tooltip';
import { SketchHachure } from '../../../shared/ui/sketch/sketch-hachure';
import { calculatePnl, formatCompact, formatMoney, notional } from '../../trades/data/trade.model';

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

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Месяц-теплокарта дневного P&L (как в tradermake / edgewonk). */
@Component({
  selector: 'app-widget-pnl-calendar',
  imports: [Icon, Tooltip, SketchHachure],
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
      const key = t.closedAt.slice(0, 10);
      const stat = map.get(key) ?? { pnl: 0, count: 0, volume: 0, fees: 0 };
      stat.pnl += calculatePnl(t);
      stat.count += 1;
      stat.volume += notional(t);
      stat.fees += t.fees + t.funding;
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
        volume: stat?.volume ?? 0,
        fees: stat?.fees ?? 0,
        intensity: stat ? 0.25 + 0.75 * Math.min(1, Math.abs(stat.pnl) / monthMax) : 0,
        isToday: date === todayKey,
        isPast: date < todayKey,
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

  /** Плотность штриховки: чем больше |P&L| относительно месяца, тем чаще штрихи;
   *  прошедший день без сделок — редкие серые штрихи. */
  protected hachureGap(cell: CalendarCell): number {
    if (cell.pnl === null) return 9;
    return Math.round(10 - 5 * cell.intensity);
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

  /** Компактные деньги для нижней строки ячейки: $146K, $132. */
  protected short(value: number): string {
    return `$${formatCompact(value)}`;
  }

  protected money(value: number): string {
    return formatMoney(value, { sign: true });
  }

  protected readonly isCurrentMonth = computed(() => this.monthOffset() === 0);
}
