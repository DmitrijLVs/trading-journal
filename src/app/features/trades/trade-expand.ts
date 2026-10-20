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
  signal,
} from '@angular/core';
import { TradesStore } from './trades-store';
import { TradesApi } from './data/trades-api';
import {
  MARKET_LABELS,
  SESSION_LABELS,
  Trade,
  calculatePnl,
  calculatePnlPercent,
  calculateRMultiple,
  calculateRoi,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPercent,
  formatPrice,
  formatR,
  notional,
  plannedRiskReward,
  plannedRiskUsd,
  tradingSession,
} from './data/trade.model';
import { AccountsStore } from '../accounts/accounts-store';
import { MISTAKES } from '../../core/mock/mock-universe';
import { TradeChartData, resolveTimeframe } from '../../core/mock/mock-candles';
import { TradeChart } from './trade-chart';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { Select, SelectOption } from '../../shared/ui/select';
import { Skeleton } from '../../shared/ui/skeleton';
import { ToastService } from '../../shared/ui/toast';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { Tooltip } from '../../shared/ui/tooltip';

/** Ячейка таблицы фактов: подпись, значение и смысловой цвет. */
interface Fact {
  k: string;
  v: string;
  tone?: 'pos' | 'neg' | 'win' | 'loss';
}

/**
 * Разбор сделки: график с разметкой исполнений и факты с полями анализа.
 *
 * `layout` — 'row' (график слева, факты справа) для раскрытой строки таблицы,
 * 'column' (график сверху, факты колонками под ним) для режима «График».
 * `embedded` — без карточки и отступов, когда компонент лежит в своей панели.
 */
@Component({
  selector: 'app-trade-expand',
  imports: [TradeChart, Icon, Button, Badge, Select, Skeleton, Tooltip],
  templateUrl: './trade-expand.html',
  styleUrl: './trade-expand.scss',
  host: { '[class]': "'is-' + layout()", '[class.is-embedded]': 'embedded()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeExpand {
  private readonly store = inject(TradesStore);
  private readonly accountsStore = inject(AccountsStore);
  private readonly api = inject(TradesApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly trade = input.required<Trade>();
  /** 'row' — рядом с таблицей, 'column' — в режиме «График». */
  readonly layout = input<'row' | 'column'>('row');
  /** Внутри собственной панели: без карточки, отступов и кнопки «свернуть». */
  readonly embedded = input(false, { transform: booleanAttribute });
  readonly closed = output<void>();

  /** Счёт сделки — название биржи вместо технического id. */
  protected readonly accountName = computed(
    () => this.accountsStore.accounts().find((a) => a.id === this.trade().accountId)?.name ?? '—',
  );

  protected readonly marketLabel = computed(() => MARKET_LABELS[this.trade().market]);

  /** Таймфрейм графика: стартует с таймфрейма сделки, переключается в тулбаре. */
  protected readonly timeframe = linkedSignal<string>(() => resolveTimeframe(this.trade()));

  private readonly candlesId = computed<string | null>(() => this.trade().id);
  private readonly candlesResource = this.api.candles(this.candlesId, this.timeframe);
  /** Последние загруженные свечи — при смене ТФ график не пропадает на время запроса. */
  protected readonly chartData = signal<TradeChartData | null>(null);

  protected readonly noteDraft = signal('');
  protected readonly noteDirty = computed(() => this.noteDraft() !== this.trade().notes);

  protected readonly mistakeOptions = computed<SelectOption[]>(() => {
    const known = new Set<string>(MISTAKES);
    for (const m of this.trade().mistakes) known.add(m);
    return [...known].map((m) => ({ value: m, label: m }));
  });

  protected readonly tagOptions = computed<SelectOption[]>(() => {
    const known = new Set<string>(this.store.tags());
    for (const t of this.trade().tags) known.add(t);
    return [...known].map((t) => ({ value: t, label: t }));
  });

  protected readonly result = computed(() => {
    const t = this.trade();
    return {
      pnl: calculatePnl(t),
      pnlPct: calculatePnlPercent(t),
      roi: calculateRoi(t),
      r: calculateRMultiple(t),
    };
  });

  protected readonly plan = computed(() => {
    const t = this.trade();
    return {
      risk: plannedRiskUsd(t),
      rr: plannedRiskReward(t),
      slPct: t.stopLoss !== null ? (Math.abs(t.entryPrice - t.stopLoss) / t.entryPrice) * 100 : null,
    };
  });

  protected readonly execution = computed(() => {
    const t = this.trade();
    return {
      notional: notional(t),
      margin: notional(t) / Math.max(1, t.leverage),
      session: SESSION_LABELS[tradingSession(t.openedAt)],
      duration: t.status === 'closed' ? formatDuration(t.openedAt, t.closedAt) : 'позиция открыта',
    };
  });

  /**
   * Все цифры сделки одной плоской таблицей: так весь разбор помещается под
   * графиком без прокрутки, а заголовки групп не тратят высоту.
   */
  protected readonly facts = computed<Fact[]>(() => {
    const t = this.trade();
    const r = this.result();
    const p = this.plan();
    const e = this.execution();
    const closed = t.status === 'closed';
    const sign = (v: number): Fact['tone'] => (v >= 0 ? 'pos' : 'neg');

    return [
      ...(closed
        ? ([
            { k: 'P&L', v: formatMoney(r.pnl, { sign: true }), tone: sign(r.pnl) },
            { k: 'Движение', v: formatPercent(r.pnlPct, { sign: true }), tone: sign(r.pnlPct) },
            { k: 'ROI', v: formatPercent(r.roi, { sign: true }), tone: sign(r.roi) },
            { k: 'R', v: formatR(r.r), tone: r.r === null ? undefined : sign(r.r) },
          ] as Fact[])
        : []),
      { k: 'Вход', v: formatPrice(t.entryPrice) },
      closed
        ? { k: 'Выход', v: formatPrice(t.exitPrice) }
        : { k: 'Выход', v: 'в позиции' },
      { k: 'Стоп', v: t.stopLoss === null ? '—' : formatPrice(t.stopLoss), tone: 'loss' },
      { k: 'Тейк', v: t.takeProfit === null ? '—' : formatPrice(t.takeProfit), tone: 'win' },
      { k: 'Риск', v: this.fmtMoney(p.risk) },
      { k: 'План R:R', v: p.rr === null ? '—' : `1 : ${p.rr.toFixed(1)}` },
      { k: 'Объём', v: `${t.quantity}` },
      { k: 'Номинал', v: formatMoney(e.notional) },
      { k: 'Маржа', v: formatMoney(e.margin) },
      { k: 'Комиссии', v: formatMoney(t.fees) },
      { k: 'Фандинг', v: t.funding === 0 ? '—' : formatMoney(t.funding, { sign: true }) },
      { k: 'В позиции', v: e.duration },
      { k: 'Сессия', v: e.session },
      { k: 'ТФ', v: t.timeframe },
      { k: 'Счёт', v: this.accountName() },
      { k: 'Рынок', v: this.marketLabel() },
    ];
  });

  constructor() {
    effect(() => this.noteDraft.set(this.trade().notes));
    effect(() => {
      const data = this.candlesResource.value();
      if (data) this.chartData.set(data);
    });
  }

  // ── Мутации ───────────────────────────────────────────────────────────────

  protected async saveNote(): Promise<void> {
    await this.store.update(this.trade().id, { notes: this.noteDraft() });
    this.toast.success('Заметка сохранена');
  }

  protected async setMistakes(values: string[]): Promise<void> {
    await this.store.update(this.trade().id, { mistakes: values });
  }

  protected async setTags(values: string[]): Promise<void> {
    await this.store.update(this.trade().id, { tags: values });
  }

  protected async remove(): Promise<void> {
    const t = this.trade();
    const ok = await this.confirm.ask({
      title: 'Удалить сделку?',
      message: `${t.symbol} от ${formatDateTime(t.openedAt)} будет удалена безвозвратно.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    await this.store.remove(t.id);
    this.toast.info('Сделка удалена');
    this.closed.emit();
  }

  // ── Форматирование ────────────────────────────────────────────────────────

  protected readonly fmtDateTime = formatDateTime;
  protected readonly fmtPrice = formatPrice;

  protected fmtMoney(value: number | null, sign = false): string {
    return value === null ? '—' : formatMoney(value, { sign });
  }
}
