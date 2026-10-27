export type TradeSide = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';
/** Тип ордера, открывшего или закрывшего сделку: маркет платит тейкера, лимит — мейкера. */
export type OrderType = 'market' | 'limit';
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
  /** Ордер первого входа; null — биржа не сообщила (история до записи). */
  openOrderType: OrderType | null;
  /** Ордер последнего выхода; null — сделка открыта или тип неизвестен. */
  closeOrderType: OrderType | null;
}

export interface TradeFilters {
  symbols?: string[];
  side?: TradeSide;
  status?: TradeStatus;
  search?: string;
  /** Автотег разбора (`AutoTag`): реванш, тильт, овертрейд… */
  tag?: string;
}

export const SESSION_LABELS: Record<TradingSession, string> = {
  asia: 'Азия',
  london: 'Лондон',
  newyork: 'Нью-Йорк',
  off: 'Вне сессий',
};

// ─── Расчёты по сделке ──────────────────────────────────────────────────────

/**
 * Сделка «в ноль» — |нетто| не больше полуцента. Как в Stats-Service: вин —
 * нетто > 0, лосс — < 0. Порог в $1 ломал статистику мелких счетов: при
 * позиции $50 почти все сделки попадали «в ноль».
 */
export const BREAKEVEN_EPS = 0.005;

export function isWin(pnl: number): boolean {
  return pnl > BREAKEVEN_EPS;
}

export function isLoss(pnl: number): boolean {
  return pnl < -BREAKEVEN_EPS;
}

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

// ─── Скрытые суммы ──────────────────────────────────────────────────────────

/**
 * Режим «скрыть суммы» (показ экрана, стрим, скриншот): деньги и объёмы
 * заменяются точками, знак и цвет остаются. Флаг читает PrivacyStore —
 * через этот хук домен остаётся без Angular, а computed/шаблоны, которые
 * форматируют деньги, сами подписываются на сигнал режима.
 */
let moneyHidden: () => boolean = () => false;

export const MONEY_MASK = '•••';

export function configureMoneyMask(read: () => boolean): void {
  moneyHidden = read;
}

export function isMoneyHidden(): boolean {
  return moneyHidden();
}

export function formatMoney(value: number, opts: { sign?: boolean } = {}): string {
  if (moneyHidden()) {
    const masked = value < 0 ? '−' : opts.sign && value > 0 ? '+' : '';
    return `${masked}$${MONEY_MASK}`;
  }
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
  return `${sign}${decimal(Math.abs(value), 2)}%`;
}

/** Число с запятой: десятичный разделитель — как у денег (ru-RU). */
export function decimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

/** Объём в монетах: разряды пробелом, дробная часть через запятую. Выдаёт размер — прячется вместе с деньгами. */
export function formatQuantity(value: number): string {
  if (moneyHidden()) return MONEY_MASK;
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 8 });
}

/** Короткие месяцы в родительном падеже: «24 июн», «3 мая». */
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** День месяца и месяц; год — только если он не текущий. */
function dayMonth(d: Date, withYear: boolean): string {
  const base = `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]}`;
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dayMonth(d, false)} ${hh}:${mm}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return dayMonth(new Date(iso), true);
}

/** Календарный день в зоне пользователя: YYYY-MM-DD. */
export function localDay(time: string | number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Длительность в мс одной-двумя единицами: «2ч 14м», «45с». */
export function formatSpan(ms: number): string {
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

export function formatDuration(openedAt: string, closedAt: string): string {
  if (!closedAt) return '—';
  return formatSpan(new Date(closedAt).getTime() - new Date(openedAt).getTime());
}

/** Компактно для осей и плиток: «−1,2K», «146K», «38». Меньше 10 — с десятыми. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 && abs >= 0.05 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${decimal(abs / 1_000_000, 1)}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1000).toFixed(0)}K`;
  if (abs >= 1000) return `${sign}${decimal(abs / 1000, 1)}K`;
  if (abs >= 10) return `${sign}${abs.toFixed(0)}`;
  if (abs < 0.05) return '0';
  return `${sign}${decimal(abs, 1).replace(/,0$/, '')}`;
}

/** Компактные деньги: «+$1,2K», «−$38». В режиме скрытых сумм — «+$•••». */
export function formatMoneyCompact(value: number, opts: { sign?: boolean } = {}): string {
  const body = formatCompact(Math.abs(value));
  if (body === '0') return moneyHidden() ? `$${MONEY_MASK}` : '$0';
  const sign = value < 0 ? '−' : opts.sign ? '+' : '';
  return `${sign}$${moneyHidden() ? MONEY_MASK : body}`;
}

/** Подпись денежной оси: при скрытых суммах ось без подписей (только сетка). */
export function formatMoneyAxis(value: number): string {
  return moneyHidden() ? '' : formatMoneyCompact(value);
}
