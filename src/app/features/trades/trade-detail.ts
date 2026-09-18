import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TradesStore } from './trades-store';
import { TradesApi } from './data/trades-api';
import {
  MOOD_EMOJI,
  MOOD_LABELS,
  Mood,
  SESSION_LABELS,
  SetupGrade,
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
import { TradeChart } from './trade-chart';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { PnlValue } from '../../shared/ui/pnl-value';
import { Select, SelectOption } from '../../shared/ui/select';
import { Segmented } from '../../shared/ui/segmented';
import { Skeleton } from '../../shared/ui/skeleton';
import { EmptyState } from '../../shared/ui/empty-state';
import { ToastService } from '../../shared/ui/toast';
import { ConfirmService } from '../../shared/ui/confirm-dialog';
import { Tooltip } from '../../shared/ui/tooltip';

@Component({
  selector: 'app-trade-detail',
  imports: [
    RouterLink,
    TradeChart,
    Icon,
    Button,
    Badge,
    PnlValue,
    Select,
    Segmented,
    Skeleton,
    EmptyState,
    Tooltip,
  ],
  templateUrl: './trade-detail.html',
  styleUrl: './trade-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeDetail {
  private readonly store = inject(TradesStore);
  private readonly api = inject(TradesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** Из маршрута /trades/:id (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly trade = computed<Trade | undefined>(() => this.store.trade(this.id()));
  protected readonly isLoading = this.store.isLoading;

  private readonly candlesId = computed(() => (this.trade() ? this.id() : null));
  private readonly candlesResource = this.api.candles(this.candlesId);
  protected readonly chartData = computed(() => this.candlesResource.value());

  /** Черновик заметки; сохраняется по кнопке. */
  protected readonly noteDraft = signal('');
  protected readonly noteDirty = computed(() => this.noteDraft() !== (this.trade()?.notes ?? ''));

  protected readonly gradeOptions = [
    { value: 'A+', label: 'A+' },
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
  ];

  protected readonly moodOptions: SelectOption[] = (Object.keys(MOOD_LABELS) as Mood[]).map((m) => ({
    value: m,
    label: `${MOOD_EMOJI[m]} ${MOOD_LABELS[m]}`,
  }));

  protected readonly mistakeOptions = computed<SelectOption[]>(() => {
    const known = new Set<string>(MISTAKES);
    for (const m of this.trade()?.mistakes ?? []) known.add(m);
    return [...known].map((m) => ({ value: m, label: m }));
  });

  protected readonly tagOptions = computed<SelectOption[]>(() => {
    const known = new Set<string>(this.store.tags());
    for (const t of this.trade()?.tags ?? []) known.add(t);
    return [...known].map((t) => ({ value: t, label: t }));
  });

  // ── Расчёты для панелей ────────────────────────────────────────────────────

  protected readonly result = computed(() => {
    const trade = this.trade();
    if (!trade) return null;
    return {
      pnl: calculatePnl(trade),
      pnlPct: calculatePnlPercent(trade),
      roi: calculateRoi(trade),
      r: calculateRMultiple(trade),
    };
  });

  protected readonly plan = computed(() => {
    const trade = this.trade();
    if (!trade) return null;
    return {
      risk: plannedRiskUsd(trade),
      rr: plannedRiskReward(trade),
      slPct:
        trade.stopLoss !== null
          ? (Math.abs(trade.entryPrice - trade.stopLoss) / trade.entryPrice) * 100
          : null,
    };
  });

  protected readonly execution = computed(() => {
    const trade = this.trade();
    if (!trade) return null;
    return {
      notional: notional(trade),
      margin: notional(trade) / Math.max(1, trade.leverage),
      session: SESSION_LABELS[tradingSession(trade.openedAt)],
      duration:
        trade.status === 'closed' ? formatDuration(trade.openedAt, trade.closedAt) : 'позиция открыта',
    };
  });

  constructor() {
    effect(() => {
      this.noteDraft.set(this.trade()?.notes ?? '');
    });
  }

  // ── Мутации ───────────────────────────────────────────────────────────────

  protected async saveNote(): Promise<void> {
    const trade = this.trade();
    if (!trade) return;
    await this.store.update(trade.id, { notes: this.noteDraft() });
    this.toast.success('Заметка сохранена');
  }

  protected async setGrade(value: string): Promise<void> {
    const trade = this.trade();
    if (!trade) return;
    await this.store.update(trade.id, { setupGrade: value as SetupGrade });
  }

  protected async setMood(value: string | null): Promise<void> {
    const trade = this.trade();
    if (!trade) return;
    await this.store.update(trade.id, { mood: (value as Mood) ?? null });
  }

  protected async setMistakes(values: string[]): Promise<void> {
    const trade = this.trade();
    if (!trade) return;
    await this.store.update(trade.id, { mistakes: values });
  }

  protected async setTags(values: string[]): Promise<void> {
    const trade = this.trade();
    if (!trade) return;
    await this.store.update(trade.id, { tags: values });
  }

  protected async remove(): Promise<void> {
    const trade = this.trade();
    if (!trade) return;
    const ok = await this.confirm.ask({
      title: 'Удалить сделку?',
      message: `${trade.symbol} от ${formatDateTime(trade.openedAt)} будет удалена безвозвратно.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    await this.store.remove(trade.id);
    this.toast.info('Сделка удалена');
    this.router.navigate(['/trades']);
  }

  // ── Форматирование ────────────────────────────────────────────────────────

  protected readonly fmtDateTime = formatDateTime;
  protected readonly fmtPrice = formatPrice;

  protected fmtMoney(value: number | null, sign = false): string {
    return value === null ? '—' : formatMoney(value, { sign });
  }
}
