import {
  Trade,
  calculatePnl,
  calculateRMultiple,
  durationMs,
  notional,
  tradingSession,
  SESSION_LABELS,
} from '../../trades/data/trade.model';

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
  count: number;
  wins: number;
  winRate: number;
  avgR: number | null;
}

export interface SummaryMetrics {
  tradeCount: number;
  openCount: number;
  netPnl: number;
  grossPnl: number;
  fees: number;
  funding: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  profitFactor: number | null;
  expectancyUsd: number;
  expectancyR: number | null;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgR: number | null;
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

const BREAKEVEN_EPS = 1; // |P&L| ≤ $1 — сделка «в ноль»

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
    else if (pnl > 0) {
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
  const rValues = closed.map(calculateRMultiple).filter((r): r is number => r !== null);
  const decisive = winCount + lossCount;

  const equity = equityCurve(closed);
  const maxDrawdown = equity.reduce((max, p) => Math.max(max, p.drawdown), 0);

  const { current, bestWin, worstLoss } = streaks(pnls);
  const days = new Set(closed.map((t) => t.closedAt.slice(0, 10))).size;

  return {
    tradeCount: closed.length,
    openCount: trades.length - closed.length,
    netPnl,
    grossPnl: netPnl + fees + funding,
    fees,
    funding,
    winCount,
    lossCount,
    breakevenCount,
    winRate: decisive === 0 ? 0 : winCount / decisive,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : null) : grossProfit / grossLoss,
    expectancyUsd: closed.length === 0 ? 0 : netPnl / closed.length,
    expectancyR: rValues.length === 0 ? null : rValues.reduce((s, v) => s + v, 0) / rValues.length,
    avgWin: winCount === 0 ? 0 : grossProfit / winCount,
    avgLoss: lossCount === 0 ? 0 : grossLoss / lossCount,
    largestWin: pnls.length === 0 ? 0 : Math.max(0, ...pnls),
    largestLoss: pnls.length === 0 ? 0 : Math.min(0, ...pnls),
    avgR: rValues.length === 0 ? null : rValues.reduce((s, v) => s + v, 0) / rValues.length,
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

/** P&L по календарным дням (по дате закрытия). */
export function dailyPnl(trades: readonly Trade[]): DayPnl[] {
  const map = new Map<string, DayPnl>();
  for (const t of closedTrades(trades)) {
    const date = t.closedAt.slice(0, 10);
    const row = map.get(date) ?? { date, pnl: 0, count: 0, wins: 0 };
    const pnl = calculatePnl(t);
    row.pnl += pnl;
    row.count++;
    if (pnl > BREAKEVEN_EPS) row.wins++;
    map.set(date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Универсальная группировка: P&L, винрейт и средний R по ключу. */
export function groupBy(trades: readonly Trade[], keyFn: (t: Trade) => string | string[]): GroupStat[] {
  const map = new Map<string, { pnl: number; count: number; wins: number; rSum: number; rCount: number }>();
  for (const t of closedTrades(trades)) {
    const keys = keyFn(t);
    const pnl = calculatePnl(t);
    const r = calculateRMultiple(t);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      const row = map.get(key) ?? { pnl: 0, count: 0, wins: 0, rSum: 0, rCount: 0 };
      row.pnl += pnl;
      row.count++;
      if (pnl > BREAKEVEN_EPS) row.wins++;
      if (r !== null) {
        row.rSum += r;
        row.rCount++;
      }
      map.set(key, row);
    }
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      pnl: v.pnl,
      count: v.count,
      wins: v.wins,
      winRate: v.count === 0 ? 0 : v.wins / v.count,
      avgR: v.rCount === 0 ? null : v.rSum / v.rCount,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

/** Индекс дня недели, понедельник = 0. */
export function weekdayIndex(iso: string): number {
  return (new Date(iso).getUTCDay() + 6) % 7;
}

export function groupByWeekday(trades: readonly Trade[]): GroupStat[] {
  const stats = groupBy(trades, (t) => WEEKDAY_LABELS[weekdayIndex(t.openedAt)]);
  return [...WEEKDAY_LABELS]
    .map((label) => stats.find((s) => s.key === label))
    .filter((s): s is GroupStat => s !== undefined);
}

export function groupByHour(trades: readonly Trade[]): GroupStat[] {
  const stats = groupBy(trades, (t) => String(new Date(t.openedAt).getUTCHours()).padStart(2, '0'));
  return stats.sort((a, b) => a.key.localeCompare(b.key));
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

/** Матрица день-недели × час (UTC) для теплокарты активности. */
export function hourWeekdayHeatmap(trades: readonly Trade[]): HeatmapCell[] {
  const map = new Map<string, HeatmapCell>();
  for (const t of closedTrades(trades)) {
    const weekday = weekdayIndex(t.openedAt);
    const hour = new Date(t.openedAt).getUTCHours();
    const key = `${weekday}:${hour}`;
    const cell = map.get(key) ?? { weekday, hour, pnl: 0, count: 0 };
    cell.pnl += calculatePnl(t);
    cell.count++;
    map.set(key, cell);
  }
  return [...map.values()];
}

export interface RBucket {
  /** Левая граница интервала, в R. */
  from: number;
  count: number;
}

/** Гистограмма R-multiple с шагом 0.5R. */
export function rHistogram(trades: readonly Trade[]): RBucket[] {
  const values = closedTrades(trades)
    .map(calculateRMultiple)
    .filter((r): r is number => r !== null);
  if (values.length === 0) return [];
  const step = 0.5;
  const map = new Map<number, number>();
  for (const r of values) {
    const clamped = Math.max(-3, Math.min(6, r));
    const from = Math.floor(clamped / step) * step;
    map.set(from, (map.get(from) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([from, count]) => ({ from, count }))
    .sort((a, b) => a.from - b.from);
}

function streaks(pnls: readonly number[]): { current: number; bestWin: number; worstLoss: number } {
  let current = 0;
  let bestWin = 0;
  let worstLoss = 0;
  for (const pnl of pnls) {
    if (Math.abs(pnl) <= BREAKEVEN_EPS) continue;
    if (pnl > 0) current = current > 0 ? current + 1 : 1;
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
