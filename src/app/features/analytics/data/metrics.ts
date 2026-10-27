import {
  BREAKEVEN_EPS,
  OrderType,
  Trade,
  calculatePnl,
  durationMs,
  isWin,
  localDay,
  notional,
  tradingSession,
  SESSION_LABELS,
} from '../../trades/data/trade.model';
import {
  AUTO_TAG_LABELS,
  CLEAN_TAG_LABEL,
  TradeTags,
  lossStreakBefore,
  tagsOf,
} from './behavior';

/**
 * Чистые функции аналитики. Работают с уже отфильтрованным массивом сделок;
 * никакого Angular — тривиально тестируются и переносимы в Web Worker.
 */

export interface EquityPoint {
  time: number;
  equity: number;
  /** Просадка от пика на этот момент, в валюте. */
  drawdown: number;
}

export interface DayPnl {
  /** YYYY-MM-DD */
  date: string;
  pnl: number;
  count: number;
  wins: number;
}

export interface GroupStat {
  key: string;
  pnl: number;
  /** Биржевой результат до комиссий и фандинга. */
  gross: number;
  fees: number;
  count: number;
  wins: number;
  winRate: number;
}

export interface SummaryMetrics {
  tradeCount: number;
  openCount: number;
  netPnl: number;
  /** Сумма realized P&L биржи — до комиссий и фандинга. */
  grossPnl: number;
  fees: number;
  /** Плюс — фандинг получен, минус — уплачен. */
  funding: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  profitFactor: number | null;
  expectancyUsd: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
  avgDurationMs: number;
  maxDrawdown: number;
  currentStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  tradingDays: number;
}

export function closedTrades(trades: readonly Trade[]): Trade[] {
  return trades
    .filter((t) => t.status === 'closed')
    .sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());
}

export function summarize(trades: readonly Trade[]): SummaryMetrics {
  const closed = closedTrades(trades);
  const pnls = closed.map(calculatePnl);

  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let grossProfit = 0;
  let grossLoss = 0;

  for (const pnl of pnls) {
    if (Math.abs(pnl) <= BREAKEVEN_EPS) breakevenCount++;
    else if (isWin(pnl)) {
      winCount++;
      grossProfit += pnl;
    } else {
      lossCount++;
      grossLoss += -pnl;
    }
  }

  const netPnl = pnls.reduce((s, v) => s + v, 0);
  const fees = closed.reduce((s, t) => s + t.fees, 0);
  const funding = closed.reduce((s, t) => s + t.funding, 0);
  const decisive = winCount + lossCount;

  const equity = equityCurve(closed);
  const maxDrawdown = equity.reduce((max, p) => Math.max(max, p.drawdown), 0);

  const { current, bestWin, worstLoss } = streaks(pnls);
  const days = new Set(closed.map((t) => localDay(t.closedAt))).size;

  return {
    tradeCount: closed.length,
    openCount: trades.length - closed.length,
    netPnl,
    grossPnl: netPnl + fees - funding,
    fees,
    funding,
    winCount,
    lossCount,
    breakevenCount,
    winRate: decisive === 0 ? 0 : winCount / decisive,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : null) : grossProfit / grossLoss,
    expectancyUsd: closed.length === 0 ? 0 : netPnl / closed.length,
    avgWin: winCount === 0 ? 0 : grossProfit / winCount,
    avgLoss: lossCount === 0 ? 0 : grossLoss / lossCount,
    largestWin: pnls.length === 0 ? 0 : Math.max(0, ...pnls),
    largestLoss: pnls.length === 0 ? 0 : Math.min(0, ...pnls),
    totalVolume: closed.reduce((s, t) => s + notional(t), 0),
    avgDurationMs:
      closed.length === 0 ? 0 : closed.reduce((s, t) => s + durationMs(t), 0) / closed.length,
    maxDrawdown,
    currentStreak: current,
    bestWinStreak: bestWin,
    worstLossStreak: worstLoss,
    tradingDays: days,
  };
}

/** Кумулятивная кривая P&L по времени закрытия + просадка от пика. */
export function equityCurve(trades: readonly Trade[]): EquityPoint[] {
  const closed = closedTrades(trades);
  const points: EquityPoint[] = [];
  let equity = 0;
  let peak = 0;
  for (const t of closed) {
    equity += calculatePnl(t);
    peak = Math.max(peak, equity);
    points.push({ time: new Date(t.closedAt).getTime(), equity, drawdown: peak - equity });
  }
  return points;
}

/** P&L по календарным дням пользователя (по дате закрытия). */
export function dailyPnl(trades: readonly Trade[]): DayPnl[] {
  const map = new Map<string, DayPnl>();
  for (const t of closedTrades(trades)) {
    const date = localDay(t.closedAt);
    const row = map.get(date) ?? { date, pnl: 0, count: 0, wins: 0 };
    const pnl = calculatePnl(t);
    row.pnl += pnl;
    row.count++;
    if (isWin(pnl)) row.wins++;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Универсальная группировка: P&L и винрейт по ключу. */
export function groupBy(
  trades: readonly Trade[],
  keyFn: (t: Trade) => string | readonly string[],
): GroupStat[] {
  const map = new Map<string, { pnl: number; gross: number; fees: number; count: number; wins: number }>();
  for (const t of closedTrades(trades)) {
    const keys = keyFn(t);
    const pnl = calculatePnl(t);
    for (const key of typeof keys === 'string' ? [keys] : keys) {
      if (!key) continue;
      const row = map.get(key) ?? { pnl: 0, gross: 0, fees: 0, count: 0, wins: 0 };
      row.pnl += pnl;
      row.gross += t.realizedPnl;
      row.fees += t.fees;
      row.count++;
      if (isWin(pnl)) row.wins++;
      map.set(key, row);
    }
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      ...v,
      winRate: v.count === 0 ? 0 : v.wins / v.count,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

/** Группы в заданном порядке (порядковые шкалы: время, серии, нагрузка). */
function ordered(stats: GroupStat[], order: readonly string[]): GroupStat[] {
  return order.flatMap((key) => stats.filter((s) => s.key === key));
}

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** Индекс дня недели в зоне пользователя, понедельник = 0. */
export function weekdayIndex(iso: string): number {
  return (new Date(iso).getDay() + 6) % 7;
}

export function groupByWeekday(trades: readonly Trade[]): GroupStat[] {
  const stats = groupBy(trades, (t) => WEEKDAY_LABELS[weekdayIndex(t.openedAt)]);
  return [...WEEKDAY_LABELS]
    .map((label) => stats.find((s) => s.key === label))
    .filter((s): s is GroupStat => s !== undefined);
}

/** По часу входа в зоне пользователя. */
export function groupByHour(trades: readonly Trade[]): GroupStat[] {
  const stats = groupBy(trades, (t) => String(new Date(t.openedAt).getHours()).padStart(2, '0'));
  return stats.sort((a, b) => a.key.localeCompare(b.key));
}

/** Корзины времени удержания — от скальпа до свинга. */
export const HOLD_BUCKETS: readonly { key: string; maxMs: number }[] = [
  { key: '< 1 мин', maxMs: 60_000 },
  { key: '1–5 мин', maxMs: 5 * 60_000 },
  { key: '5–30 мин', maxMs: 30 * 60_000 },
  { key: '30 мин – 2 ч', maxMs: 2 * 3_600_000 },
  { key: '2–24 ч', maxMs: 86_400_000 },
  { key: '> 1 дня', maxMs: Infinity },
];

export function holdBucket(ms: number): string {
  return (HOLD_BUCKETS.find((b) => ms < b.maxMs) ?? HOLD_BUCKETS[HOLD_BUCKETS.length - 1]).key;
}

export function groupByHold(trades: readonly Trade[]): GroupStat[] {
  const stats = groupBy(
    trades.filter((t) => !t.carriedIn),
    (t) => holdBucket(durationMs(t)),
  );
  return ordered(stats, HOLD_BUCKETS.map((b) => b.key));
}

/** Корзины дневной нагрузки: сколько сделок было в день этой сделки. */
const DAY_LOAD_BUCKETS: readonly { key: string; max: number }[] = [
  { key: 'до 5 в день', max: 5 },
  { key: '6–15 в день', max: 15 },
  { key: '16–25 в день', max: 25 },
  { key: '26–50 в день', max: 50 },
  { key: '50+ в день', max: Infinity },
];

export function groupByDayLoad(trades: readonly Trade[]): GroupStat[] {
  const perDay = new Map<string, number>();
  for (const t of trades) {
    const day = localDay(t.openedAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const stats = groupBy(trades, (t) => {
    const n = perDay.get(localDay(t.openedAt)) ?? 0;
    return (DAY_LOAD_BUCKETS.find((b) => n <= b.max) ?? DAY_LOAD_BUCKETS[0]).key;
  });
  return ordered(stats, DAY_LOAD_BUCKETS.map((b) => b.key));
}

const STREAK_KEYS = ['после плюса', 'после 1 убытка', 'после 2 убытков', 'после 3+ убытков'] as const;

/** Результат в зависимости от серии убытков перед входом. */
export function groupByLossStreak(trades: readonly Trade[], history: readonly Trade[]): GroupStat[] {
  const streaks = lossStreakBefore(history);
  const stats = groupBy(trades, (t) => STREAK_KEYS[Math.min(3, streaks.get(t.id)?.count ?? 0)]);
  return ordered(stats, STREAK_KEYS);
}

const ORDER_LABELS: Record<OrderType, string> = { market: 'Маркет', limit: 'Лимит' };

/** Тип ордеров входа и выхода: «Маркет → маркет». */
export function orderRoute(t: Trade): string {
  if (!t.openOrderType || !t.closeOrderType) return 'Неизвестно';
  return `${ORDER_LABELS[t.openOrderType]} → ${ORDER_LABELS[t.closeOrderType].toLowerCase()}`;
}

export function groupByOrderType(trades: readonly Trade[]): GroupStat[] {
  return groupBy(trades, orderRoute).sort((a, b) => b.count - a.count);
}

/** Результат по автотегам; сделки без тегов — отдельной группой для сравнения. */
export function groupByAutoTag(trades: readonly Trade[], tags: TradeTags): GroupStat[] {
  return groupBy(trades, (t) => {
    const list = tagsOf(tags, t);
    return list.length ? list.map((tag) => AUTO_TAG_LABELS[tag]) : [CLEAN_TAG_LABEL];
  });
}

export function groupBySession(trades: readonly Trade[]): GroupStat[] {
  return groupBy(trades, (t) => SESSION_LABELS[tradingSession(t.openedAt)]);
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  pnl: number;
  count: number;
}

/** Матрица день-недели × час (в зоне пользователя) для теплокарты активности. */
export function hourWeekdayHeatmap(trades: readonly Trade[]): HeatmapCell[] {
  const map = new Map<string, HeatmapCell>();
  for (const t of closedTrades(trades)) {
    const weekday = weekdayIndex(t.openedAt);
    const hour = new Date(t.openedAt).getHours();
    const key = `${weekday}:${hour}`;
    const cell = map.get(key) ?? { weekday, hour, pnl: 0, count: 0 };
    cell.pnl += calculatePnl(t);
    cell.count++;
    map.set(key, cell);
  }
  return [...map.values()];
}

function streaks(pnls: readonly number[]): { current: number; bestWin: number; worstLoss: number } {
  let current = 0;
  let bestWin = 0;
  let worstLoss = 0;
  for (const pnl of pnls) {
    if (Math.abs(pnl) <= BREAKEVEN_EPS) continue;
    if (isWin(pnl)) current = current > 0 ? current + 1 : 1;
    else current = current < 0 ? current - 1 : -1;
    bestWin = Math.max(bestWin, current);
    worstLoss = Math.min(worstLoss, current);
  }
  return { current, bestWin, worstLoss: Math.abs(worstLoss) };
}

export function formatProfitFactor(pf: number | null): string {
  if (pf === null) return '—';
  if (!Number.isFinite(pf)) return '∞';
  return pf.toFixed(2);
}
