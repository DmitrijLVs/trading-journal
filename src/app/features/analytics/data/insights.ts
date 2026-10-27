import {
  Trade,
  TradeSide,
  calculatePnl,
  durationMs,
  formatMoney,
  formatSpan,
  isLoss,
  isWin,
  localDay,
} from '../../trades/data/trade.model';
import { AutoTag, TradeTags, median, plural, tagsOf } from './behavior';
import { costBreakdown } from './costs';
import { DisciplineSettings } from './discipline.model';
import { GroupStat, closedTrades, groupByHold, groupByHour, groupByWeekday, summarize } from './metrics';

/**
 * Инсайты — что журнал говорит сам: фраза с цифрами, доказательство
 * (мини-график) и ссылка на сделки. Правила — чистые функции над сделками
 * периода; срабатывают только на достаточной выборке.
 */
export type InsightTone = 'neg' | 'warn' | 'pos' | 'info';

export interface InsightBar {
  label: string;
  value: number;
}

export interface InsightLink {
  tag?: AutoTag;
  side?: TradeSide;
}

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  text: string;
  /** Сколько денег на кону — для сортировки. */
  impact: number;
  bars?: InsightBar[];
  link?: InsightLink;
}

/** Меньше сделок — выводы случайны, молчим. */
const MIN_TRADES = 30;
const MIN_GROUP = 15;

const WEEKDAY_NAMES: Record<string, string> = {
  Пн: 'Понедельник',
  Вт: 'Вторник',
  Ср: 'Среда',
  Чт: 'Четверг',
  Пт: 'Пятница',
  Сб: 'Суббота',
  Вс: 'Воскресенье',
};

const money = (v: number) => formatMoney(v, { sign: true });
const pct = (v: number) => `${Math.round(v * 100)}%`;
const sumPnl = (trades: readonly Trade[]) => trades.reduce((s, t) => s + calculatePnl(t), 0);
const winRate = (trades: readonly Trade[]) =>
  trades.length ? trades.filter((t) => isWin(calculatePnl(t))).length / trades.length : 0;

export function buildInsights(
  trades: readonly Trade[],
  tags: TradeTags,
  s: DisciplineSettings,
): Insight[] {
  const closed = closedTrades(trades);
  if (closed.length < MIN_TRADES) return [];
  const net = sumPnl(closed);
  const tagged = (tag: AutoTag) => closed.filter((t) => tagsOf(tags, t).includes(tag));

  const rules: (Insight | null)[] = [
    feesRule(closed),
    payoffRule(closed),
    revengeRule(tagged('revenge'), net, s),
    tiltRule(closed, tagged('tilt'), s),
    overtradeRule(closed, s),
    holdRule(closed),
    weekdayRule(closed),
    directionRule(closed),
    hourRule(closed),
  ];
  return rules.filter((i): i is Insight => i !== null).sort((a, b) => b.impact - a.impact);
}

function feesRule(closed: readonly Trade[]): Insight | null {
  const c = costBreakdown(closed);
  if (c.gross <= 0 || c.fees <= 0) return null;
  const market =
    c.marketRoundTripShare !== null && c.marketRoundTripShare > 0.6
      ? ` ${pct(c.marketRoundTripShare)} сделок открыты и закрыты маркетом.`
      : '';
  const bars = [
    { label: 'До комиссий', value: c.gross },
    { label: 'Комиссии', value: -c.fees },
    { label: 'Итог', value: c.net },
  ];
  if (c.net < 0) {
    return {
      id: 'fees',
      tone: 'neg',
      title: 'Комиссии съели весь плюс',
      text: `До комиссий ${money(c.gross)}, комиссии ${formatMoney(c.fees)} — итог ${money(c.net)}.${market}`,
      impact: c.fees,
      bars,
      link: { tag: 'fee-eaten' },
    };
  }
  if (c.fees / c.gross < 0.4) return null;
  return {
    id: 'fees',
    tone: 'warn',
    title: `Комиссии забирают ${pct(c.fees / c.gross)} прибыли`,
    text: `До комиссий ${money(c.gross)}, бирже ушло ${formatMoney(c.fees)}.${market}`,
    impact: c.fees,
    bars,
    link: { tag: 'fee-eaten' },
  };
}

function payoffRule(closed: readonly Trade[]): Insight | null {
  const m = summarize(closed);
  if (m.winRate < 0.5 || m.avgWin <= 0 || m.avgLoss < m.avgWin * 1.5) return null;
  const ratio = m.avgLoss / m.avgWin;
  const pnls = closed.map(calculatePnl);
  const winHold = median(closed.filter((_, i) => isWin(pnls[i])).map(durationMs));
  const lossHold = median(closed.filter((_, i) => isLoss(pnls[i])).map(durationMs));
  const hold =
    lossHold > winHold * 1.15
      ? ` Убыточные держите дольше: ${formatSpan(lossHold)} против ${formatSpan(winHold)}.`
      : '';
  return {
    id: 'payoff',
    tone: 'warn',
    title: 'Короткие плюсы, длинные минусы',
    text:
      `Винрейт ${pct(m.winRate)}, но средний убыток ${formatMoney(m.avgLoss)} ` +
      `в ${ratio.toFixed(1).replace('.', ',')} раза больше средней прибыли ${formatMoney(m.avgWin)}.${hold}`,
    impact: ((m.avgLoss - m.avgWin) * m.lossCount) / 2,
    bars: [
      { label: 'Средний плюс', value: m.avgWin },
      { label: 'Средний минус', value: -m.avgLoss },
    ],
    link: { tag: 'held-loser' },
  };
}

function revengeRule(revenge: readonly Trade[], net: number, s: DisciplineSettings): Insight | null {
  if (revenge.length < 5) return null;
  const total = sumPnl(revenge);
  if (total >= 0) return null;
  const worse = net < 0 && total < net ? ' Это больше, чем весь минус периода.' : '';
  return {
    id: 'revenge',
    tone: 'neg',
    title: `Реванш стоит ${formatMoney(-total)}`,
    text:
      `${revenge.length} ${plural(revenge.length, 'вход', 'входа', 'входов')} в ту же монету в течение ` +
      `${s.revengeMinutes} мин после убытка — итог ${money(total)}.${worse}`,
    impact: -total,
    link: { tag: 'revenge' },
  };
}

function tiltRule(closed: readonly Trade[], tilted: readonly Trade[], s: DisciplineSettings): Insight | null {
  if (tilted.length < MIN_GROUP) return null;
  const ids = new Set(tilted.map((t) => t.id));
  const rest = closed.filter((t) => !ids.has(t.id));
  const before = winRate(rest);
  const after = winRate(tilted);
  if (before - after < 0.1) return null;
  const total = sumPnl(tilted);
  return {
    id: 'tilt',
    tone: 'neg',
    title: `После ${s.pauseAfterLosses} убытков подряд вы торгуете хуже`,
    text: `Винрейт падает с ${pct(before)} до ${pct(after)}: ${tilted.length} ${plural(tilted.length, 'сделка', 'сделки', 'сделок')}, итог ${money(total)}.`,
    impact: Math.max(Math.abs(total), (before - after) * tilted.length),
    bars: [
      { label: 'Обычно', value: before * 100 },
      { label: 'После серии', value: after * 100 },
    ],
    link: { tag: 'tilt' },
  };
}

function overtradeRule(closed: readonly Trade[], s: DisciplineSettings): Insight | null {
  const days = new Map<string, { n: number; pnl: number }>();
  for (const t of closed) {
    const day = localDay(t.closedAt);
    const row = days.get(day) ?? { n: 0, pnl: 0 };
    row.n++;
    row.pnl += calculatePnl(t);
    days.set(day, row);
  }
  const heavy = [...days.values()].filter((d) => d.n > s.maxTrades);
  const normal = [...days.values()].filter((d) => d.n <= s.maxTrades);
  if (heavy.length < 3 || normal.length < 3) return null;
  const heavyPnl = heavy.reduce((a, d) => a + d.pnl, 0);
  const normalPnl = normal.reduce((a, d) => a + d.pnl, 0);
  if (heavyPnl >= 0 || heavyPnl / heavy.length >= normalPnl / normal.length) return null;
  return {
    id: 'overtrade',
    tone: 'neg',
    title: `Больше ${s.maxTrades} сделок в день — минус`,
    text:
      `${heavy.length} ${plural(heavy.length, 'такой день', 'таких дня', 'таких дней')} дали ${money(heavyPnl)}, ` +
      `остальные ${normal.length} — ${money(normalPnl)}.`,
    impact: -heavyPnl,
    bars: [
      { label: `≤ ${s.maxTrades}: средний день`, value: normalPnl / normal.length },
      { label: `> ${s.maxTrades}: средний день`, value: heavyPnl / heavy.length },
    ],
    link: { tag: 'overtrade' },
  };
}

function holdRule(closed: readonly Trade[]): Insight | null {
  const groups = groupByHold(closed).filter((g) => g.count >= MIN_GROUP);
  if (groups.length < 2) return null;
  const best = maxBy(groups, (g) => g.pnl);
  const worst = maxBy(groups, (g) => -g.pnl);
  if (best.pnl <= 0 || worst.pnl >= 0) return null;
  return {
    id: 'hold',
    tone: 'info',
    title: `Ваше окно — ${best.key}`,
    text: `Сделки ${best.key}: ${money(best.pnl)} (${best.count}). Хуже всего ${worst.key}: ${money(worst.pnl)} (${worst.count}).`,
    impact: (best.pnl - worst.pnl) / 2,
    bars: groupByHold(closed).map((g) => ({ label: g.key, value: g.pnl })),
  };
}

function weekdayRule(closed: readonly Trade[]): Insight | null {
  const groups = groupByWeekday(closed).filter((g) => g.count >= MIN_GROUP);
  if (groups.length < 3) return null;
  const worst = maxBy(groups, (g) => -g.pnl);
  const best = maxBy(groups, (g) => g.pnl);
  const spread = groups.reduce((a, g) => a + Math.abs(g.pnl), 0);
  if (worst.pnl >= 0 || Math.abs(worst.pnl) < spread * 0.25) return null;
  return {
    id: 'weekday',
    tone: 'warn',
    title: `${WEEKDAY_NAMES[worst.key] ?? worst.key} — худший день`,
    text:
      `${worst.count} ${plural(worst.count, 'сделка', 'сделки', 'сделок')}, ${money(worst.pnl)}.` +
      (best.pnl > 0 ? ` Лучший — ${(WEEKDAY_NAMES[best.key] ?? best.key).toLowerCase()}: ${money(best.pnl)}.` : ''),
    impact: -worst.pnl / 2,
    bars: groupByWeekday(closed).map((g) => ({ label: g.key, value: g.pnl })),
  };
}

function directionRule(closed: readonly Trade[]): Insight | null {
  const longs = closed.filter((t) => t.side === 'long');
  const shorts = closed.filter((t) => t.side === 'short');
  if (longs.length < MIN_GROUP || shorts.length < MIN_GROUP) return null;
  const l = sumPnl(longs);
  const sh = sumPnl(shorts);
  if (Math.sign(l) === Math.sign(sh)) return null;
  const [loser, winner, side] = l < sh ? (['Лонги', 'шортах', 'long'] as const) : (['Шорты', 'лонгах', 'short'] as const);
  const loss = Math.min(l, sh);
  return {
    id: 'direction',
    tone: 'warn',
    title: `${loser} в минусе`,
    text: `${loser}: ${money(loss)} при ${money(Math.max(l, sh))} на ${winner}.`,
    impact: -loss,
    bars: [
      { label: 'Лонги', value: l },
      { label: 'Шорты', value: sh },
    ],
    link: { side },
  };
}

function hourRule(closed: readonly Trade[]): Insight | null {
  const groups = groupByHour(closed).filter((g) => g.count >= MIN_GROUP);
  if (groups.length < 4) return null;
  const worst = maxBy(groups, (g) => -g.pnl);
  const best = maxBy(groups, (g) => g.pnl);
  if (worst.pnl >= 0) return null;
  const span = (g: GroupStat) => `${Number(g.key)}:00–${(Number(g.key) + 1) % 24}:00`;
  return {
    id: 'hour',
    tone: 'info',
    title: `Худший час — ${span(worst)}`,
    text:
      `Входы в ${span(worst)}: ${money(worst.pnl)} (${worst.count}).` +
      (best.pnl > 0 ? ` Лучше всего ${span(best)}: ${money(best.pnl)}.` : ''),
    impact: -worst.pnl / 3,
    bars: groupByHour(closed).map((g) => ({ label: g.key, value: g.pnl })),
  };
}

function maxBy<T>(items: readonly T[], fn: (item: T) => number): T {
  return items.reduce((best, item) => (fn(item) > fn(best) ? item : best));
}
