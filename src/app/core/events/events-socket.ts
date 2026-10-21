import { Injectable, effect, inject } from '@angular/core';
import { AuthStore } from '../auth/auth-store';

/** Событие журнала пользователя (`/ws/events`): `fill`, `trade`, `sync`. */
export interface JournalEvent {
  type: string;
  accountId: string | null;
  symbol: string | null;
  data: Readonly<Record<string, unknown>>;
}

const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** Закрытие от гейтвея: доступ отозван или токен протух — сначала refresh. */
const CLOSE_UNAUTHORIZED = 4401;

/**
 * Живые события журнала. Сервер шлёт всё сам (клиент ничего не отправляет),
 * пропущенное за разрыв не повторяет — поэтому после переподключения
 * подписчики получают `resync` и перечитывают данные из REST.
 */
@Injectable({ providedIn: 'root' })
export class EventsSocket {
  private readonly auth = inject(AuthStore);

  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = BACKOFF_START_MS;
  private wanted = false;
  private everOpened = false;
  private readonly listeners = new Set<(event: JournalEvent) => void>();
  private readonly resyncListeners = new Set<() => void>();

  constructor() {
    // Выход из аккаунта — соединение больше не нужно.
    effect(() => {
      if (!this.auth.isAuthenticated()) this.disconnect();
    });
  }

  /** Открыть соединение (идемпотентно); держится, пока есть сессия. */
  connect(): void {
    this.wanted = true;
    this.open();
  }

  disconnect(): void {
    this.wanted = false;
    this.everOpened = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  on(listener: (event: JournalEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onResync(listener: () => void): () => void {
    this.resyncListeners.add(listener);
    return () => this.resyncListeners.delete(listener);
  }

  private open(): void {
    if (!this.wanted || this.socket || this.retryTimer || !this.auth.isAuthenticated()) return;
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${scheme}://${location.host}/ws/events`);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.backoff = BACKOFF_START_MS;
      if (this.everOpened) for (const listener of [...this.resyncListeners]) listener();
      this.everOpened = true;
    };
    socket.onmessage = (message) => this.dispatch(message.data);
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (event.code === CLOSE_UNAUTHORIZED) {
        // Новая пара токенов — и снова в сокет; не вышло — сессия закончилась.
        void this.auth.refresh().then((ok) => ok && this.scheduleRetry());
        return;
      }
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    if (!this.wanted || this.retryTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  /** Парсим терпимо: неизвестные типы и поля игнорируются. */
  private dispatch(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope['type'] !== 'string') return;
    const event: JournalEvent = {
      type: envelope['type'],
      accountId: typeof envelope['account_id'] === 'string' ? envelope['account_id'] : null,
      symbol: typeof envelope['symbol'] === 'string' ? envelope['symbol'] : null,
      data:
        envelope['data'] && typeof envelope['data'] === 'object'
          ? (envelope['data'] as Record<string, unknown>)
          : {},
    };
    for (const listener of [...this.listeners]) listener(event);
  }
}
