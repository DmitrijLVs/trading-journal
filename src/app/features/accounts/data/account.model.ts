import { MarketType } from '../../trades/data/trade.model';

export type ExchangeId = 'binance' | 'bybit' | 'okx' | 'bitget' | 'manual';

export interface Account {
  id: string;
  name: string;
  exchange: ExchangeId;
  market: MarketType;
  currency: string;
  startBalance: number;
  createdAt: string;
  /** Маскированный API-ключ — полный ключ на клиенте не хранится. */
  apiKeyMasked: string;
  syncEnabled: boolean;
  lastSyncAt: string;
}

export interface AccountDraft {
  name: string;
  exchange: ExchangeId;
  market: MarketType;
  apiKey: string;
  apiSecret: string;
  startBalance: number;
}

export interface ExchangeMeta {
  id: ExchangeId;
  label: string;
  /** Буква-монограмма для аватара биржи. */
  mark: string;
  /** Фирменный цвет для аватара. */
  color: string;
}

export const EXCHANGES: readonly ExchangeMeta[] = [
  { id: 'binance', label: 'Binance', mark: 'B', color: '#f3ba2f' },
  { id: 'bybit', label: 'Bybit', mark: 'Y', color: '#f7a600' },
  { id: 'okx', label: 'OKX', mark: 'O', color: '#8c8c8c' },
  { id: 'bitget', label: 'Bitget', mark: 'G', color: '#00f0ff' },
  { id: 'manual', label: 'Вручную', mark: 'M', color: '#0a84ff' },
];

export function exchangeMeta(id: ExchangeId): ExchangeMeta {
  return EXCHANGES.find((e) => e.id === id) ?? EXCHANGES[EXCHANGES.length - 1];
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}
