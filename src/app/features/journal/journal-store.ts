import { Injectable, computed, inject } from '@angular/core';
import { TradesStore } from '../trades/trades-store';
import { Trade, calculatePnl, isLoss, isWin, localDay } from '../trades/data/trade.model';
import { AUTO_TAGS, AutoTag, tagsOf } from '../analytics/data/behavior';
import { PeriodSummary, greenStreak, periodSummaries } from '../analytics/data/periods';
import { SessionStore } from '../analytics/session-store';

export interface JournalDay {
  date: string;
  pnl: number;
  /** Биржевой результат до комиссий и фандинга. */
  gross: number;
  fees: number;
  /** Закрытые за день — по времени закрытия. */
  trades: readonly Trade[];
  wins: number;
  losses: number;
  /** Накопленный итог дня после каждой сделки — для мини-кривой. */
  curve: readonly number[];
  /** Сколько сделок дня с каждым автотегом (только непустые). */
  tags: readonly { tag: AutoTag; count: number }[];
}

/** Журнал дней: торговые дни текущего скоупа (по дате закрытия, в зоне пользователя). */
@Injectable({ providedIn: 'root' })
export class JournalStore {
  private readonly tradesStore = inject(TradesStore);
  private readonly session = inject(SessionStore);

  readonly isLoading = this.tradesStore.isLoading;

  /**
   * Недели и месяцы — по всей истории счёта, не по периоду анализа: обрезанная
   * фильтром неделя вводила бы в заблуждение.
   */
  readonly weeks = computed<readonly PeriodSummary[]>(() =>
    periodSummaries(this.tradesStore.accountScoped(), this.tradesStore.tags(), 'week', this.session.day()),
  );
  readonly months = computed<readonly PeriodSummary[]>(() =>
    periodSummaries(this.tradesStore.accountScoped(), this.tradesStore.tags(), 'month', this.session.day()),
  );
  readonly weekStreak = computed(() => greenStreak(this.weeks()));
  readonly monthStreak = computed(() => greenStreak(this.months()));

  /** Дни с закрытыми сделками, новые сверху. */
  readonly days = computed<readonly JournalDay[]>(() => {
    const tags = this.tradesStore.tags();
    const byDate = new Map<string, Trade[]>();
    for (const trade of this.tradesStore.scoped()) {
      if (trade.status !== 'closed') continue;
      const date = localDay(trade.closedAt);
      byDate.set(date, [...(byDate.get(date) ?? []), trade]);
    }
    return [...byDate.entries()]
      .map(([date, list]) => toDay(date, list, (t) => tagsOf(tags, t)))
      .sort((a, b) => b.date.localeCompare(a.date));
  });
}

function toDay(date: string, list: Trade[], tagsFor: (t: Trade) => readonly AutoTag[]): JournalDay {
  const trades = [...list].sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  const pnls = trades.map(calculatePnl);
  let total = 0;
  const counts = new Map<AutoTag, number>();
  for (const t of trades) for (const tag of tagsFor(t)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return {
    date,
    pnl: pnls.reduce((s, v) => s + v, 0),
    gross: trades.reduce((s, t) => s + t.realizedPnl, 0),
    fees: trades.reduce((s, t) => s + t.fees, 0),
    trades,
    wins: pnls.filter(isWin).length,
    losses: pnls.filter(isLoss).length,
    curve: [0, ...pnls.map((v) => (total += v))],
    tags: AUTO_TAGS.filter((tag) => counts.has(tag)).map((tag) => ({ tag, count: counts.get(tag) ?? 0 })),
  };
}
