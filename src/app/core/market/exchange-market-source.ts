import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Candle,
  CandleQuery,
  CandleStreamHandlers,
  MarketExchange,
  MarketRef,
  SecondsTimeframe,
  TIMEFRAME_MS,
  Timeframe,
  isSecondsTimeframe,
} from './market.model';
import { ExchangeAdapter, KlinesRequest, exchangeAdapter } from './exchange-adapters';
import { ExchangeSocket } from './exchange-socket';
import type { MarketSource } from './market-source';
import { SecondsBarBuilder, parseSecondsKlines, secondsKlines } from './seconds-klines';

/**
 * Свечи с публичных API бирж: страницы истории через REST, живая свеча —
 * через kline-поток WebSocket (одно соединение на биржу). Секундные бары
 * Binance — с прокси wintrading, живой бар собирается из потока сделок.
 */
@Injectable({ providedIn: 'root' })
export class ExchangeMarketSource implements MarketSource {
  private readonly http = inject(HttpClient);
  private readonly adapters = new Map<MarketExchange, ExchangeAdapter>();
  private readonly sockets = new Map<MarketExchange, ExchangeSocket>();

  async candles(query: CandleQuery): Promise<Candle[]> {
    const timeframe = query.timeframe;
    const rows = isSecondsTimeframe(timeframe)
      ? await this.secondsCandles({ ...query, timeframe })
      : await this.fetch(this.adapterOf(query.exchange).klines({ ...query, timeframe }), (body) =>
          this.adapterOf(query.exchange).parseKlines(body),
        );
    return rows.filter(
      (row) =>
        (query.before === undefined || row[0] < query.before) &&
        (query.after === undefined || row[0] > query.after),
    );
  }

  watch(ref: MarketRef, timeframe: Timeframe, handlers: CandleStreamHandlers): () => void {
    const adapter = this.adapterOf(ref.exchange);
    if (isSecondsTimeframe(timeframe)) {
      if (!adapter.tradeTopic) return () => undefined;
      const builder = new SecondsBarBuilder(TIMEFRAME_MS[timeframe]);
      return this.listen(ref.exchange, adapter.tradeTopic(ref.symbol), {
        candle: (trade) => {
          const bar = builder.add(trade);
          if (bar) handlers.candle(bar);
        },
        resync: () => handlers.resync(),
      });
    }
    return this.listen(ref.exchange, adapter.topic(ref.symbol, timeframe), handlers);
  }

  /** Секунды есть только у Binance; ответ «нет данных» (старше суток) — пустая страница. */
  private async secondsCandles(query: CandleQuery<SecondsTimeframe>): Promise<Candle[]> {
    if (query.exchange !== 'binance') return [];
    try {
      return await this.fetch(secondsKlines(query, Date.now()), parseSecondsKlines);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status >= 400) return [];
      throw error;
    }
  }

  private async fetch(request: KlinesRequest, parse: (body: unknown) => Candle[]): Promise<Candle[]> {
    const body = await firstValueFrom(
      this.http.get<unknown>(request.url, { params: new HttpParams({ fromObject: request.params }) }),
    );
    return parse(body);
  }

  private listen(exchange: MarketExchange, topic: string, handlers: CandleStreamHandlers): () => void {
    const socket = this.socketOf(exchange);
    socket.add(topic, handlers);
    return () => socket.remove(topic, handlers);
  }

  private adapterOf(exchange: MarketExchange): ExchangeAdapter {
    let adapter = this.adapters.get(exchange);
    if (!adapter) {
      adapter = exchangeAdapter(exchange);
      this.adapters.set(exchange, adapter);
    }
    return adapter;
  }

  private socketOf(exchange: MarketExchange): ExchangeSocket {
    let socket = this.sockets.get(exchange);
    if (!socket) {
      socket = new ExchangeSocket(this.adapterOf(exchange));
      this.sockets.set(exchange, socket);
    }
    return socket;
  }
}
