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
  formatDateTime,
  formatDuration,
  formatFeesOther,
  formatMoney,
  formatPercent,
  formatPrice,
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
import { Soon } from '../../shared/ui/soon';

/** Ячейка таблицы фактов: подпись, значение и смысловой цвет. */
interface Fact {
  k: string;
  v: string;
  tone?: 'pos' | 'neg' | 'win' | 'loss';
}

/**
 * Разбор сделки: график с исполнениями и факты биржи. Поля разбора (заметки,
 * теги, ошибки) API пока не хранит — на их месте пометка «скоро».
 *
 * `layout` — 'row' (график слева, факты справа) для раскрытой строки таблицы,
 * 'column' (график сверху, факты колонками под ним) для режима «График».
 * `embedded` — без карточки и отступов, когда компонент лежит в своей панели.
 */
@Component({
  selector: 'app-trade-expand',
  imports: [TradeChart, Icon, Button, Badge, Skeleton, EmptyState, Soon],
  templateUrl: './trade-expand.html',
  styleUrl: './trade-expand.scss',
  host: { '[class]': "'is-' + layout()", '[class.is-embedded]': 'embedded()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeExpand {
  private readonly accountsStore = inject(AccountsStore);
  private readonly loader = inject(TradeChartLoader);

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
    const pnl = calculatePnl(t);
    const move = calculatePnlPercent(t);
    const feesOther = formatFeesOther(t);
    return [
      ...(closed
        ? ([
            { k: 'P&L', v: formatMoney(pnl, { sign: true }), tone: sign(pnl) },
            { k: 'Движение', v: move ? formatPercent(move, { sign: true }) : '—', tone: move ? sign(move) : undefined },
            { k: 'Realized', v: formatMoney(t.realizedPnl, { sign: true }), tone: sign(t.realizedPnl) },
          ] as Fact[])
        : ([
            { k: 'Realized', v: formatMoney(t.realizedPnl, { sign: true }), tone: t.realizedPnl ? sign(t.realizedPnl) : undefined },
          ] as Fact[])),
      { k: 'Комиссии', v: feesOther ? `${formatMoney(t.fees)} + ${feesOther}` : formatMoney(t.fees) },
      {
        k: 'Фандинг',
        v: t.funding === 0 ? '—' : formatMoney(t.funding, { sign: true }),
        tone: t.funding === 0 ? undefined : sign(t.funding),
      },
      { k: 'Вход', v: t.carriedIn ? 'до начала истории' : formatPrice(t.entryPrice) },
      { k: 'Выход', v: t.exitPrice === null ? 'в позиции' : formatPrice(t.exitPrice) },
      { k: 'Объём', v: `${t.quantity}` },
      { k: 'Номинал', v: formatMoney(notional(t)) },
      { k: 'Исполнений', v: `${t.fillsCount}` },
      { k: 'В позиции', v: closed ? formatDuration(t.openedAt, t.closedAt) : 'позиция открыта' },
      { k: 'Сессия', v: SESSION_LABELS[tradingSession(t.openedAt)] },
      { k: 'Счёт', v: this.accountName() },
      { k: 'Рынок', v: this.marketLabel() },
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

  protected readonly fmtDateTime = formatDateTime;
}
