/** Биржи для подключения. Записывается пока только Binance USDⓈ-M Futures. */
export type ExchangeId = 'binance' | 'bybit' | 'okx';

/** Состояние записи журнала по счёту (`GET /journal/accounts`). */
export type SyncStatus = 'pending' | 'importing' | 'live' | 'reconnecting' | 'key_rejected' | 'error';

/** Подключённый биржевой аккаунт: ключ (Exchange-Service) + состояние записи (Journal-Service). */
export interface Account {
  id: string;
  exchange: ExchangeId;
  label: string;
  createdAt: string;
  status: SyncStatus;
  /** Начало записанной истории. */
  historyFrom: string | null;
  /** Первый импорт закончен; null — ещё идёт. */
  importedAt: string | null;
  lastFillAt: string | null;
  lastError: string;
  openPositions: number;
}

export interface AccountDraft {
  label: string;
  apiKey: string;
  apiSecret: string;
}

export interface ExchangeAccountDto {
  id: string;
  exchange: string;
  label: string;
  created_at: string;
}

export interface JournalAccountDto {
  id: string;
  status: SyncStatus;
  history_from: string | null;
  imported_at: string | null;
  last_fill_at: string | null;
  last_error: string | null;
  open_positions: number | null;
}

export interface ExchangeMeta {
  id: ExchangeId;
  label: string;
  /** Что именно записываем. */
  market: string;
  /** Буква-монограмма для аватара биржи. */
  mark: string;
  color: string;
  /** false — показываем с пометкой «скоро». */
  available: boolean;
}

export const EXCHANGES: readonly ExchangeMeta[] = [
  { id: 'binance', label: 'Binance', market: 'USDⓈ-M Futures', mark: 'B', color: '#f3ba2f', available: true },
  { id: 'bybit', label: 'Bybit', market: 'Фьючерсы', mark: 'Y', color: '#f7a600', available: false },
  { id: 'okx', label: 'OKX', market: 'Фьючерсы', mark: 'O', color: '#8c8c8c', available: false },
];

export function exchangeMeta(id: ExchangeId): ExchangeMeta {
  return EXCHANGES.find((e) => e.id === id) ?? EXCHANGES[0];
}

export interface SyncStatusMeta {
  label: string;
  tone: 'ok' | 'progress' | 'warn' | 'danger';
  hint: string;
}

export const SYNC_STATUS: Readonly<Record<SyncStatus, SyncStatusMeta>> = {
  pending: {
    label: 'Ожидает',
    tone: 'progress',
    hint: 'Ключ принят, запись скоро начнётся',
  },
  importing: {
    label: 'Импорт истории',
    tone: 'progress',
    hint: 'Загружаем сделки за последние ~3 месяца — это займёт несколько минут',
  },
  live: {
    label: 'Подключён',
    tone: 'ok',
    hint: 'Новые сделки появляются в реальном времени',
  },
  reconnecting: {
    label: 'Переподключение',
    tone: 'warn',
    hint: 'Связь с биржей восстанавливается, пропущенное догрузим сами',
  },
  key_rejected: {
    label: 'Ключ отклонён',
    tone: 'danger',
    hint: 'Биржа не принимает ключ — удалите счёт и подключите новый ключ',
  },
  error: {
    label: 'Ошибка записи',
    tone: 'danger',
    hint: 'Повторим автоматически',
  },
};

export function toAccount(dto: ExchangeAccountDto, journal: JournalAccountDto | undefined): Account {
  return {
    id: dto.id,
    exchange: toExchangeId(dto.exchange),
    label: dto.label,
    createdAt: dto.created_at,
    status: journal?.status ?? 'pending',
    historyFrom: journal?.history_from ?? null,
    importedAt: journal?.imported_at ?? null,
    lastFillAt: journal?.last_fill_at ?? null,
    lastError: journal?.last_error ?? '',
    openPositions: journal?.open_positions ?? 0,
  };
}

function toExchangeId(exchange: string): ExchangeId {
  const id = exchange.toLowerCase();
  return id === 'bybit' || id === 'okx' ? id : 'binance';
}
