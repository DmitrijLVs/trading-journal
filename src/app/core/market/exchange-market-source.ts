import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Candle, CandleQuery, CandleStreamHandlers, MarketExchange, MarketRef, Timeframe } from './market.model';
import { ExchangeAdapter, exchangeAdapter } from './exchange-adapters';
import { ExchangeSocket } from './exchange-socket';
import type { MarketSource } from './market-source';

/**
 * Свечи с публичных API бирж: страницы истории через REST, живая свеча —
 * через kline-поток WebSocket (одно соединение на биржу).
 */
@Injectable({ providedIn: 'root' })
export class ExchangeMarketSource implements MarketSource {
  private readonly http = inject(HttpClient);
  private readonly adapters = new Map<MarketExchange, ExchangeAdapter>();
  private readonly sockets = new Map<MarketExchange, ExchangeSocket>();

  async candles(query: CandleQuery): Promise<Candle[]> {
    const adapter = this.adapterOf(query.exchange);
    const request = adapter.klines(query);
    const body = await firstValueFrom(
      this.http.get<unknown>(request.url, { params: new HttpParams({ fromObject: request.params }) }),
    );
    return adapter
      .parseKlines(body)
      .filter(
        (row) =>
          (query.before === undefined || row[0] < query.before) &&
          (query.after === undefined || row[0] > query.after),
      );
  }

  watch(ref: MarketRef, timeframe: Timeframe, handlers: CandleStreamHandlers): () => void {
    const topic = this.adapterOf(ref.exchange).topic(ref.symbol, timeframe);
    const socket = this.socketOf(ref.exchange);
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
