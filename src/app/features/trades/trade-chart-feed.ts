import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { MARKET_SOURCE } from '../../core/market/market-source';
import {
  Candle,
  MarketRef,
  TIMEFRAME_MS,
  Timeframe,
  isDenseTimeframe,
  isLiveCandle,
} from '../../core/market/market.model';
import { CandleSink } from '../../shared/nv-chart/nv-chart.types';

/** Свечей в странице истории. */
const HISTORY_PAGE = 1000;
/** Свечей в странице догрузки вперёд (к текущей свече). */
const FORWARD_PAGE = 1500;

/**
 * Лента свечей одного графика: подгрузка истории при прокрутке влево,
 * догрузка вперёд до текущей свечи и живые обновления из потока биржи,
 * пока график открыт. Живёт вместе с компонентом графика.
 */
@Injectable()
export class TradeChartFeed {
  private readonly source = inject(MARKET_SOURCE);

  private readonly liveState = signal(false);
  private readonly busyState = signal(false);
  private readonly historyEndState = signal(false);

  /** Последняя свеча — текущая, график обновляется потоком. */
  readonly live = this.liveState.asReadonly();
  /** Идёт подгрузка страницы. */
  readonly loading = this.busyState.asReadonly();
  /** Дальше в прошлое истории у биржи нет. */
  readonly historyEnd = this.historyEndState.asReadonly();

  private sink: CandleSink | null = null;
  private ref: MarketRef | null = null;
  private timeframe: Timeframe = '15m';
  private firstTime = 0;
  private lastTime = 0;
  /**
   * До какого момента данные уже запрошены. У секундных баров (они редкие)
   * не совпадает с последней свечой: окно без сделок тоже пройдено.
   */
  private fetchedUntil = 0;
  private historyBusy = false;
  private forwardBusy = false;
  private generation = 0;
  private unwatch: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Новая лента: свечи первого окна уже на графике. */
  start(sink: CandleSink, ref: MarketRef, timeframe: Timeframe, candles: readonly Candle[]): void {
    this.stop();
    if (candles.length === 0) return;
    this.sink = sink;
    this.ref = ref;
    this.timeframe = timeframe;
    this.firstTime = candles[0][0];
    this.lastTime = this.fetchedUntil = candles[candles.length - 1][0];
    this.historyEndState.set(false);
    if (isDenseTimeframe(timeframe)) {
      if (isLiveCandle(this.lastTime, timeframe, Date.now())) this.goLive();
    } else if (Date.now() - this.lastTime < this.forwardSpan()) {
      // Свежая сделка на секундах: одна страница вперёд — и график на потоке.
      this.fetchForward();
    }
  }

  stop(): void {
    this.generation += 1;
    this.unwatch?.();
    this.unwatch = null;
    this.sink = null;
    this.ref = null;
    this.historyBusy = false;
    this.forwardBusy = false;
    this.liveState.set(false);
    this.busyState.set(false);
  }

  loadHistory(): void {
    const ref = this.ref;
    if (!ref || this.historyBusy || this.historyEndState()) return;
    const generation = this.generation;
    this.historyBusy = true;
    this.syncBusy();
    this.source
      .candles({ ...ref, timeframe: this.timeframe, before: this.firstTime, limit: HISTORY_PAGE })
      .then((rows) => {
        if (generation !== this.generation) return;
        const older = rows.filter((row) => row[0] < this.firstTime);
        if (older.length === 0) {
          this.historyEndState.set(true);
          return;
        }
        this.sink?.prepend(older);
        this.firstTime = older[0][0];
      })
      // Ошибка сети: движок спросит историю снова, когда вид опять дойдёт до края.
      .catch(() => undefined)
      .finally(() => {
        if (generation !== this.generation) return;
        this.historyBusy = false;
        this.syncBusy();
      });
  }

  loadForward(): void {
    if (!this.liveState()) this.fetchForward();
  }

  /** Свечи после последней загруженной — до текущей включительно. */
  private fetchForward(): void {
    const ref = this.ref;
    if (!ref || this.forwardBusy) return;
    const generation = this.generation;
    const dense = isDenseTimeframe(this.timeframe);
    const after = dense ? this.lastTime : Math.max(this.lastTime, this.fetchedUntil);
    const until = after + this.forwardSpan();
    this.forwardBusy = true;
    this.syncBusy();
    this.source
      .candles({ ...ref, timeframe: this.timeframe, after, limit: FORWARD_PAGE })
      .then((rows) => {
        if (generation !== this.generation) return;
        const newer = rows.filter((row) => row[0] > this.lastTime);
        if (newer.length > 0) {
          this.sink?.append(newer);
          this.lastTime = newer[newer.length - 1][0];
        }
        const now = Date.now();
        if (!dense) this.fetchedUntil = Math.max(this.lastTime, Math.min(until, now));
        const present = dense ? isLiveCandle(this.lastTime, this.timeframe, now) : until >= now;
        if (!this.liveState() && present) this.goLive();
      })
      .catch(() => undefined)
      .finally(() => {
        if (generation !== this.generation) return;
        this.forwardBusy = false;
        this.syncBusy();
      });
  }

  private goLive(): void {
    const ref = this.ref;
    if (!ref || this.unwatch) return;
    this.liveState.set(true);
    this.unwatch = this.source.watch(ref, this.timeframe, {
      candle: (candle) => this.applyLive(candle),
      // Разрыв потока: всё, что пропущено, — одной страницей вперёд.
      resync: () => this.fetchForward(),
    });
  }

  private applyLive(candle: Candle): void {
    if (candle[0] < this.lastTime || this.forwardBusy) return;
    const dense = isDenseTimeframe(this.timeframe);
    if (dense && candle[0] > this.lastTime + TIMEFRAME_MS[this.timeframe]) {
      // Пропущены свечи (вкладка спала, поток отставал) — догружаем их.
      this.fetchForward();
      return;
    }
    this.sink?.update(candle);
    this.lastTime = candle[0];
  }

  /** Сколько времени покрывает страница догрузки вперёд. */
  private forwardSpan(): number {
    return FORWARD_PAGE * TIMEFRAME_MS[this.timeframe];
  }

  private syncBusy(): void {
    this.busyState.set(this.historyBusy || this.forwardBusy);
  }
}
