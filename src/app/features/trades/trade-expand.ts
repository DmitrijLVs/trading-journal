import {
  ChangeDetectionStrategy,
  Component,
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
  SESSION_LABELS,
  Trade,
  calculatePnl,
  calculatePnlPercent,
  calculateRMultiple,
  calculateRoi,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatPrice,
  notional,
  plannedRiskReward,
  plannedRiskUsd,
  tradingSession,
} from './data/trade.model';
import { MISTAKES } from '../../core/mock/mock-universe';
import { TradeChartData, resolveTimeframe } from '../../core/mock/mock-candles';
import { TradeChart } from './trade-chart';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { PnlValue } from '../../shared/ui/pnl-value';
import { Select, SelectOption } from '../../shared/ui/select';
import { Skeleton } from '../../shared/ui/skeleton';
import { ToastService } from '../../shared/ui/toast';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { Tooltip } from '../../shared/ui/tooltip';
import { SketchFrame } from '../../shared/ui/sketch/sketch-frame';

/**
 * Разбор сделки внутри таблицы: раскрывается под строкой. Слева график
 * с разметкой входа/выхода/SL/TP, справа факты и поля анализа
 * (заметка, состояние, ошибки, теги) — редактируются на месте.
 */
@Component({
  selector: 'app-trade-expand',
  imports: [SketchFrame, TradeChart, Icon, Button, Badge, PnlValue, Select, Skeleton, Tooltip],
  templateUrl: './trade-expand.html',
  styleUrl: './trade-expand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeExpand {
  private readonly store = inject(TradesStore);
  private readonly api = inject(TradesApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly trade = input.required<Trade>();
  readonly closed = output<void>();

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
