export type TradeSide = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  status: TradeStatus;
  openedAt: string;
  closedAt: string;
  fees: number;
  strategy: string;
  tags: string[];
  notes: string;
}

export type TradeDraft = Omit<Trade, 'id'>;

export interface TradeFilters {
  accountId?: string;
  symbol?: string;
  status?: TradeStatus;
  strategy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TradeStats {
  count: number;
  openCount: number;
  closedCount: number;
  totalPnl: number;
  winRate: number;
  averagePnl: number;
}

export function calculatePnl(trade: Trade): number {
  if (trade.status !== 'closed') {
    return 0;
  }
  const direction = trade.side === 'long' ? 1 : -1;
  return (trade.exitPrice - trade.entryPrice) * trade.quantity * direction - trade.fees;
}

export function calculatePnlPercent(trade: Trade): number {
  if (trade.status !== 'closed' || trade.entryPrice === 0) {
    return 0;
  }
  const direction = trade.side === 'long' ? 1 : -1;
  return ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 * direction;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('ru-RU', { month: 'short' }).replace('.', '');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year} ${hh}:${mm}:${ss}`;
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
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function aggregateStats(trades: readonly Trade[]): TradeStats {
  const closed = trades.filter((t) => t.status === 'closed');
  const open = trades.filter((t) => t.status === 'open');
  const totalPnl = closed.reduce((sum, t) => sum + calculatePnl(t), 0);
  const wins = closed.filter((t) => calculatePnl(t) > 0).length;
  return {
    count: trades.length,
    openCount: open.length,
    closedCount: closed.length,
    totalPnl,
    winRate: closed.length === 0 ? 0 : wins / closed.length,
    averagePnl: closed.length === 0 ? 0 : totalPnl / closed.length,
  };
}
