import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TradesStore } from './trades-store';
import {
  Trade,
  TradeSide,
  TradeStatus,
  calculatePnl,
  calculatePnlPercent,
  calculateRMultiple,
  durationMs,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPrice,
  notional,
} from './data/trade.model';
import { summarize } from '../analytics/data/metrics';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Select, SelectOption } from '../../shared/ui/select';
import { PnlValue } from '../../shared/ui/pnl-value';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';

type SortKey = 'openedAt' | 'symbol' | 'notional' | 'pnl' | 'pnlPct' | 'r' | 'duration';

interface TradeRow {
  trade: Trade;
  pnl: number;
  pnlPct: number;
  r: number | null;
  notional: number;
}

const PAGE_SIZE = 50;

@Component({
  selector: 'app-trade-list',
  imports: [Icon, Button, Select, PnlValue, EmptyState, Skeleton],
  templateUrl: './trade-list.html',
  styleUrl: './trade-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeList {
  protected readonly store = inject(TradesStore);
  private readonly router = inject(Router);

  protected readonly sortKey = signal<SortKey>('openedAt');
  protected readonly sortDir = signal<1 | -1>(-1);
  protected readonly visibleCount = signal(PAGE_SIZE);

  protected readonly sideOptions: SelectOption[] = [
    { value: 'long', label: 'Лонг' },
    { value: 'short', label: 'Шорт' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: 'closed', label: 'Закрытые' },
    { value: 'open', label: 'Открытые' },
  ];

  protected readonly gradeOptions: SelectOption[] = ['A+', 'A', 'B', 'C'].map((g) => ({
    value: g,
    label: `Сетап ${g}`,
  }));

  protected readonly symbolOptions = computed<SelectOption[]>(() =>
    this.store.symbols().map((s) => ({ value: s, label: s })),
  );

  protected readonly strategyOptions = computed<SelectOption[]>(() =>
    this.store.strategies().map((s) => ({ value: s, label: s })),
  );

  protected readonly tagOptions = computed<SelectOption[]>(() =>
    this.store.tags().map((t) => ({ value: t, label: t })),
  );

  private readonly rows = computed<TradeRow[]>(() =>
    this.store.tableTrades().map((trade) => ({
      trade,
      pnl: calculatePnl(trade),
      pnlPct: calculatePnlPercent(trade),
      r: calculateRMultiple(trade),
      notional: notional(trade),
    })),
  );

  protected readonly sortedRows = computed<TradeRow[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...this.rows()].sort((a, b) => compareRows(a, b, key) * dir);
  });

  protected readonly visibleRows = computed(() => this.sortedRows().slice(0, this.visibleCount()));
  protected readonly hasMore = computed(() => this.sortedRows().length > this.visibleCount());

  protected readonly summary = computed(() => summarize(this.store.tableTrades()));

  // ── Сортировка ────────────────────────────────────────────────────────────

  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 1 ? -1 : 1));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(-1);
    }
  }

  protected sortArrow(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === -1 ? '▼' : '▲';
  }

  // ── Фильтры ───────────────────────────────────────────────────────────────

  protected setSearch(value: string): void {
    this.store.updateTableFilters({ search: value });
    this.visibleCount.set(PAGE_SIZE);
  }

  protected setSide(value: string | null): void {
    this.store.updateTableFilters({ side: (value as TradeSide) ?? undefined });
  }

  protected setStatus(value: string | null): void {
    this.store.updateTableFilters({ status: (value as TradeStatus) ?? undefined });
  }

  protected setSymbols(values: string[]): void {
    this.store.updateTableFilters({ symbols: values.length ? values : undefined });
  }

  protected setStrategies(values: string[]): void {
    this.store.updateTableFilters({ strategies: values.length ? values : undefined });
  }

  protected setTags(values: string[]): void {
    this.store.updateTableFilters({ tags: values.length ? values : undefined });
  }

  protected setGrades(values: string[]): void {
    this.store.updateTableFilters({
      setupGrades: values.length ? (values as Trade['setupGrade'][] as never) : undefined,
    });
  }

  protected reset(): void {
    this.store.resetTableFilters();
    this.visibleCount.set(PAGE_SIZE);
  }

  // ── Навигация / действия ──────────────────────────────────────────────────

  protected openTrade(trade: Trade): void {
    this.router.navigate(['/trades', trade.id]);
  }

  protected showMore(): void {
    this.visibleCount.update((v) => v + PAGE_SIZE);
  }

  // ── Форматирование ────────────────────────────────────────────────────────

  protected readonly fmtDateTime = formatDateTime;
  protected readonly fmtPrice = formatPrice;

  protected fmtNotional(value: number): string {
    return formatMoney(value);
  }

  protected fmtDuration(trade: Trade): string {
    return trade.status === 'closed' ? formatDuration(trade.openedAt, trade.closedAt) : 'открыта';
  }

  protected fmtMoney(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }
}

function compareRows(a: TradeRow, b: TradeRow, key: SortKey): number {
  switch (key) {
    case 'openedAt':
      return a.trade.openedAt.localeCompare(b.trade.openedAt);
    case 'symbol':
      return a.trade.symbol.localeCompare(b.trade.symbol);
    case 'notional':
      return a.notional - b.notional;
    case 'pnl':
      return a.pnl - b.pnl;
    case 'pnlPct':
      return a.pnlPct - b.pnlPct;
    case 'r':
      return (a.r ?? -Infinity) - (b.r ?? -Infinity);
    case 'duration':
      return durationMs(a.trade) - durationMs(b.trade);
  }
}
