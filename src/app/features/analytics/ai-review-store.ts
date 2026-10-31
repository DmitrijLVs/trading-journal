import { Injectable, inject, signal } from '@angular/core';
import { apiErrorMessage } from '../../core/http/api-error';
import { ManualTagsStore } from '../trades/manual-tags-store';
import { TradeChartData } from '../trades/data/trade-chart.model';
import { Trade } from '../trades/data/trade.model';
import { TradesStore } from '../trades/trades-store';
import { AiApi, AiReview, AiReviewKind } from './data/ai-api';
import { dayFacts, priceAction, tradeFacts } from './data/ai-facts';
import { DisciplineStore } from './discipline-store';

export type AiReviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; review: AiReview }
  | { status: 'error'; message: string };

const IDLE: AiReviewState = { status: 'idle' };
const STORAGE_KEY = 'tj.ai-reviews';
/** Разборов в кэше браузера — повторное открытие сделки не тратит запрос. */
const CACHE_SIZE = 60;

/**
 * «Разбор от ИИ» сделки и торгового дня: собирает факты из сторов журнала,
 * спрашивает сервер и помнит ответ. Ключ ответа меняется вместе с данными
 * (сделка закрылась, в день добавились сделки, теги поменялись) — тогда
 * разбор нужно запросить заново.
 */
@Injectable({ providedIn: 'root' })
export class AiReviewStore {
  private readonly api = inject(AiApi);
  private readonly trades = inject(TradesStore);
  private readonly manualTags = inject(ManualTagsStore);
  private readonly discipline = inject(DisciplineStore);
  private readonly states = signal<ReadonlyMap<string, AiReviewState>>(restore());

  /** Состояние разбора по ключу (читать внутри computed/шаблона — реактивно). */
  stateOf(key: string): AiReviewState {
    return this.states().get(key) ?? IDLE;
  }

  tradeKey(trade: Trade): string {
    return `trade:${trade.id}:${trade.status}:${this.manualTags.tagsOf(trade.id).join(',')}`;
  }

  dayKey(date: string, trades: readonly Trade[]): string {
    const net = trades.reduce((sum, t) => sum + t.netPnl, 0);
    return `day:${date}:${trades.length}:${net.toFixed(2)}`;
  }

  reviewTrade(trade: Trade, chart: TradeChartData | null): void {
    const previous = this.trades
      .accountScoped()
      .filter(
        (t) =>
          t.id !== trade.id &&
          t.accountId === trade.accountId &&
          t.status === 'closed' &&
          Date.parse(t.closedAt) <= Date.parse(trade.openedAt),
      )
      .sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt));
    const facts = tradeFacts({
      trade,
      marks: this.trades.tags().get(trade.id) ?? [],
      manualTags: this.manualTags.tagsOf(trade.id),
      fills: chart?.fills ?? [],
      priceAction: chart ? priceAction(trade, chart.candles, chart.timeframe) : null,
      previous,
      rules: this.discipline.settings(),
    });
    void this.run(this.tradeKey(trade), 'trade', facts);
  }

  reviewDay(date: string, dayTrades: readonly Trade[]): void {
    const marks = this.trades.tags();
    const facts = dayFacts({
      date,
      trades: dayTrades,
      marksOf: (t) => marks.get(t.id) ?? [],
      manualTagsOf: (t) => this.manualTags.tagsOf(t.id),
      rules: this.discipline.settings(),
    });
    void this.run(this.dayKey(date, dayTrades), 'day', facts);
  }

  private async run(key: string, kind: AiReviewKind, facts: Record<string, unknown>): Promise<void> {
    if (this.stateOf(key).status === 'loading') return;
    this.set(key, { status: 'loading' });
    try {
      const review = await this.api.review(kind, facts);
      this.set(key, { status: 'done', review });
      persist(this.states());
    } catch (error) {
      this.set(key, { status: 'error', message: apiErrorMessage(error, 'ИИ не ответил — попробуйте ещё раз') });
    }
  }

  private set(key: string, state: AiReviewState): void {
    this.states.update((states) => {
      const next = new Map(states);
      next.delete(key);
      next.set(key, state);
      return next;
    });
  }
}

function restore(): ReadonlyMap<string, AiReviewState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries = raw ? (JSON.parse(raw) as [string, AiReview][]) : [];
    return new Map(entries.map(([key, review]) => [key, { status: 'done', review }]));
  } catch {
    return new Map();
  }
}

/** Только готовые разборы, последние CACHE_SIZE. */
function persist(states: ReadonlyMap<string, AiReviewState>): void {
  const done: [string, AiReview][] = [];
  for (const [key, state] of states) if (state.status === 'done') done.push([key, state.review]);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done.slice(-CACHE_SIZE)));
  } catch {
    // приватный режим — разборы живут до перезагрузки
  }
}
