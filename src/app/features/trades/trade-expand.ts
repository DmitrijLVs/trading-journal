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
  Trade,
  calculatePnl,
  calculatePnlPercent,
  formatFeesOther,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  notional,
  tradeTimeRange,
} from './data/trade.model';
import { AccountsStore } from '../accounts/accounts-store';
import { exchangeMeta } from '../accounts/data/account.model';
import { TradeChartData, chartTimeframe } from './data/trade-chart.model';
import { TradeChartLoader } from './data/trade-chart-loader';
import { Timeframe, isSecondsTimeframe, marketExchangeOf } from '../../core/market/market.model';
import { TradeChart } from './trade-chart';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { Skeleton } from '../../shared/ui/skeleton';
import { EmptyState } from '../../shared/ui/empty-state';
import { TradeTags } from './trade-tags';
import { TradeTagEditor } from './trade-tag-editor';
import { TradesStore } from './trades-store';
import { PortfolioStore } from '../analytics/portfolio-store';
import { ResizeHandle } from '../../shared/ui/resize-handle';
import { storedNumber } from '../../core/state/stored-signal';

/** Строка фактов: подпись, значение, приглушённое уточнение перед ним и цвет. */
interface Fact {
  k: string;
  v: string;
  note?: string;
  tone?: 'pos' | 'neg';
}

const ORDER_LABEL = { market: 'маркет', limit: 'лимит' } as const;

/** Ширина колонки сделки рядом с графиком (раскрытая строка), px. */
const SIDE_WIDTH = { default: 340, min: 280, max: 720 } as const;

function orderLabel(type: Trade['openOrderType']): string | undefined {
  return type ? ORDER_LABEL[type] : undefined;
}

/**
 * Сделка: график с исполнениями, итог, короткий список фактов биржи, теги
 * (автотеги — причина в подсказке).
 *
 * `layout` — 'row' (график слева, факты справа) для раскрытой строки таблицы,
 * 'column' (график сверху, полоса фактов под ним) для режима «График».
 * `embedded` — без карточки и отступов, когда компонент лежит в своей панели.
 */
@Component({
  selector: 'app-trade-expand',
  imports: [
    TradeChart,
    Icon,
    Button,
    Badge,
    Skeleton,
    EmptyState,
    TradeTags,
    TradeTagEditor,
    ResizeHandle,
  ],
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
  /** Свечи графика — с биржи счёта сделки. */
  protected readonly exchange = computed(() => marketExchangeOf(this.account()?.exchange ?? 'binance'));
  protected readonly marketLabel = computed(() => {
    const meta = exchangeMeta(this.account()?.exchange ?? 'binance');
    return `${meta.label} ${meta.market}`;
  });

  /** Ширина колонки сделки в раскладке 'row' — настройка устройства. */
  protected readonly sideWidth = storedNumber('tj.trades.sideWidth', SIDE_WIDTH.default);
  protected readonly sideWidthLimits = SIDE_WIDTH;

  protected readonly marks = computed(() => this.tradesStore.tags().get(this.trade().id) ?? []);
  protected readonly when = computed(() => tradeTimeRange(this.trade()));

  /** Нереализованный P&L открытой сделки по позиции биржи; null — неизвестен. */
  private readonly unrealized = computed(() => {
    const id = this.trade().id;
    return this.portfolio.positions().find((p) => p.tradeId === id)?.unrealizedPnl ?? null;
  });

  /** Итог: у закрытой — чистый P&L, у открытой — нереализованный по бирже. */
  protected readonly result = computed(() => {
    const t = this.trade();
    return t.status === 'closed' ? calculatePnl(t) : (this.unrealized() ?? 0);
  });
  protected readonly resultText = computed(() =>
    this.trade().status === 'open' && this.unrealized() === null ? '—' : formatMoney(this.result(), { sign: true }),
  );
  /** Рядом с итогом: ход цены; у открытой — что это нереализованный и сколько уже зафиксировано. */
  protected readonly resultNote = computed(() => {
    const t = this.trade();
    if (t.status === 'open') {
      return t.exitPrice !== null
        ? `нереализованный · зафиксировано ${formatMoney(t.realizedPnl, { sign: true })}`
        : 'нереализованный';
    }
    const move = calculatePnlPercent(t);
    return move ? formatPercent(move, { sign: true }) : '';
  });

  /** Таймфрейм графика: по длительности сделки, дальше — переключается в тулбаре. */
  protected readonly timeframe = linkedSignal<Timeframe>(() =>
    chartTimeframe(this.trade(), this.exchange()),
  );

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
  /** График на секундах — пустой ответ значит «история секунд кончилась», а не «нет символа». */
  protected readonly secondsChart = computed(() => isSecondsTimeframe(this.chartData()?.timeframe ?? '1m'));
  /** Последнее загруженное окно — при смене ТФ график не пропадает на время запроса. */
  protected readonly chartData = signal<TradeChartData | null>(null);
  protected readonly chartFailed = computed(
    () => this.chartResource.status() === 'error' && this.chartData() === null,
  );

  protected readonly facts = computed<Fact[]>(() => {
    const t = this.trade();
    const feesOther = formatFeesOther(t);
    return [
      {
        k: 'Вход',
        v: t.carriedIn ? 'до начала истории' : formatPrice(t.entryPrice),
        note: orderLabel(t.openOrderType),
      },
      {
        k: 'Выход',
        v: t.exitPrice === null ? '—' : formatPrice(t.exitPrice),
        note: t.status === 'closed' ? orderLabel(t.closeOrderType) : undefined,
      },
      { k: 'Объём', v: formatMoney(notional(t)), note: formatQuantity(t.quantity) },
      { k: 'Комиссии', v: feesOther ? `${formatMoney(t.fees)} + ${feesOther}` : formatMoney(t.fees) },
      {
        k: 'Фандинг',
        v: t.funding === 0 ? formatMoney(0) : formatMoney(t.funding, { sign: true }),
        tone: t.funding > 0 ? 'pos' : t.funding < 0 ? 'neg' : undefined,
      },
    ];
  });

  constructor() {
    effect(() => {
      if (this.chartResource.hasValue()) this.chartData.set(this.chartResource.value());
    });
  }

  protected reloadChart(): void {
    this.chartResource.reload();
  }

}
