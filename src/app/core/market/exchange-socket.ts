import { CandleStreamHandlers } from './market.model';
import { ExchangeAdapter } from './exchange-adapters';

const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** Проверка здоровья: пинг приложения и поиск «тихого» соединения. */
const HEALTH_MS = 15_000;
/** Kline-потоки шлют обновления чаще раза в секунду — тишина значит обрыв. */
const SILENCE_MS = 40_000;
/** Binance рвёт соединение через 24 ч — переподключаемся заранее. */
const MAX_LIFETIME_MS = 23 * 3_600_000;
/** Сокет без подписок закрывается не сразу: смена таймфрейма не рвёт соединение. */
const IDLE_CLOSE_MS = 5_000;

/**
 * Одно WebSocket-соединение с биржей на все kline-топики: подписки по
 * счётчику слушателей, переподключение с бэкоффом, после переподключения —
 * `resync()` слушателям (пропущенное за разрыв они догружают через REST).
 */
export class ExchangeSocket {
  private socket: WebSocket | null = null;
  private readonly topics = new Map<string, Set<CandleStreamHandlers>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private backoff = BACKOFF_START_MS;
  private openedAt = 0;
  private lastMessageAt = 0;
  private everOpened = false;

  constructor(private readonly adapter: ExchangeAdapter) {}

  add(topic: string, handlers: CandleStreamHandlers): void {
    this.cancelIdleClose();
    let listeners = this.topics.get(topic);
    if (!listeners) {
      listeners = new Set();
      this.topics.set(topic, listeners);
      if (this.socket?.readyState === WebSocket.OPEN) this.send(this.adapter.subscribe([topic]));
    }
    listeners.add(handlers);
    this.ensureOpen();
  }

  remove(topic: string, handlers: CandleStreamHandlers): void {
    const listeners = this.topics.get(topic);
    if (!listeners?.delete(handlers) || listeners.size > 0) return;
    this.topics.delete(topic);
    if (this.socket?.readyState === WebSocket.OPEN) this.send(this.adapter.unsubscribe([topic]));
    if (this.topics.size === 0) this.scheduleIdleClose();
  }

  private ensureOpen(): void {
    if (this.socket || this.reconnectTimer || this.topics.size === 0) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.adapter.streamUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => this.opened(socket);
    socket.onmessage = (event) => this.received(event);
    socket.onerror = () => socket.close();
    socket.onclose = () => this.closed(socket);
  }

  private opened(socket: WebSocket): void {
    if (this.socket !== socket) return;
    const resync = this.everOpened;
    this.everOpened = true;
    this.backoff = BACKOFF_START_MS;
    this.openedAt = this.lastMessageAt = Date.now();
    if (this.topics.size > 0) this.send(this.adapter.subscribe([...this.topics.keys()]));
    this.healthTimer = setInterval(() => this.checkHealth(), HEALTH_MS);
    if (resync) this.forEachListener((handlers) => handlers.resync());
  }

  private received(event: MessageEvent): void {
    this.lastMessageAt = Date.now();
    if (typeof event.data !== 'string') return;
    for (const tick of this.adapter.parseStream(event.data)) {
      const listeners = this.topics.get(tick.topic);
      if (!listeners) continue;
      for (const handlers of [...listeners]) handlers.candle(tick.candle);
    }
  }

  private closed(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.stopHealth();
    if (this.topics.size > 0) this.scheduleReconnect();
  }

  private checkHealth(): void {
    const socket = this.socket;
    if (!socket) return;
    const now = Date.now();
    if (now - this.lastMessageAt > SILENCE_MS || now - this.openedAt > MAX_LIFETIME_MS) {
      socket.close();
      return;
    }
    if (this.adapter.ping) this.send(this.adapter.ping);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureOpen();
    }, delay);
  }

  private scheduleIdleClose(): void {
    this.cancelIdleClose();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.topics.size > 0) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      const socket = this.socket;
      this.socket = null;
      this.stopHealth();
      socket?.close();
    }, IDLE_CLOSE_MS);
  }

  private cancelIdleClose(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private stopHealth(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  private send(message: string): void {
    try {
      this.socket?.send(message);
    } catch {
      // сокет закрывается — подписки уйдут заново после переподключения
    }
  }

  private forEachListener(fn: (handlers: CandleStreamHandlers) => void): void {
    for (const listeners of this.topics.values()) for (const handlers of [...listeners]) fn(handlers);
  }
}
