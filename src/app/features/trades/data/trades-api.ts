import { httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';
import { Trade, TradeFilters } from './trade.model';

@Injectable({ providedIn: 'root' })
export class TradesApi {
  private readonly baseUrl = '/api/trades';

  list(filters: Signal<TradeFilters>) {
    return httpResource<Trade[]>(() => ({
      url: this.baseUrl,
      params: toQueryParams(filters()),
    }));
  }
}

function toQueryParams(f: TradeFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.accountId) params['accountId'] = f.accountId;
  if (f.symbol) params['symbol'] = f.symbol;
  if (f.status) params['status'] = f.status;
  if (f.strategy) params['strategy'] = f.strategy;
  if (f.dateFrom) params['dateFrom'] = f.dateFrom;
  if (f.dateTo) params['dateTo'] = f.dateTo;
  return params;
}
