import type { ShareCard } from '../../../shared/share/share-card';
import type { JournalDay } from '../journal-store';
import { PeriodSummary, longDay } from '../../analytics/data/periods';
import { calculatePnl, formatMoney } from '../../trades/data/trade.model';
import { tone } from '../../trades/data/trade-share';

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/**
 * Снимок недели или месяца: итог, сравнение с прошлым периодом, столбики
 * дней и четыре счётчика. Со скрытыми суммами сравнение не показываем —
 * от «+$••• к прошлой» толку нет.
 */
export function periodShareCard(period: PeriodSummary, mask: boolean): ShareCard {
  const week = period.span === 'week';
  const running = period.isCurrent ? (week ? ' · неделя ещё идёт' : ' · месяц ещё идёт') : '';
  return {
    title: period.label,
    subtitle: (week ? 'Итоги недели' : 'Итоги месяца') + running,
    result: { text: formatMoney(period.net, { sign: true, mask }), tone: tone(period.net) },
    resultNote:
      period.deltaNet !== null && !mask
        ? `${formatMoney(period.deltaNet, { sign: true, mask })} к ${week ? 'прошлой неделе' : 'прошлому месяцу'}`
        : undefined,
    facts: [
      { label: 'Сделок', value: String(period.trades) },
      { label: 'Винрейт', value: percent(period.winRate) },
      { label: 'Дней в плюсе', value: `${period.greenDays} из ${period.tradingDays}` },
      { label: 'Комиссии', value: formatMoney(period.fees, { mask }) },
    ],
    visual: {
      kind: 'bars',
      // В месяце подписываем 1-е и каждое пятое число — тридцать подписей не читаются.
      bars: period.bars.map((bar) => ({
        value: bar.value,
        label: week || bar.label === '1' || Number(bar.label) % 5 === 0 ? bar.label : '',
      })),
    },
    stamp: '',
  };
}

/** Снимок дня: итог, кривая накопленного результата по сделкам и счётчики. */
export function dayShareCard(day: JournalDay, mask: boolean): ShareCard {
  const pnls = day.trades.map(calculatePnl);
  const best = pnls.length ? Math.max(...pnls) : 0;
  return {
    title: longDay(day.date),
    subtitle: 'Итоги дня',
    result: { text: formatMoney(day.pnl, { sign: true, mask }), tone: tone(day.pnl) },
    facts: [
      { label: 'Сделок', value: String(day.trades.length) },
      // Как в карточке дня: доля прибыльных от всех сделок дня.
      { label: 'Винрейт', value: day.trades.length ? percent(day.wins / day.trades.length) : '—' },
      { label: 'Лучшая сделка', value: best > 0 ? formatMoney(best, { sign: true, mask }) : '—' },
      { label: 'Комиссии', value: formatMoney(day.fees, { mask }) },
    ],
    visual: day.curve.length > 1 ? { kind: 'curve', points: day.curve } : null,
    stamp: '',
  };
}

/** `week-2026-11-02`, `month-2026-10`. */
export function periodShareFileName(key: string): string {
  return `${key.startsWith('w:') ? 'week' : 'month'}-${key.slice(2)}`;
}
