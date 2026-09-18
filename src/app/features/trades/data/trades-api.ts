import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Trade } from './trade.model';
import { TradeChartData } from '../../../core/mock/mock-candles';

@Injectable({ providedIn: 'root' })
export class TradesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/trades';

  /** Все сделки; фильтрация — на клиенте в сторе (мок-режим). */
  list() {
    return httpResource<Trade[]>(() => this.baseUrl);
  }

  /** Свечи вокруг сделки для графика на выбранном таймфрейме. */
  candles(tradeId: Signal<string | null>, timeframe: Signal<string>) {
    return httpResource<TradeChartData>(() => {
      const id = tradeId();
      return id ? `${this.baseUrl}/${id}/candles?tf=${timeframe()}` : undefined;
    });
  }

  update(id: string, patch: Partial<Trade>): Promise<Trade> {
    return firstValueFrom(this.http.put<Trade>(`${this.baseUrl}/${id}`, patch));
  }

  delete(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }
}
