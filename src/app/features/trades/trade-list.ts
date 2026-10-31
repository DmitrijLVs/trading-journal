import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TradesStore } from './trades-store';
import { AccountsStore } from '../accounts/accounts-store';
import { TradeExpand } from './trade-expand';
import { TradeNav, TradeRow } from './trade-nav';
import {
  Trade,
  TradeSide,
  TradeStatus,
  calculatePnl,
  calculatePnlPercent,
  durationMs,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatSpan,
  formatPrice,
  notional,
} from './data/trade.model';
import { summarize } from '../analytics/data/metrics';
import { AUTO_TAGS, AUTO_TAG_LABELS, isAutoTag } from '../analytics/data/behavior';
import { PortfolioStore } from '../analytics/portfolio-store';
import { TradeTags } from './trade-tags';
import { ManualTagsStore } from './manual-tags-store';
import { manualTagFilter, manualTagOfFilter } from './data/manual-tags.model';
import { Tooltip } from '../../shared/ui/tooltip';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Select, SelectOption } from '../../shared/ui/select';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';
import { PnlValue } from '../../shared/ui/pnl-value';
import { EmptyState } from '../../shared/ui/empty-state';
import { Skeleton } from '../../shared/ui/skeleton';
import { SketchUnderline } from '../../shared/ui/sketch/sketch-underline';

type SortKey = 'openedAt' | 'symbol' | 'notional' | 'pnl' | 'pnlPct' | 'duration';

const PAGE_SIZES = [25, 50, 100] as const;

/** 'table' — таблица с раскрытием строки, 'split' — график слева, список справа. */
type ViewMode = 'table' | 'split';

/** Список сделок с фильтрами, пагинацией и разбором, раскрывающимся под строкой. */
@Component({
  selector: 'app-trade-list',
  imports: [
    RouterLink,
    SketchUnderline,
    TradeExpand,
    TradeNav,
    Icon,
    Button,
    Select,
    Segmented,
    PnlValue,
    EmptyState,
    Skeleton,
    TradeTags,
    Tooltip,
  ],
  templateUrl: './trade-list.html',
  styleUrl: './trade-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeList {
  protected readonly store = inject(TradesStore);
  protected readonly accounts = inject(AccountsStore);

  private readonly portfolio = inject(PortfolioStore);
  private readonly manualTags = inject(ManualTagsStore);

  /** Из маршрута /trades/:id — сделка, которую нужно сразу раскрыть. */
  readonly id = input<string>();
  /** Query-параметры: инсайт ведёт сюда с фильтром по автотегу или направлению. */
  readonly tag = input<string>();
  readonly side = input<string>();

  private readonly tableEl = viewChild<ElementRef<HTMLElement>>('tableWrap');
  private widthObserver: ResizeObserver | null = null;

  protected readonly sortKey = signal<SortKey>('openedAt');
  protected readonly sortDir = signal<1 | -1>(-1);
  protected readonly page = signal(1);
  protected readonly pageSize = signal<number>(50);
  protected readonly expandedId = signal<string | null>(null);
  /** Страница всегда открывается таблицей; «График» — только на текущий визит. */
  protected readonly viewMode = signal<ViewMode>('table');

  protected readonly viewOptions: SegmentOption[] = [
    { value: 'table', label: 'Таблица' },
    { value: 'split', label: 'График' },
  ];

  protected readonly pageSizeOptions: SelectOption[] = PAGE_SIZES.map((n) => ({
    value: String(n),
    label: `${n} на странице`,
  }));

  protected readonly sideOptions: SelectOption[] = [
    { value: 'long', label: 'Лонг' },
    { value: 'short', label: 'Шорт' },
  ];

  /** «Разбор»: сначала автотеги тренера, затем ручные теги трейдера («#тег», по частоте). */
  protected readonly tagOptions = computed<SelectOption[]>(() => [
    ...AUTO_TAGS.map((tag) => ({ value: tag, label: AUTO_TAG_LABELS[tag] })),
    ...this.manualTags.usage().map((u) => ({
      value: manualTagFilter(u.tag),
      label: '#' + u.tag,
      hint: String(u.count),
    })),
  ]);

  protected readonly statusOptions: SelectOption[] = [
    { value: 'closed', label: 'Закрытые' },
    { value: 'open', label: 'Открытые' },
  ];

  protected readonly symbolOptions = computed<SelectOption[]>(() =>
    this.store.symbols().map((s) => ({ value: s, label: s })),
  );

  /** Нереализованный P&L открытых сделок — из позиций биржи. */
  private readonly unrealizedById = computed(() => {
    const map = new Map<string, number>();
    for (const p of this.portfolio.positions()) if (p.tradeId) map.set(p.tradeId, p.unrealizedPnl);
    return map;
  });

  private readonly rows = computed<TradeRow[]>(() => {
    const tags = this.store.tags();
    const manual = this.manualTags.byTrade();
    const unrealized = this.unrealizedById();
    return this.store.tableTrades().map((trade) => ({
      trade,
      pnl: calculatePnl(trade),
      pnlPct: calculatePnlPercent(trade),
      notional: notional(trade),
      marks: tags.get(trade.id) ?? [],
      manualTags: manual.get(trade.id) ?? [],
      unrealized: trade.status === 'open' ? (unrealized.get(trade.id) ?? null) : null,
    }));
  });

  /** Открытые позиции закреплены сверху при любой сортировке, внутри — по ней же. */
  protected readonly sortedRows = computed<TradeRow[]>(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...this.rows()].sort((a, b) => openFirst(a, b) || compareRows(a, b, key) * dir);
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.sortedRows().length / this.pageSize())),
  );

  protected readonly visibleRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  /** «1–50 из 128». */
  protected readonly rangeLabel = computed(() => {
    const total = this.sortedRows().length;
    if (total === 0) return '0 сделок';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, start + this.pageSize() - 1);
    return `${start}–${end} из ${total}`;
  });

  /** Номера страниц с пропусками: 1 … 4 5 6 … 12. null — «…». */
  protected readonly pageItems = computed<(number | null)[]>(() => {
    const count = this.pageCount();
    const current = this.page();
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
    const items: (number | null)[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(count - 1, current + 1);
    if (from > 2) items.push(null);
    for (let i = from; i <= to; i++) items.push(i);
    if (to < count - 1) items.push(null);
    items.push(count);
    return items;
  });

  protected readonly summary = computed(() => summarize(this.store.tableTrades()));

  /** В режиме «График» всегда что-то выбрано: явный выбор или первая строка. */
  protected readonly selectedRow = computed<TradeRow | null>(() => {
    const rows = this.visibleRows();
    if (rows.length === 0) return null;
    return rows.find((r) => r.trade.id === this.expandedId()) ?? rows[0];
  });

  protected readonly selectedId = computed(() => this.selectedRow()?.trade.id ?? null);

  constructor() {
    // Пришли из инсайта (?tag=… / ?side=…) — ставим ровно этот фильтр.
    effect(() => {
      const tag = this.tag();
      const side = this.side();
      if (tag === undefined && side === undefined) return;
      untracked(() => {
        this.store.resetTableFilters();
        this.store.updateTableFilters({
          tag: isAutoTag(tag) || manualTagOfFilter(tag) ? tag : undefined,
          side: side === 'long' || side === 'short' ? side : undefined,
        });
        this.page.set(1);
      });
    });
    // Держим страницу в допустимых границах при смене фильтров/размера.
    effect(() => {
      const count = this.pageCount();
      if (this.page() > count) this.page.set(count);
    });
    // Deep-link /trades/:id: раскрываем сделку и переходим на её страницу.
    effect(() => {
      const id = this.id();
      if (!id) return;
      const index = this.sortedRows().findIndex((r) => r.trade.id === id);
      if (index === -1) return;
      this.expandedId.set(id);
      this.page.set(Math.floor(index / this.pageSize()) + 1);
      setTimeout(() => document.getElementById(`trade-${id}`)?.scrollIntoView({ block: 'center' }), 80);
    });
    // Ширина видимой части таблицы — для раскрытой строки: таблица может быть
    // шире экрана и скроллиться, а панель разбора должна занимать ровно окно.
    afterNextRender(() => this.observeWidth());
    inject(DestroyRef).onDestroy(() => this.widthObserver?.disconnect());
  }

  private observeWidth(): void {
    const el = this.tableEl()?.nativeElement;
    if (!el) return;
    const apply = () => el.style.setProperty('--table-vw', `${el.clientWidth}px`);
    apply();
    this.widthObserver = new ResizeObserver(apply);
    this.widthObserver.observe(el);
  }

  // ── Сортировка ────────────────────────────────────────────────────────────

  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 1 ? -1 : 1));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(-1);
    }
    this.page.set(1);
  }

  protected sortArrow(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === -1 ? '▼' : '▲';
  }

  // ── Фильтры ───────────────────────────────────────────────────────────────

  protected setSearch(value: string): void {
    this.store.updateTableFilters({ search: value });
    this.page.set(1);
  }

  protected setSide(value: string | null): void {
    this.store.updateTableFilters({ side: (value as TradeSide) ?? undefined });
    this.page.set(1);
  }

  protected setTag(value: string | null): void {
    this.store.updateTableFilters({ tag: value ?? undefined });
    this.page.set(1);
  }

  protected setStatus(value: string | null): void {
    this.store.updateTableFilters({ status: (value as TradeStatus) ?? undefined });
    this.page.set(1);
  }

  protected setSymbols(values: string[]): void {
    this.store.updateTableFilters({ symbols: values.length ? values : undefined });
    this.page.set(1);
  }

  protected reset(): void {
    this.store.resetTableFilters();
    this.page.set(1);
  }

  // ── Раскрытие строки и пагинация ─────────────────────────────────────────

  protected toggle(trade: Trade): void {
    this.expandedId.update((id) => (id === trade.id ? null : trade.id));
  }

  protected select(trade: Trade): void {
    this.expandedId.set(trade.id);
  }

  protected setViewMode(mode: string): void {
    if (mode === 'table' || mode === 'split') this.viewMode.set(mode);
  }



  protected goTo(page: number): void {
    const next = Math.min(Math.max(1, page), this.pageCount());
    if (next === this.page()) return;
    this.page.set(next);
    if (this.viewMode() === 'table') this.expandedId.set(null);
    this.tableEl()?.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  protected setPageSize(value: string | null): void {
    const size = Number(value);
    if (!PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number])) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  // ── Форматирование ────────────────────────────────────────────────────────

  protected readonly fmtDateTime = formatDateTime;
  protected readonly fmtPrice = formatPrice;

  protected fmtNotional(value: number): string {
    return formatMoney(value);
  }

  /** У открытой — сколько уже в позиции. */
  protected fmtDuration(trade: Trade): string {
    return trade.status === 'closed' ? formatDuration(trade.openedAt, trade.closedAt) : formatSpan(durationMs(trade));
  }

  protected fmtMoney(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }
}

function openFirst(a: TradeRow, b: TradeRow): number {
  return Number(b.trade.status === 'open') - Number(a.trade.status === 'open');
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
    case 'duration':
      return durationMs(a.trade) - durationMs(b.trade);
  }
}
