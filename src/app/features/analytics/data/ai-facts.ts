import { Candle, Timeframe, barOpenTime } from '../../../core/market/market.model';
import { TradeFill } from '../../trades/data/trade-chart.model';
import { Trade, calculatePnlPercent, localDay } from '../../trades/data/trade.model';
import { AUTO_TAG_LABELS, TagMark } from './behavior';
import { DisciplineSettings } from './discipline.model';

/**
 * Факты для «Разбора от ИИ» — то, что журнал уже знает о сделке или дне по
 * данным биржи. Модель видит только их (ни ключей, ни сырой истории), поэтому
 * здесь же — подписи и округление: компактно и без лишних знаков.
 */

/** Ход цены вокруг сделки по свечам графика: проценты от цены входа/выхода. */
export interface PriceAction {
  timeframe: Timeframe;
  /** Сколько цена проходила в сторону позиции, пока она была открыта. */
  maxFavorablePct: number;
  /** Сколько цена проходила против позиции (≤ 0). */
  maxAdversePct: number;
  /** Куда цена ушла за `afterExitBars` свечей после выхода; плюс — в сторону позиции. */
  afterExitPct: number | null;
  afterExitBars: number;
}

const AFTER_EXIT_BARS = 10;

export function priceAction(trade: Trade, candles: readonly Candle[], timeframe: Timeframe): PriceAction | null {
  const entry = trade.entryPrice;
  if (entry === null || entry <= 0 || candles.length === 0) return null;
  const from = barOpenTime(Date.parse(trade.openedAt), timeframe);
  const closedAt = trade.status === 'closed' ? Date.parse(trade.closedAt) : Date.now();
  const to = barOpenTime(closedAt, timeframe);
  const held = candles.filter((c) => c[0] >= from && c[0] <= to);
  if (held.length === 0) return null;
  const high = Math.max(...held.map((c) => c[2]));
  const low = Math.min(...held.map((c) => c[3]));
  const long = trade.side === 'long';
  const favorable = long ? (high - entry) / entry : (entry - low) / entry;
  const adverse = long ? (low - entry) / entry : (entry - high) / entry;

  let afterExitPct: number | null = null;
  const exit = trade.exitPrice;
  if (trade.status === 'closed' && exit !== null && exit > 0) {
    const after = candles.filter((c) => c[0] > to).slice(0, AFTER_EXIT_BARS);
    if (after.length > 0) {
      const move = (after[after.length - 1][4] - exit) / exit;
      afterExitPct = pct(long ? move : -move);
    }
  }
  return {
    timeframe,
    maxFavorablePct: pct(Math.max(0, favorable)),
    maxAdversePct: pct(Math.min(0, adverse)),
    afterExitPct,
    afterExitBars: AFTER_EXIT_BARS,
  };
}

export interface TradeFactsInput {
  trade: Trade;
  marks: readonly TagMark[];
  manualTags: readonly string[];
  fills: readonly TradeFill[];
  priceAction: PriceAction | null;
  /** Закрытые сделки счёта до входа в эту, новые первыми. */
  previous: readonly Trade[];
  rules: DisciplineSettings;
}

export function tradeFacts(input: TradeFactsInput): Record<string, unknown> {
  const { trade, rules } = input;
  const opened = Date.parse(trade.openedAt);
  const closed = trade.status === 'closed' ? Date.parse(trade.closedAt) : null;
  const sameDay = input.previous.filter((p) => localDay(p.closedAt) === localDay(trade.openedAt));
  return {
    symbol: trade.symbol,
    side: trade.side,
    status: trade.status,
    openedAt: clock(opened),
    closedAt: closed === null ? null : clock(closed),
    durationSec: Math.round(((closed ?? Date.now()) - opened) / 1000),
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    notionalUsd: trade.entryPrice === null ? null : money(trade.entryPrice * trade.quantity),
    priceMovePct: pct(calculatePnlPercent(trade) / 100),
    grossPnlUsd: money(trade.realizedPnl),
    feesUsd: money(trade.fees),
    fundingUsd: money(trade.funding),
    netPnlUsd: money(trade.netPnl),
    openOrderType: trade.openOrderType,
    closeOrderType: trade.closeOrderType,
    fills: input.fills.slice(0, 20).map((f) => ({
      secFromOpen: Math.round((f.time - opened) / 1000),
      side: f.side,
      price: f.price,
      qty: f.qty,
    })),
    autoTags: input.marks.map((m) => ({ tag: AUTO_TAG_LABELS[m.tag], reason: m.reason })),
    manualTags: input.manualTags,
    priceAction: input.priceAction,
    context: {
      tradesEarlierToday: sameDay.length,
      netEarlierTodayUsd: money(sameDay.reduce((sum, p) => sum + p.netPnl, 0)),
      previousTrades: input.previous.slice(0, 3).map((p) => ({
        symbol: p.symbol,
        side: p.side,
        netPnlUsd: money(p.netPnl),
        minutesBeforeEntry: Math.round((opened - Date.parse(p.closedAt)) / 60_000),
      })),
    },
    rules: rulesFacts(rules),
  };
}

export interface DayFactsInput {
  date: string;
  /** Сделки дня по времени закрытия. */
  trades: readonly Trade[];
  marksOf: (trade: Trade) => readonly TagMark[];
  manualTagsOf: (trade: Trade) => readonly string[];
  rules: DisciplineSettings;
}

/** Сделок дня в фактах — скальперу хватает, а запрос не раздувается. */
const MAX_DAY_TRADES = 80;

export function dayFacts(input: DayFactsInput): Record<string, unknown> {
  const trades = input.trades;
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let streak = 0;
  let worstStreak = 0;
  for (const t of trades) {
    running += t.netPnl;
    peak = Math.max(peak, running);
    maxDrawdown = Math.min(maxDrawdown, running - peak);
    streak = t.netPnl < 0 ? streak + 1 : 0;
    worstStreak = Math.max(worstStreak, streak);
  }
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const net = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const gross = trades.reduce((sum, t) => sum + t.realizedPnl, 0);
  const fees = trades.reduce((sum, t) => sum + t.fees, 0);
  const tagCounts: Record<string, number> = {};
  for (const t of trades) {
    for (const m of input.marksOf(t)) {
      const label = AUTO_TAG_LABELS[m.tag];
      tagCounts[label] = (tagCounts[label] ?? 0) + 1;
    }
  }
  return {
    date: input.date,
    trades: trades.length,
    wins,
    losses: trades.filter((t) => t.netPnl < 0).length,
    winRatePct: trades.length ? Math.round((wins / trades.length) * 100) : 0,
    netPnlUsd: money(net),
    grossPnlUsd: money(gross),
    feesUsd: money(fees),
    maxIntradayDrawdownUsd: money(maxDrawdown),
    longestLossStreak: worstStreak,
    autoTagCounts: tagCounts,
    tradeList: trades.slice(0, MAX_DAY_TRADES).map((t) => ({
      closedAt: clock(Date.parse(t.closedAt)),
      symbol: t.symbol,
      side: t.side,
      durationSec: Math.round((Date.parse(t.closedAt) - Date.parse(t.openedAt)) / 1000),
      netPnlUsd: money(t.netPnl),
      feesUsd: money(t.fees),
      autoTags: input.marksOf(t).map((m) => AUTO_TAG_LABELS[m.tag]),
      manualTags: input.manualTagsOf(t),
    })),
    omittedTrades: Math.max(0, trades.length - MAX_DAY_TRADES),
    rules: rulesFacts(input.rules),
  };
}

function rulesFacts(rules: DisciplineSettings): Record<string, unknown> {
  return {
    dailyLossLimitUsd: rules.dailyLossLimit,
    maxTradesPerDay: rules.maxTrades,
    pauseAfterLossesInRow: rules.pauseAfterLosses,
    revengeWindowMin: rules.revengeMinutes,
  };
}

/** Местное время трейдера: «2026-10-31 14:05:09». */
function clock(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${localDay(ms)} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Доля → проценты с тремя знаками (скальп — сотые доли процента). */
function pct(share: number): number {
  return Math.round(share * 100_000) / 1000;
}
