import { Trade, calculatePnl, isLoss, isWin, localDay } from '../../trades/data/trade.model';
import { AUTO_TAGS, AutoTag, TradeTags, tagsOf } from './behavior';

/**
 * Недели и месяцы — то, что трейдер «закрывает». Неделя — с понедельника по
 * воскресенье, месяц — календарный; дни — в зоне пользователя, сделка
 * относится к дню закрытия.
 */
export type PeriodSpan = 'week' | 'month';

export interface PeriodDay {
  date: string;
  pnl: number;
  count: number;
}

export interface PeriodBar {
  label: string;
  /** null — в этот день не торговали. */
  value: number | null;
}

export interface PeriodTag {
  tag: AutoTag;
  count: number;
  pnl: number;
}

export interface PeriodSummary {
  /** `w:2026-10-19` (понедельник) или `m:2026-10`. */
  key: string;
  span: PeriodSpan;
  /** Первый и последний день периода, YYYY-MM-DD. */
  from: string;
  to: string;
  label: string;
  net: number;
  gross: number;
  fees: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  tradingDays: number;
  greenDays: number;
  redDays: number;
  bestDay: PeriodDay | null;
  worstDay: PeriodDay | null;
  /** Неделя — семь дней, месяц — каждый день месяца. */
  bars: PeriodBar[];
  tags: PeriodTag[];
  /** Период ещё идёт. */
  isCurrent: boolean;
  /** Итог к предыдущему периоду; null — предыдущего в истории нет. */
  deltaNet: number | null;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Полдень дня — без сюрпризов перехода на летнее время. */
const noon = (day: string) => new Date(`${day}T12:00:00`);
const addDays = (day: string, n: number) => {
  const d = noon(day);
  d.setDate(d.getDate() + n);
  return localDay(d.getTime());
};

/** Понедельник недели дня. */
export function weekStart(day: string): string {
  const d = noon(day);
  return addDays(day, -((d.getDay() + 6) % 7));
}

export function periodKey(day: string, span: PeriodSpan): string {
  return span === 'week' ? `w:${weekStart(day)}` : `m:${day.slice(0, 7)}`;
}

/** «20–26 окт», «29 сен – 5 окт», «Октябрь 2026». */
export function periodLabel(key: string): string {
  if (key.startsWith('m:')) {
    const [y, m] = key.slice(2).split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }
  const from = noon(key.slice(2));
  const to = noon(addDays(key.slice(2), 6));
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${MONTHS_GEN[to.getMonth()]}`
    : `${from.getDate()} ${MONTHS_GEN[from.getMonth()]} – ${to.getDate()} ${MONTHS_GEN[to.getMonth()]}`;
}

function bounds(key: string): { from: string; to: string } {
  if (key.startsWith('w:')) return { from: key.slice(2), to: addDays(key.slice(2), 6) };
  const [y, m] = key.slice(2).split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${key.slice(2)}-01`, to: `${key.slice(2)}-${String(last).padStart(2, '0')}` };
}

/** Итоги периодов, где были закрытые сделки (+ текущий), новые первыми. */
export function periodSummaries(
  trades: readonly Trade[],
  tags: TradeTags,
  span: PeriodSpan,
  today: string,
): PeriodSummary[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.status !== 'closed') continue;
    const key = periodKey(localDay(t.closedAt), span);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const currentKey = periodKey(today, span);
  const keys = [...groups.keys()].sort();
  const summaries = keys.map((key) => summarizePeriod(key, span, groups.get(key) ?? [], tags, currentKey));
  for (let i = 1; i < summaries.length; i++) {
    // Сравниваем с предыдущим торговым периодом (пустые недели пропускаются).
    summaries[i].deltaNet = summaries[i].net - summaries[i - 1].net;
  }
  return summaries.reverse();
}

function summarizePeriod(
  key: string,
  span: PeriodSpan,
  list: readonly Trade[],
  tags: TradeTags,
  currentKey: string,
): PeriodSummary {
  const { from, to } = bounds(key);
  const byDay = new Map<string, PeriodDay>();
  let net = 0;
  let wins = 0;
  let losses = 0;
  const tagStats = new Map<AutoTag, PeriodTag>();
  for (const t of list) {
    const pnl = calculatePnl(t);
    const date = localDay(t.closedAt);
    const day = byDay.get(date) ?? { date, pnl: 0, count: 0 };
    day.pnl += pnl;
    day.count++;
    byDay.set(date, day);
    net += pnl;
    if (isWin(pnl)) wins++;
    if (isLoss(pnl)) losses++;
    for (const tag of tagsOf(tags, t)) {
      const stat = tagStats.get(tag) ?? { tag, count: 0, pnl: 0 };
      stat.count++;
      stat.pnl += pnl;
      tagStats.set(tag, stat);
    }
  }
  const days = [...byDay.values()];
  const bars: PeriodBar[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const label = span === 'week' ? WEEKDAYS[bars.length] : String(Number(day.slice(8)));
    bars.push({ label, value: byDay.get(day)?.pnl ?? null });
  }
  const best = days.reduce<PeriodDay | null>((b, d) => (!b || d.pnl > b.pnl ? d : b), null);
  const worst = days.reduce<PeriodDay | null>((w, d) => (!w || d.pnl < w.pnl ? d : w), null);
  return {
    key,
    span,
    from,
    to,
    label: periodLabel(key),
    net,
    gross: list.reduce((s, t) => s + t.realizedPnl, 0),
    fees: list.reduce((s, t) => s + t.fees, 0),
    trades: list.length,
    wins,
    losses,
    winRate: wins + losses ? wins / (wins + losses) : 0,
    tradingDays: days.length,
    greenDays: days.filter((d) => isWin(d.pnl)).length,
    redDays: days.filter((d) => isLoss(d.pnl)).length,
    bestDay: best && isWin(best.pnl) ? best : null,
    worstDay: worst && isLoss(worst.pnl) ? worst : null,
    bars,
    tags: AUTO_TAGS.flatMap((tag) => {
      const stat = tagStats.get(tag);
      return stat ? [stat] : [];
    }),
    isCurrent: key === currentKey,
    deltaNet: null,
  };
}

/** Сколько периодов подряд в плюсе — от последнего завершённого назад. */
export function greenStreak(periods: readonly PeriodSummary[]): number {
  let streak = 0;
  for (const p of periods) {
    if (p.isCurrent) continue;
    if (!isWin(p.net)) break;
    streak++;
  }
  return streak;
}

/** Итог текущей недели или месяца по закрытым сделкам. */
export function currentPeriodNet(trades: readonly Trade[], span: PeriodSpan, today: string): number {
  const key = periodKey(today, span);
  return trades
    .filter((t) => t.status === 'closed' && periodKey(localDay(t.closedAt), span) === key)
    .reduce((s, t) => s + calculatePnl(t), 0);
}

/** «пт, 23 окт» — короткая подпись дня для лучшего/худшего. */
export function shortDay(day: string): string {
  const d = noon(day);
  const weekday = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()];
  return `${weekday}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
