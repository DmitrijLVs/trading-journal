import { Injectable, inject } from '@angular/core';
import { MARKET_SOURCE } from '../../../core/market/market-source';
import {
  MarketExchange,
  TIMEFRAME_MS,
  Timeframe,
  barOpenTime,
} from '../../../core/market/market.model';
import { candleDecimals } from '../../../shared/nv-chart/nv-candles';
import { TradeChartData, TradeFill } from './trade-chart.model';
import { Trade } from './trade.model';
import { TradesApi } from './trades-api';

/** Свечей истории до входа в первом окне — дальше подгружается при прокрутке. */
const HISTORY_BARS = 300;
/** Первое окно — одна страница Binance (1500 свечей). */
const INITIAL_BARS = 1500;

/**
 * Первое окно графика сделки: исполнения — из журнала платформы, свечи —
 * с публичного API биржи (в API платформы рыночных данных нет).
 */
@Injectable({ providedIn: 'root' })
export class TradeChartLoader {
  private readonly api = inject(TradesApi);
  private readonly market = inject(MARKET_SOURCE);
  /** Исполнения закрытой сделки не меняются — не перезапрашиваем на смену таймфрейма. */
  private readonly closedFills = new Map<string, Promise<TradeFill[]>>();

  async load(trade: Trade, timeframe: Timeframe, exchange: MarketExchange): Promise<TradeChartData> {
    const step = TIMEFRAME_MS[timeframe];
    const first = barOpenTime(Date.parse(trade.openedAt), timeframe) - HISTORY_BARS * step;
    const [fills, candles] = await Promise.all([
      this.fillsOf(trade),
      this.market.candles({
        exchange,
        symbol: trade.symbol,
        timeframe,
        after: first - 1,
        limit: INITIAL_BARS,
      }),
    ]);
    return { timeframe, priceDecimals: candleDecimals(candles), candles, fills };
  }

  private fillsOf(trade: Trade): Promise<TradeFill[]> {
    if (trade.status !== 'closed') return this.fetchFills(trade.id);
    let fills = this.closedFills.get(trade.id);
    if (!fills) {
      fills = this.fetchFills(trade.id);
      this.closedFills.set(trade.id, fills);
      fills.catch(() => this.closedFills.delete(trade.id));
    }
    return fills;
  }

  /** Без исполнений график всё равно покажем — по средним ценам сделки. */
  private fetchFills(id: string): Promise<TradeFill[]> {
    return this.api.detail(id).then(
      (detail) => detail.fills,
      () => [],
    );
  }
}
