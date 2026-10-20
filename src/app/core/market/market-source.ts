import { InjectionToken, inject } from '@angular/core';
import { Candle, CandleQuery, CandleStreamHandlers, MarketRef, Timeframe } from './market.model';
import { ExchangeMarketSource } from './exchange-market-source';

/** Откуда графики берут свечи: история страницами и живой поток. */
export interface MarketSource {
  /** Свечи по возрастанию времени; пустой массив — дальше истории нет. */
  candles(query: CandleQuery): Promise<Candle[]>;
  /** Живые обновления последней свечи; возвращает отписку. */
  watch(ref: MarketRef, timeframe: Timeframe, handlers: CandleStreamHandlers): () => void;
}

/** По умолчанию — публичные API бирж; в мок-режиме подменяется в app.config. */
export const MARKET_SOURCE = new InjectionToken<MarketSource>('MARKET_SOURCE', {
  providedIn: 'root',
  factory: () => inject(ExchangeMarketSource),
});
