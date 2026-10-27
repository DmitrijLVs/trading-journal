import { Trade, notional } from '../../trades/data/trade.model';
import { closedTrades } from './metrics';
import { median } from './behavior';

/**
 * Издержки торговли: сколько ушло бирже и что с этим можно сделать.
 * Ставки — базовые Binance USDⓈ-M (VIP 0), для оценки «что если»: точные
 * комиссии сделок мы знаем, а вот ставку другого типа ордера — только так.
 */
export const TAKER_RATE = 0.0005;
export const MAKER_RATE = 0.0002;

export interface CostBreakdown {
  tradeCount: number;
  /** Биржевой результат до комиссий и фандинга. */
  gross: number;
  fees: number;
  /** Плюс — фандинг получен, минус — уплачен. */
  funding: number;
  net: number;
  /** Комиссии к валовой прибыли (только когда она положительна). */
  feeShareOfGross: number | null;
  avgFeePerTrade: number;
  /** Входы и выходы по типу ордера (неизвестные не считаем). */
  marketEntries: number;
  limitEntries: number;
  marketExits: number;
  limitExits: number;
  /** Доля сделок «маркет → маркет» среди сделок с известными ордерами. */
  marketRoundTripShare: number | null;
  /** Сколько процентов должна пройти цена, чтобы окупить комиссию круга (медиана). */
  breakevenMovePct: number | null;
  /** Типичная прибыльная сделка — для сравнения с комиссией. */
  medianWin: number;
  /** ≈ экономия, если бы маркет-входы были лимитными (мейкер вместо тейкера). */
  limitEntrySavings: number;
}

export function costBreakdown(trades: readonly Trade[]): CostBreakdown {
  const closed = closedTrades(trades);
  const sum = (fn: (t: Trade) => number) => closed.reduce((s, t) => s + fn(t), 0);

  const gross = sum((t) => t.realizedPnl);
  const fees = sum((t) => t.fees);
  const funding = sum((t) => t.funding);
  const known = closed.filter((t) => t.openOrderType && t.closeOrderType);
  const count = (fn: (t: Trade) => boolean) => closed.filter(fn).length;

  const moves = closed
    .map((t) => ({ fee: t.fees, size: notional(t) }))
    .filter((r) => r.size > 0 && r.fee > 0)
    .map((r) => (r.fee / r.size) * 100);

  return {
    tradeCount: closed.length,
    gross,
    fees,
    funding,
    net: sum((t) => t.netPnl),
    feeShareOfGross: gross > 0 ? fees / gross : null,
    avgFeePerTrade: closed.length ? fees / closed.length : 0,
    marketEntries: count((t) => t.openOrderType === 'market'),
    limitEntries: count((t) => t.openOrderType === 'limit'),
    marketExits: count((t) => t.closeOrderType === 'market'),
    limitExits: count((t) => t.closeOrderType === 'limit'),
    marketRoundTripShare: known.length
      ? known.filter((t) => t.openOrderType === 'market' && t.closeOrderType === 'market').length /
        known.length
      : null,
    breakevenMovePct: moves.length ? median(moves) : null,
    medianWin: median(closed.map((t) => t.netPnl).filter((v) => v > 0)),
    limitEntrySavings: sum((t) =>
      t.openOrderType === 'market' && t.entryPrice !== null
        ? t.entryPrice * t.quantity * (TAKER_RATE - MAKER_RATE)
        : 0,
    ),
  };
}
