import { Injectable } from '@angular/core';
import {
  Candle,
  CandleQuery,
  CandleStreamHandlers,
  MarketRef,
  TIMEFRAME_MS,
  Timeframe,
  barOpenTime,
} from '../market/market.model';
import type { MarketSource } from '../market/market-source';
import { LISTING_TIME, LiveCandleTracker, marketCandles } from './mock-market';

/** Задержка «сети» у страниц истории. */
const PAGE_DELAY_MS = 220;
/** Как часто «биржа» присылает обновление свечи. */
const TICK_MS = 1000;

/**
 * Мок биржи для графиков, пока сделки моковые: их цены выдуманы и с
 * настоящими свечами не совпали бы. Страницы и поток — из мок-рынка.
 * Удалить вместе с mockApiInterceptor — тогда свечи пойдут с бирж.
 */
@Injectable()
export class MockMarketSource implements MarketSource {
  candles(query: CandleQuery): Promise<Candle[]> {
    const rows = pageOf(query, Date.now());
    return new Promise((resolve) => setTimeout(() => resolve(rows), PAGE_DELAY_MS));
  }

  watch(ref: MarketRef, timeframe: Timeframe, handlers: CandleStreamHandlers): () => void {
    const tracker = new LiveCandleTracker(ref.symbol, timeframe);
    const timer = setInterval(() => handlers.candle(tracker.advance(Date.now())), TICK_MS);
    return () => clearInterval(timer);
  }
}

function pageOf(query: CandleQuery, now: number): Candle[] {
  const step = TIMEFRAME_MS[query.timeframe];
  const listing = barOpenTime(LISTING_TIME, query.timeframe);
  const liveOpen = barOpenTime(now, query.timeframe);
  if (query.before !== undefined) {
    const last = barOpenTime(query.before - 1, query.timeframe);
    if (last < listing) return [];
    const first = Math.max(listing, last - (query.limit - 1) * step);
    return marketCandles(query.symbol, query.timeframe, first, last, now);
  }
  const first = barOpenTime(query.after ?? now, query.timeframe) + step;
  if (first > liveOpen) return [];
  const last = Math.min(liveOpen, first + (query.limit - 1) * step);
  return marketCandles(query.symbol, query.timeframe, first, last, now);
}
