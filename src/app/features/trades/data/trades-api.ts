import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, Signal, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OrderType, Trade } from './trade.model';
import { TradeFill } from './trade-chart.model';

/** Сделок на страницу — максимум API (больше клэмпится). */
const PAGE_SIZE = 200;
/** Параллельных страниц: гейтвей пускает ~15 запросов в секунду с IP. */
const PAGE_CONCURRENCY = 3;
/** Комиссия в этих активах входит в нетто (как считает API). */
const STABLES = new Set(['USDT', 'USDC', 'FDUSD', 'BNFCR', 'BUSD']);

interface TradeDto {
  id: number;
  account_id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  status: 'open' | 'closed';
  carried_in: boolean;
  opened_at: string;
  closed_at: string | null;
  max_qty: string;
  avg_entry_price: string | null;
  avg_exit_price: string | null;
  realized_pnl: string;
  commission: Record<string, string> | null;
  commission_quote: string;
  funding: string;
  net_pnl: string;
  fills_count: number;
  /** Нет в доке, но гейтвей отдаёт: MARKET | LIMIT | … (null/пусто — неизвестно). */
  open_order_type?: string | null;
  close_order_type?: string | null;
}

interface FillDto {
  side: 'BUY' | 'SELL';
  price: string;
  qty: string;
  executed_at: string;
}

interface TradeDetailDto extends TradeDto {
  fills: FillDto[] | null;
}

/** Сделка с исполнениями — для графика. */
export interface TradeDetail {
  trade: Trade;
  fills: TradeFill[];
}

/** Журнал сделок (Journal-Service, только чтение). */
@Injectable({ providedIn: 'root' })
export class TradesApi {
  private readonly http = inject(HttpClient);

  /**
   * Вся записанная история (≤ 183 дней) всех счетов пользователя: таблица,
   * виджеты и экспорт считают по ней на клиенте. `key` меняется — список
   * перечитывается (пользователь, набор счетов); null — пусто (нет сессии).
   */
  list(key: Signal<string | null>) {
    return resource({
      params: () => key() ?? undefined,
      loader: () => this.loadAll(),
    });
  }

  async detail(id: string): Promise<TradeDetail> {
    const dto = await firstValueFrom(this.http.get<TradeDetailDto>(`/journal/trades/${id}`));
    return { trade: toTrade(dto), fills: (dto.fills ?? []).map(toFill) };
  }

  private async loadAll(): Promise<Trade[]> {
    const first = await this.page(0);
    const items = [...first.items];
    const offsets: number[] = [];
    for (let offset = PAGE_SIZE; offset < first.total; offset += PAGE_SIZE) offsets.push(offset);
    for (let i = 0; i < offsets.length; i += PAGE_CONCURRENCY) {
      const batch = await Promise.all(offsets.slice(i, i + PAGE_CONCURRENCY).map((o) => this.page(o)));
      for (const page of batch) items.push(...page.items);
    }
    // Новая сделка между страницами сдвигает выдачу — повторы убираем по id.
    const byId = new Map<number, TradeDto>();
    for (const dto of items) byId.set(dto.id, dto);
    return [...byId.values()].map(toTrade);
  }

  private async page(offset: number): Promise<{ items: TradeDto[]; total: number }> {
    const params = new HttpParams()
      .set('status', 'all')
      .set('window', 'all')
      .set('limit', PAGE_SIZE)
      .set('offset', offset);
    const response = await firstValueFrom(
      this.http.get<TradeDto[]>('/journal/trades', { params, observe: 'response' }),
    );
    const items = response.body ?? [];
    const total = Number(response.headers.get('X-Total-Count'));
    return { items, total: Number.isFinite(total) ? total : items.length };
  }
}

function toTrade(dto: TradeDto): Trade {
  const feesOther: Record<string, number> = {};
  for (const [asset, amount] of Object.entries(dto.commission ?? {})) {
    if (!STABLES.has(asset.toUpperCase())) feesOther[asset] = num(amount);
  }
  return {
    id: String(dto.id),
    accountId: dto.account_id,
    symbol: dto.symbol,
    side: dto.direction === 'SHORT' ? 'short' : 'long',
    status: dto.status === 'closed' ? 'closed' : 'open',
    carriedIn: dto.carried_in,
    openedAt: dto.opened_at,
    closedAt: dto.closed_at ?? '',
    quantity: num(dto.max_qty),
    entryPrice: dto.avg_entry_price === null ? null : num(dto.avg_entry_price),
    exitPrice: dto.avg_exit_price === null ? null : num(dto.avg_exit_price),
    realizedPnl: num(dto.realized_pnl),
    fees: num(dto.commission_quote),
    feesOther,
    funding: num(dto.funding),
    netPnl: num(dto.net_pnl),
    fillsCount: dto.fills_count,
    openOrderType: toOrderType(dto.open_order_type),
    closeOrderType: toOrderType(dto.close_order_type),
  };
}

/** LIMIT — мейкерский ордер, всё рыночное (MARKET, STOP_MARKET…) — тейкерский. */
function toOrderType(value: string | null | undefined): OrderType | null {
  if (!value) return null;
  return value.toUpperCase() === 'LIMIT' ? 'limit' : 'market';
}

function toFill(dto: FillDto): TradeFill {
  return {
    time: Date.parse(dto.executed_at),
    side: dto.side === 'SELL' ? 'sell' : 'buy',
    price: num(dto.price),
    qty: num(dto.qty),
  };
}

/** Деньги и количества API — decimal-строки; для показа и графиков хватает double. */
function num(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
