import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { TradesStore } from '../trades/trades-store';
import { Trade, calculatePnl, formatMoney, isWin, localDay } from '../trades/data/trade.model';
import { ToastService } from '../../shared/ui/toast';
import { DisciplineStore } from './discipline-store';
import { PortfolioStore } from './portfolio-store';
import { DaySummary, daySummary } from './data/session';
import { plural, tagsOf } from './data/behavior';

export type SessionAlertTone = 'danger' | 'warn';

/** Живое предупреждение дисциплины за сегодня. */
export interface SessionAlert {
  id: string;
  tone: SessionAlertTone;
  title: string;
  text: string;
  /** Когда случилось — для порядка в ленте. */
  at: number;
  tradeId?: string;
}

/** Часы сессии тикают раз в полминуты: смена дня и «в позиции N мин». */
const CLOCK_MS = 30_000;
/** Доля лимита, после которой предупреждаем заранее. */
const LIMIT_WARN = 0.75;

/**
 * Сегодняшняя сессия по выбранному счёту — независимо от глобального периода:
 * итог дня, серия, лимит, открытые позиции и предупреждения дисциплины.
 * Новые предупреждения (не те, что были при загрузке) всплывают тостом.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly tradesStore = inject(TradesStore);
  private readonly discipline = inject(DisciplineStore);
  private readonly portfolio = inject(PortfolioStore);
  private readonly toast = inject(ToastService);

  private readonly clock = signal(Date.now());

  readonly now = this.clock.asReadonly();
  readonly day = computed(() => localDay(this.clock()));
  readonly settings = this.discipline.settings;
  readonly hasLoaded = this.tradesStore.hasLoaded;

  readonly summary = computed<DaySummary>(() =>
    daySummary(this.tradesStore.accountScoped(), this.day()),
  );

  readonly positions = this.portfolio.positions;
  readonly unrealizedPnl = computed(() =>
    this.positions().reduce((s, p) => s + p.unrealizedPnl, 0),
  );

  /** Доля дневного лимита убытка, 0..1+; null — лимит не задан. */
  readonly limitUsage = computed<number | null>(() => {
    const limit = this.settings().dailyLossLimit;
    if (!limit) return null;
    return Math.max(0, -this.summary().net) / limit;
  });

  /** Сделки, открытые сегодня, по времени входа. */
  private readonly enteredToday = computed<Trade[]>(() => {
    const day = this.day();
    return this.tradesStore
      .accountScoped()
      .filter((t) => localDay(t.openedAt) === day)
      .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  });

  /** Как сделки «после серии» шли раньше — довод для паузы. */
  private readonly tiltHistory = computed(() => {
    const tags = this.tradesStore.tags();
    const closed = this.tradesStore.accountScoped().filter((t) => t.status === 'closed');
    const tilted = closed.filter((t) => tagsOf(tags, t).includes('tilt'));
    const rest = closed.filter((t) => !tagsOf(tags, t).includes('tilt'));
    const rate = (list: Trade[]) =>
      list.length ? list.filter((t) => isWin(calculatePnl(t))).length / list.length : 0;
    return tilted.length >= 15 ? { after: rate(tilted), usual: rate(rest) } : null;
  });

  readonly alerts = computed<SessionAlert[]>(() => {
    const s = this.settings();
    const summary = this.summary();
    const tags = this.tradesStore.tags();
    const now = this.clock();
    const alerts: SessionAlert[] = [];

    const usage = this.limitUsage();
    if (usage !== null && s.dailyLossLimit) {
      if (usage >= 1) {
        alerts.push({
          id: `limit-hit-${summary.day}`,
          tone: 'danger',
          title: 'Дневной лимит выбран',
          text: `Итог дня ${formatMoney(summary.net, { sign: true })} при лимите ${formatMoney(s.dailyLossLimit)}. Дальше — только хуже: на сегодня всё.`,
          at: now,
        });
      } else if (usage >= LIMIT_WARN) {
        alerts.push({
          id: `limit-near-${summary.day}`,
          tone: 'warn',
          title: 'Лимит почти выбран',
          text: `${Math.round(usage * 100)}% дневного лимита: до него ${formatMoney(s.dailyLossLimit + summary.net)}.`,
          at: now,
        });
      }
    }

    if (summary.lossStreak >= s.pauseAfterLosses) {
      const h = this.tiltHistory();
      const proof = h
        ? ` Раньше после такой серии винрейт был ${Math.round(h.after * 100)}% против обычных ${Math.round(h.usual * 100)}%.`
        : '';
      alerts.push({
        id: `streak-${summary.day}-${summary.lossStreak}`,
        tone: 'warn',
        title: `${summary.lossStreak} ${plural(summary.lossStreak, 'убыток', 'убытка', 'убытков')} подряд — пауза`,
        text: `Отойдите от терминала хотя бы на 15 минут.${proof}`,
        at: now,
      });
    }

    const entered = this.enteredToday();
    if (entered.length > s.maxTrades) {
      alerts.push({
        id: `overtrade-${summary.day}`,
        tone: 'warn',
        title: 'Овертрейд',
        text: `${entered.length} ${plural(entered.length, 'сделка', 'сделки', 'сделок')} за день при вашей норме ${s.maxTrades}.`,
        at: new Date(entered[s.maxTrades].openedAt).getTime(),
      });
    }

    for (const t of entered) {
      const revenge = tags.get(t.id)?.find((m) => m.tag === 'revenge');
      if (!revenge) continue;
      alerts.push({
        id: `revenge-${t.id}`,
        tone: 'warn',
        title: `Реванш в ${t.symbol}`,
        text: `${revenge.reason}.`,
        at: new Date(t.openedAt).getTime(),
        tradeId: t.id,
      });
    }

    return alerts.sort((a, b) => b.at - a.at);
  });

  constructor() {
    const timer = setInterval(() => this.clock.set(Date.now()), CLOCK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    this.watchAlerts();
  }

  /** Тосты только на новые предупреждения: то, что было при загрузке, не повторяем. */
  private watchAlerts(): void {
    let seen: Set<string> | null = null;
    effect(() => {
      const alerts = this.alerts();
      if (!this.hasLoaded()) return;
      untracked(() => {
        if (seen === null) {
          seen = new Set(alerts.map((a) => a.id));
          return;
        }
        for (const alert of alerts) {
          if (seen.has(alert.id)) continue;
          seen.add(alert.id);
          this.toast.warn(alert.title, alert.text);
        }
      });
    });
  }
}
