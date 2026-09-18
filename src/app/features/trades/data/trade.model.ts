export type TradeSide = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';
export type MarketType = 'futures' | 'spot';
export type SetupGrade = 'A+' | 'A' | 'B' | 'C';
export type Mood = 'confident' | 'calm' | 'neutral' | 'anxious' | 'tilt';
export type TradingSession = 'asia' | 'london' | 'newyork' | 'off';

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  market: MarketType;
  side: TradeSide;
  leverage: number;
  quantity: number;
  entryPrice: number;
  /** 0, пока позиция открыта. */
  exitPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  /** Запланированный риск в валюте депозита. */
  riskUsd: number | null;
  status: TradeStatus;
  openedAt: string;
  closedAt: string;
  fees: number;
  funding: number;
  strategy: string;
  timeframe: string;
  setupGrade: SetupGrade | null;
  mood: Mood | null;
  mistakes: string[];
  tags: string[];
  notes: string;
}

export type TradeDraft = Omit<Trade, 'id'>;

export interface TradeFilters {
  accountId?: string;
  symbols?: string[];
  side?: TradeSide;
  status?: TradeStatus;
  strategies?: string[];
  tags?: string[];
  setupGrades?: SetupGrade[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const MOOD_LABELS: Record<Mood, string> = {
  confident: 'Уверенность',
  calm: 'Спокойствие',
  neutral: 'Нейтрально',
  anxious: 'Тревога',
  tilt: 'Тильт',
};

export const MOOD_EMOJI: Record<Mood, string> = {
  confident: '😎',
  calm: '😌',
  neutral: '😐',
  anxious: '😟',
  tilt: '🤬',
};

export const SESSION_LABELS: Record<TradingSession, string> = {
  asia: 'Азия',
  london: 'Лондон',
  newyork: 'Нью-Йорк',
  off: 'Вне сессий',
};

// ─── Расчёты по сделке ──────────────────────────────────────────────────────

/** Валовый P&L без комиссий (0 для открытых). */
export function calculateGrossPnl(trade: Trade): number {
  if (trade.status !== 'closed') return 0;
  const direction = trade.side === 'long' ? 1 : -1;
  return (trade.exitPrice - trade.entryPrice) * trade.quantity * direction;
}

/** Чистый P&L: минус комиссии и фандинг. */
export function calculatePnl(trade: Trade): number {
  if (trade.status !== 'closed') return 0;
  return calculateGrossPnl(trade) - trade.fees - trade.funding;
}

/** Движение цены в % (без плеча). */
export function calculatePnlPercent(trade: Trade): number {
  if (trade.status !== 'closed' || trade.entryPrice === 0) return 0;
  const direction = trade.side === 'long' ? 1 : -1;
  return ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 * direction;
}

/** ROI на маржу: чистый P&L / (нотионал ÷ плечо). */
export function calculateRoi(trade: Trade): number {
  const margin = notional(trade) / Math.max(1, trade.leverage);
  if (trade.status !== 'closed' || margin === 0) return 0;
  return (calculatePnl(trade) / margin) * 100;
}

/** Нотионал позиции по цене входа. */
export function notional(trade: Trade): number {
  return trade.entryPrice * trade.quantity;
}

/** Фактический R: чистый P&L / запланированный риск. */
export function calculateRMultiple(trade: Trade): number | null {
  const risk = plannedRiskUsd(trade);
  if (trade.status !== 'closed' || risk === null || risk <= 0) return null;
  return calculatePnl(trade) / risk;
}

/** Риск в $: явно заданный или расстояние до стопа × объём. */
export function plannedRiskUsd(trade: Trade): number | null {
  if (trade.riskUsd !== null && trade.riskUsd > 0) return trade.riskUsd;
  if (trade.stopLoss === null) return null;
  return Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity;
}

/** Плановое соотношение риск/прибыль по TP и SL. */
export function plannedRiskReward(trade: Trade): number | null {
  if (trade.stopLoss === null || trade.takeProfit === null) return null;
  const risk = Math.abs(trade.entryPrice - trade.stopLoss);
  const reward = Math.abs(trade.takeProfit - trade.entryPrice);
  return risk === 0 ? null : reward / risk;
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

export function formatPrice(value: number): string {
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

export function formatR(value: number | null): string {
  if (value === null) return '—';
  const sign = value < 0 ? '−' : value > 0 ? '+' : '';
  return `${sign}${Math.abs(value).toFixed(2)}R`;
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
