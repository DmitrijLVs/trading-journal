import { Injectable, computed, inject, signal } from '@angular/core';
import { TradesApi } from './data/trades-api';
import { Trade, TradeFilters, aggregateStats } from './data/trade.model';

@Injectable({ providedIn: 'root' })
export class TradesStore {
  private readonly api = inject(TradesApi);

  private readonly _filters = signal<TradeFilters>({});
  private readonly _selectedId = signal<string | null>(null);

  readonly filters = this._filters.asReadonly();
  readonly selectedId = this._selectedId.asReadonly();

  private readonly resource = this.api.list(this._filters);

  readonly trades = computed<readonly Trade[]>(() => this.resource.value() ?? []);
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;
  readonly hasLoaded = this.resource.hasValue;

  readonly selectedTrade = computed(() => {
    const id = this._selectedId();
    return id === null ? undefined : this.trades().find((t) => t.id === id);
  });

  readonly stats = computed(() => aggregateStats(this.trades()));

  setFilters(filters: TradeFilters): void {
    this._filters.set(filters);
  }

  updateFilters(patch: Partial<TradeFilters>): void {
    this._filters.update((f) => ({ ...f, ...patch }));
  }

  selectTrade(id: string | null): void {
    this._selectedId.set(id);
  }
}
