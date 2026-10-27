import { Trade, calculatePnl, isLoss, isWin, localDay } from '../../trades/data/trade.model';

/**
 * Торговый день: итог, серия и лента сделок на оси времени. День — в зоне
 * пользователя; закрытые сделки относятся к дню закрытия, открытые — к сегодня.
 */
export interface DaySummary {
  day: string;
  net: number;
  gross: number;
  fees: number;
  /** Закрытых за день. */
  closed: number;
  /** Входов за день (включая ещё открытые). */
  entries: number;
  wins: number;
  losses: number;
  /** Убытков подряд в конце дня (0 — серия прервана или её не было). */
  lossStreak: number;
}

export function daySummary(trades: readonly Trade[], day: string): DaySummary {
  const closed = closedOn(trades, day);
  const pnls = closed.map(calculatePnl);
  let lossStreak = 0;
  for (let i = pnls.length - 1; i >= 0; i--) {
    if (isLoss(pnls[i])) lossStreak++;
    else if (isWin(pnls[i])) break;
  }
  return {
    day,
    net: pnls.reduce((s, v) => s + v, 0),
    gross: closed.reduce((s, t) => s + t.realizedPnl, 0),
    fees: closed.reduce((s, t) => s + t.fees, 0),
    closed: closed.length,
    entries: trades.filter((t) => localDay(t.openedAt) === day).length,
    wins: pnls.filter(isWin).length,
    losses: pnls.filter(isLoss).length,
    lossStreak,
  };
}

/** Закрытые за день сделки по времени закрытия. */
export function closedOn(trades: readonly Trade[], day: string): Trade[] {
  return trades
    .filter((t) => t.status === 'closed' && localDay(t.closedAt) === day)
    .sort((a, b) => a.closedAt.localeCompare(b.closedAt));
}

export interface TimelineTrade {
  trade: Trade;
  /** Дорожка: сделки, идущие одновременно, — на разных дорожках. */
  lane: number;
  start: number;
  end: number;
  pnl: number;
}

export interface DayTimeline {
  /** Накопленный итог дня по закрытиям: [время, $]. */
  curve: [number, number][];
  trades: TimelineTrade[];
  lanes: number;
  from: number;
  to: number;
}

/** Лента дня: кривая накопленного итога и полоски сделок (жадная раскладка по дорожкам). */
export function dayTimeline(trades: readonly Trade[], day: string, now = Date.now()): DayTimeline {
  const dayTrades = trades
    .filter(
      (t) =>
        (t.status === 'closed' && localDay(t.closedAt) === day) ||
        (t.status === 'open' && localDay(now) === day),
    )
    .map((trade) => ({
      trade,
      start: new Date(trade.openedAt).getTime(),
      end: trade.status === 'closed' ? new Date(trade.closedAt).getTime() : now,
      pnl: calculatePnl(trade),
    }))
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const placed: TimelineTrade[] = dayTrades.map((t) => {
    let lane = laneEnds.findIndex((end) => end <= t.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(t.end);
    } else {
      laneEnds[lane] = t.end;
    }
    return { ...t, lane };
  });

  const dayStart = new Date(`${day}T00:00:00`).getTime();
  const from = placed.length ? Math.min(...placed.map((t) => t.start)) : dayStart;
  const to = placed.length ? Math.max(...placed.map((t) => t.end)) : dayStart + 86_400_000;
  let total = 0;
  const curve: [number, number][] = [[from, 0]];
  for (const t of closedOn(trades, day)) {
    total += calculatePnl(t);
    curve.push([new Date(t.closedAt).getTime(), total]);
  }
  return { curve, trades: placed, lanes: laneEnds.length, from, to };
}

/** Дни с закрытыми сделками, новые первыми. */
export function tradingDays(trades: readonly Trade[]): string[] {
  const days = new Set(trades.filter((t) => t.status === 'closed').map((t) => localDay(t.closedAt)));
  return [...days].sort((a, b) => b.localeCompare(a));
}
