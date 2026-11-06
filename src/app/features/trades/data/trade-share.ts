import type { ShareCard, ShareLayout, ShareTone } from '../../../shared/share/share-card';
import type { MarketExchange, Timeframe } from '../../../core/market/market.model';
import {
  Trade,
  calculatePnl,
  calculatePnlPercent,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  isLoss,
  isWin,
  localDay,
  notional,
  tradeTimeRange,
} from './trade.model';

const EXCHANGE_LABEL: Record<MarketExchange, string> = { binance: 'Binance', bybit: 'Bybit', okx: 'OKX' };
const ORDER_LABEL = { market: 'маркет', limit: 'лимит' } as const;

export interface TradeShareContext {
  /** Кадр графика под размер вида (`chartSnapshot`); null — без графика. */
  chart: HTMLCanvasElement | null;
  layout: ShareLayout;
  timeframe: Timeframe;
  exchange: MarketExchange;
  /** Скрыть суммы: деньги, объём и количество. */
  mask: boolean;
}

export function tone(value: number): ShareTone {
  return isWin(value) ? 'pos' : isLoss(value) ? 'neg' : 'flat';
}

/**
 * Снимок сделки. 'card': итог крупно, ход цены, вход/выход/объём/комиссии и
 * кадр графика; со скрытыми суммами главным становится ход цены в процентах.
 * 'chart': только график, сделка — строкой над ним (без кадра — как 'card').
 */
export function tradeShareCard(trade: Trade, ctx: TradeShareContext): ShareCard {
  const closed = trade.status === 'closed';
  const pnl = calculatePnl(trade);
  const move = calculatePnlPercent(trade);
  if (ctx.layout === 'chart' && ctx.chart) return chartOnlyCard(trade, ctx.chart, ctx, closed ? pnl : null, move);
  const moveText = `${formatPercent(move, { sign: true })} ход цены`;
  const result: ShareCard['result'] = !closed
    ? { text: 'Открыта', tone: 'flat' }
    : ctx.mask
      ? { text: formatPercent(move, { sign: true }), tone: tone(pnl) }
      : { text: formatMoney(pnl, { sign: true, mask: false }), tone: tone(pnl) };
  return {
    title: trade.symbol,
    badge: { text: trade.side === 'long' ? 'Лонг' : 'Шорт', tone: trade.side },
    subtitle: tradeTimeRange(trade),
    result,
    resultNote: !closed ? 'позиция ещё в рынке' : ctx.mask ? 'ход цены' : moveText,
    facts: [
      {
        label: 'Вход',
        value: trade.carriedIn ? 'до начала истории' : formatPrice(trade.entryPrice),
        note: trade.openOrderType ? ORDER_LABEL[trade.openOrderType] : undefined,
      },
      {
        label: 'Выход',
        value: trade.exitPrice === null ? '—' : formatPrice(trade.exitPrice),
        note: closed && trade.closeOrderType ? ORDER_LABEL[trade.closeOrderType] : undefined,
      },
      {
        label: 'Объём',
        value: formatMoney(notional(trade), { mask: ctx.mask }),
        // Со скрытыми суммами количество тоже точки — «••• $•••» не читается.
        note: ctx.mask ? undefined : formatQuantity(trade.quantity, { mask: false }),
      },
      { label: 'Комиссии', value: formatMoney(trade.fees, { mask: ctx.mask }) },
    ],
    visual: ctx.chart ? { kind: 'chart', image: ctx.chart } : null,
    stamp: `${EXCHANGE_LABEL[ctx.exchange]} · ${ctx.timeframe}`,
  };
}

/** «BTCUSDT [1m] [Шорт] −0,48% −$42,55» над графиком, ниже — биржа, время и цены. */
function chartOnlyCard(
  trade: Trade,
  chart: HTMLCanvasElement,
  ctx: TradeShareContext,
  pnl: number | null,
  move: number,
): ShareCard {
  const prices =
    trade.exitPrice === null
      ? `вход ${formatPrice(trade.entryPrice)}`
      : `${formatPrice(trade.entryPrice)} → ${formatPrice(trade.exitPrice)}`;
  return {
    layout: 'chart',
    title: trade.symbol,
    chip: ctx.timeframe,
    badge: { text: trade.side === 'long' ? 'Лонг' : 'Шорт', tone: trade.side },
    subtitle: `${EXCHANGE_LABEL[ctx.exchange]} · ${tradeTimeRange(trade)} · ${prices}`,
    result:
      pnl === null
        ? { text: 'Открыта', tone: 'flat' }
        : { text: formatPercent(move, { sign: true }), tone: tone(pnl) },
    resultNote: pnl === null || ctx.mask ? undefined : formatMoney(pnl, { sign: true, mask: false }),
    facts: [],
    visual: { kind: 'chart', image: chart },
    stamp: '',
  };
}

/** `btcusdt-long-2026-11-06`. */
export function tradeShareFileName(trade: Trade): string {
  return `${trade.symbol.toLowerCase()}-${trade.side}-${localDay(trade.openedAt)}`;
}
