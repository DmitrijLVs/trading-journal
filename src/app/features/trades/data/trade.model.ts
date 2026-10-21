export type TradeSide = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';
export type TradingSession = 'asia' | 'london' | 'newyork' | 'off';

/**
 * Сделка журнала — round trip позиции от нуля до нуля, собранная
 * рекордером из исполнений биржи (`/journal/trades`). Всё — факты биржи:
 * разбора (стратегия, теги, стоп, риск) API пока не хранит.
 */
export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  side: TradeSide;
  status: TradeStatus;
  /** Позиция открыта до начала записанной истории: вход неизвестен. */
  carriedIn: boolean;
  openedAt: string;
  /** '' — позиция ещё открыта. */
  closedAt: string;
  /** Наибольший объём позиции за сделку, в монетах. */
  quantity: number;
  /** Средняя цена входа; null — вход был до начала истории. */
  entryPrice: number | null;
  /** Средняя цена выхода; null — выходов ещё не было. */
  exitPrice: number | null;
  /** P&L биржи до комиссий и фандинга. */
  realizedPnl: number;
  /** Комиссия в стейблах — уже вычтена из нетто. */
  fees: number;
  /** Комиссия в прочих активах (BNB) — в нетто не входит, пересчитать не по чем. */
  feesOther: Readonly<Record<string, number>>;
  /** Фандинг: плюс — получен, минус — уплачен. Уже учтён в нетто. */
  funding: number;
  /** Итог сделки: realized − комиссия + фандинг. */
  netPnl: number;
  fillsCount: number;
}

export interface TradeFilters {
  symbols?: string[];
  side?: TradeSide;
  status?: TradeStatus;
  search?: string;
}

export const SESSION_LABELS: Record<TradingSession, string> = {
  asia: 'Азия',
  london: 'Лондон',
  newyork: 'Нью-Йорк',
  off: 'Вне сессий',
};

// ─── Расчёты по сделке ──────────────────────────────────────────────────────

/** Чистый результат закрытой сделки (у открытой — 0: итог ещё не известен). */
export function calculatePnl(trade: Trade): number {
  return trade.status === 'closed' ? trade.netPnl : 0;
}

/** Издержки сделки: комиссия минус полученный фандинг (плюс уплаченный). */
export function tradeCosts(trade: Trade): number {
  return trade.fees - trade.funding;
}

/** Движение цены от входа к выходу в % (без плеча); 0, если цены неизвестны. */
export function calculatePnlPercent(trade: Trade): number {
  const { entryPrice, exitPrice } = trade;
  if (trade.status !== 'closed' || !entryPrice || exitPrice === null) return 0;
  const direction = trade.side === 'long' ? 1 : -1;
  return ((exitPrice - entryPrice) / entryPrice) * 100 * direction;
}

/** Нотионал позиции по цене входа (или выхода, если вход до истории). */
export function notional(trade: Trade): number {
  return (trade.entryPrice ?? trade.exitPrice ?? 0) * trade.quantity;
}

/** Комиссии в нестейблах одной строкой: «0.0021 BNB». */
export function formatFeesOther(trade: Trade): string {
  return Object.entries(trade.feesOther)
    .map(([asset, amount]) => `${Number(amount.toPrecision(4))} ${asset}`)
    .join(' + ');
}

/** Торговая сессия по времени открытия (UTC). */
export function tradingSession(openedAt: string): TradingSession {
  const hour = new Date(openedAt).getUTCHours();
  if (hour >= 0 && hour < 7) return 'asia';
  if (hour >= 7 && hour < 12) return 'london';
  if (hour >= 12 && hour < 21) return 'newyork';
  return 'off';
}

export function durationMs(trade: Trade): number {
  const end = trade.status === 'closed' ? new Date(trade.closedAt).getTime() : Date.now();
  return Math.max(0, end - new Date(trade.openedAt).getTime());
}

// ─── Форматирование ─────────────────────────────────────────────────────────

export function priceDecimals(price: number): number {
  const abs = Math.abs(price);
  if (abs >= 1000) return 1;
  if (abs >= 100) return 2;
  if (abs >= 1) return 3;
  if (abs >= 0.01) return 5;
  return 8;
}

export function formatPrice(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: priceDecimals(value),
  });
}

export function formatMoney(value: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 0 : 2;
  const body = abs.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const sign = value < 0 ? '−' : opts.sign && value > 0 ? '+' : '';
  return `${sign}$${body}`;
}

export function formatPercent(value: number, opts: { sign?: boolean } = {}): string {
  const sign = value < 0 ? '−' : opts.sign && value > 0 ? '+' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${d.getFullYear()} ${hh}:${mm}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
  return `${day} ${month} ${d.getFullYear()}`;
}

export function formatDuration(openedAt: string, closedAt: string): string {
  if (!closedAt) return '—';
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${seconds}с`;
  return `${seconds}с`;
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1000).toFixed(0)}K`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}
