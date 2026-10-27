import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import {
  SESSION_LABELS,
  Trade,
  calculatePnl,
  calculatePnlPercent,
  durationMs,
  formatDateTime,
  formatDuration,
  formatFeesOther,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSpan,
  notional,
  tradingSession,
} from './data/trade.model';
import { AccountsStore } from '../accounts/accounts-store';
import { exchangeMeta } from '../accounts/data/account.model';
import { TradeChartData, chartTimeframe } from './data/trade-chart.model';
import { TradeChartLoader } from './data/trade-chart-loader';
import { Timeframe, marketExchangeOf } from '../../core/market/market.model';
import { TradeChart } from './trade-chart';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { Skeleton } from '../../shared/ui/skeleton';
import { EmptyState } from '../../shared/ui/empty-state';
import { TradeTags } from './trade-tags';
import { TradesStore } from './trades-store';
import { PortfolioStore } from '../analytics/portfolio-store';

/** Ячейка таблицы фактов: подпись, значение и смысловой цвет. */
interface Fact {
  k: string;
  v: string;
  tone?: 'pos' | 'neg' | 'win' | 'loss';
  /** На всю ширину таблицы (длинные значения). */
  wide?: boolean;
}

const ORDER_LABEL = { market: 'маркет', limit: 'лимит' } as const;

/** «маркет → лимит»; неизвестный тип — прочерк. */
function orderTypes(t: Trade): string {
  const open = t.openOrderType ? ORDER_LABEL[t.openOrderType] : '—';
  if (t.status === 'open') return open;
  const close = t.closeOrderType ? ORDER_LABEL[t.closeOrderType] : '—';
  return `${open} → ${close}`;
}

/**
 * Разбор сделки: график с исполнениями, итог крупно, факты биржи и автотеги
 * (реванш, тильт, овертрейд…) с причинами.
 *
 * `layout` — 'row' (график слева, факты справа) для раскрытой строки таблицы,
 * 'column' (график сверху, факты колонками под ним) для режима «График».
 * `embedded` — без карточки и отступов, когда компонент лежит в своей панели.
 */
@Component({
  selector: 'app-trade-expand',
  imports: [TradeChart, Icon, Button, Badge, Skeleton, EmptyState, TradeTags],
  templateUrl: './trade-expand.html',
  styleUrl: './trade-expand.scss',
  host: { '[class]': "'is-' + layout()", '[class.is-embedded]': 'embedded()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeExpand {
  private readonly accountsStore = inject(AccountsStore);
  private readonly loader = inject(TradeChartLoader);
  private readonly tradesStore = inject(TradesStore);
  private readonly portfolio = inject(PortfolioStore);

  readonly trade = input.required<Trade>();
  /** 'row' — рядом с таблицей, 'column' — в режиме «График». */
  readonly layout = input<'row' | 'column'>('row');
  /** Внутри собственной панели: без карточки, отступов и кнопки «свернуть». */
  readonly embedded = input(false, { transform: booleanAttribute });
  readonly closed = output<void>();

  private readonly account = computed(() =>
    this.accountsStore.accounts().find((a) => a.id === this.trade().accountId),
  );
  protected readonly accountName = computed(() => this.account()?.label ?? '—');
  /** Свечи графика — с биржи счёта сделки. */
  protected readonly exchange = computed(() => marketExchangeOf(this.account()?.exchange ?? 'binance'));
  protected readonly marketLabel = computed(() => {
    const meta = exchangeMeta(this.account()?.exchange ?? 'binance');
    return `${meta.label} ${meta.market}`;
  });

  protected readonly pnl = computed(() => calculatePnl(this.trade()));
  protected readonly marks = computed(() => this.tradesStore.tags().get(this.trade().id) ?? []);

  /** Нереализованный P&L открытой сделки по позиции биржи; null — неизвестен. */
  protected readonly unrealized = computed(() => {
    const id = this.trade().id;
    return this.portfolio.positions().find((p) => p.tradeId === id)?.unrealizedPnl ?? null;
  });

  /** Под итогом: движение цены, комиссии; у открытой — сколько уже в позиции. */
  protected readonly resultNote = computed(() => {
    const t = this.trade();
    if (t.status === 'open') {
      const partial = t.exitPrice !== null ? ` · частично закрыта, realized ${formatMoney(t.realizedPnl, { sign: true })}` : '';
      return `в позиции ${formatSpan(durationMs(t))}${partial}`;
    }
    const move = calculatePnlPercent(t);
    const moveText = move ? `цена ${formatPercent(move, { sign: true })}` : 'движение неизвестно';
    return `${moveText} · до комиссий ${formatMoney(t.realizedPnl, { sign: true })}`;
  });

  /** Таймфрейм графика: по длительности сделки, дальше — переключается в тулбаре. */
  protected readonly timeframe = linkedSignal<Timeframe>(() => chartTimeframe(this.trade()));

  /**
   * Что грузить. Сделки перечитываются при каждом событии журнала — новый
   * объект той же сделки не должен сбрасывать график, только смена статуса.
   */
  private readonly chartParams = computed(
    () => ({ trade: this.trade(), timeframe: this.timeframe(), exchange: this.exchange() }),
    {
      equal: (a, b) =>
        a.trade.id === b.trade.id &&
        a.trade.status === b.trade.status &&
        a.timeframe === b.timeframe &&
        a.exchange === b.exchange,
    },
  );
  private readonly chartResource = resource({
    params: () => this.chartParams(),
    loader: ({ params }) => this.loader.load(params.trade, params.timeframe, params.exchange),
  });
  /** Последнее загруженное окно — при смене ТФ график не пропадает на время запроса. */
  protected readonly chartData = signal<TradeChartData | null>(null);
  protected readonly chartFailed = computed(
    () => this.chartResource.status() === 'error' && this.chartData() === null,
  );

  protected readonly facts = computed<Fact[]>(() => {
    const t = this.trade();
    const closed = t.status === 'closed';
    const sign = (v: number): Fact['tone'] => (v >= 0 ? 'pos' : 'neg');
    const feesOther = formatFeesOther(t);
    return [
      { k: 'Вход', v: t.carriedIn ? 'до начала истории' : formatPrice(t.entryPrice) },
      { k: 'Выход', v: t.exitPrice === null ? 'в позиции' : formatPrice(t.exitPrice) },
      { k: 'Объём', v: formatQuantity(t.quantity) },
      { k: 'Номинал', v: formatMoney(notional(t)) },
      { k: 'Комиссии', v: feesOther ? `${formatMoney(t.fees)} + ${feesOther}` : formatMoney(t.fees) },
      {
        k: 'Фандинг',
        v: t.funding === 0 ? '—' : formatMoney(t.funding, { sign: true }),
        tone: t.funding === 0 ? undefined : sign(t.funding),
      },
      { k: 'В позиции', v: closed ? formatDuration(t.openedAt, t.closedAt) : formatSpan(durationMs(t)) },
      { k: 'Исполнений', v: `${t.fillsCount}` },
      { k: 'Ордера', v: orderTypes(t) },
      { k: 'Сессия', v: SESSION_LABELS[tradingSession(t.openedAt)] },
      { k: 'Счёт', v: `${this.accountName()} · ${this.marketLabel()}`, wide: true },
    ];
  });

  protected money(value: number): string {
    return formatMoney(value, { sign: true });
  }

  constructor() {
    effect(() => {
      if (this.chartResource.hasValue()) this.chartData.set(this.chartResource.value());
    });
  }

  protected reloadChart(): void {
    this.chartResource.reload();
  }

  protected readonly fmtDateTime = formatDateTime;
}
