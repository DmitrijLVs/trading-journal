import {
  Trade,
  calculatePnl,
  durationMs,
  formatMoney,
  formatSpan,
  isLoss,
  isWin,
  localDay,
} from '../../trades/data/trade.model';
import { DisciplineSettings } from './discipline.model';

/**
 * Автотеги — разбор, который система делает сама по фактам биржи: реванш,
 * тильт, овертрейд, передержанный убыток, сделка, съеденная комиссией.
 * Чистые функции: считаются по всей истории счёта, чтобы «реванш» видел
 * предыдущую сделку, даже если она за границей периода.
 */
export type AutoTag = 'revenge' | 'tilt' | 'overtrade' | 'held-loser' | 'fee-eaten';

export const AUTO_TAGS: readonly AutoTag[] = ['revenge', 'tilt', 'overtrade', 'held-loser', 'fee-eaten'];

export const AUTO_TAG_LABELS: Record<AutoTag, string> = {
  revenge: 'Реванш',
  tilt: 'После серии убытков',
  overtrade: 'Овертрейд',
  'held-loser': 'Передержал убыток',
  'fee-eaten': 'Съедено комиссией',
};

/** Коротко — для чипов в таблице и журнале; полное название — в разборе. */
export const AUTO_TAG_SHORT: Record<AutoTag, string> = {
  revenge: 'реванш',
  tilt: 'тильт',
  overtrade: 'овертрейд',
  'held-loser': 'передержка',
  'fee-eaten': 'комиссия',
};

/** Ключ группы сделок без единого автотега. */
export const CLEAN_TAG_LABEL = 'Без ошибок';

export function isAutoTag(value: unknown): value is AutoTag {
  return typeof value === 'string' && (AUTO_TAGS as readonly string[]).includes(value);
}

export function autoTagHint(tag: AutoTag, s: DisciplineSettings): string {
  switch (tag) {
    case 'revenge':
      return `Вход в ту же монету в течение ${s.revengeMinutes} мин после убыточной сделки`;
    case 'tilt':
      return `Вход после ${s.pauseAfterLosses}+ убытков подряд, без паузы`;
    case 'overtrade':
      return `Сделка сверх нормы ${s.maxTrades} в день`;
    case 'held-loser':
      return 'Убыточная сделка, которую держали вдвое дольше обычной прибыльной';
    case 'fee-eaten':
      return 'До комиссий в плюсе, после — в минусе';
  }
}

/** Тег сделки с объяснением, почему он поставлен. */
export interface TagMark {
  tag: AutoTag;
  reason: string;
}

export type TradeTags = ReadonlyMap<string, readonly TagMark[]>;

/** Серия убытков «остывает», если последний закрыт раньше этого. */
const TILT_COOLDOWN_MS = 2 * 3_600_000;
/** Передержка — убыточная дольше медианы прибыльных во столько раз. */
const HELD_FACTOR = 2;

const time = (iso: string) => new Date(iso).getTime();

/** Размечает сделки автотегами. Сделки без тегов в карту не попадают. */
export function autoTags(trades: readonly Trade[], s: DisciplineSettings): TradeTags {
  const marks = new Map<string, TagMark[]>();
  const add = (trade: Trade, mark: TagMark) => {
    const list = marks.get(trade.id) ?? [];
    list.push(mark);
    marks.set(trade.id, list);
  };

  const closed = closedByClose(trades);
  const byOpen = [...trades].sort((a, b) => time(a.openedAt) - time(b.openedAt));

  // Реванш: предыдущий убыток в той же монете того же счёта — недавно.
  const lastLoss = new Map<string, Trade[]>();
  for (const t of closed) {
    if (!isLoss(calculatePnl(t))) continue;
    const key = `${t.accountId}:${t.symbol}`;
    lastLoss.set(key, [...(lastLoss.get(key) ?? []), t]);
  }
  const windowMs = s.revengeMinutes * 60_000;
  for (const t of byOpen) {
    const losses = lastLoss.get(`${t.accountId}:${t.symbol}`);
    if (!losses) continue;
    const open = time(t.openedAt);
    const prev = latestBefore(losses, open);
    if (prev && prev.id !== t.id && open - time(prev.closedAt) <= windowMs) {
      const gap = Math.max(1, Math.round((open - time(prev.closedAt)) / 60_000));
      add(t, {
        tag: 'revenge',
        reason: `Вход через ${gap} мин после убытка ${formatMoney(calculatePnl(prev))} в ${t.symbol}`,
      });
    }
  }

  // Тильт: серия убытков, закрытых до входа, не успела остыть.
  const streaks = lossStreakBefore(trades);
  for (const t of byOpen) {
    const streak = streaks.get(t.id);
    if (streak && streak.count >= s.pauseAfterLosses && time(t.openedAt) - streak.lastLossAt <= TILT_COOLDOWN_MS) {
      add(t, { tag: 'tilt', reason: `${streak.count} ${plural(streak.count, 'убыток', 'убытка', 'убытков')} подряд перед входом` });
    }
  }

  // Овертрейд: сделка сверх дневной нормы (по дню входа).
  const perDay = new Map<string, number>();
  for (const t of byOpen) {
    const day = localDay(t.openedAt);
    const n = (perDay.get(day) ?? 0) + 1;
    perDay.set(day, n);
    if (n > s.maxTrades) add(t, { tag: 'overtrade', reason: `${n}-я сделка дня при норме ${s.maxTrades}` });
  }

  // Передержанный убыток: держали вдвое дольше типичной прибыльной.
  const winHold = median(
    closed.filter((t) => !t.carriedIn && isWin(calculatePnl(t))).map(durationMs),
  );
  if (winHold > 0) {
    for (const t of closed) {
      const hold = durationMs(t);
      if (!t.carriedIn && isLoss(calculatePnl(t)) && hold > winHold * HELD_FACTOR) {
        add(t, {
          tag: 'held-loser',
          reason: `В позиции ${formatSpan(hold)}, прибыльные обычно ${formatSpan(winHold)}`,
        });
      }
    }
  }

  // Съедено комиссией: биржевой результат в плюсе, итог — в минусе.
  for (const t of closed) {
    if (t.realizedPnl > 0 && t.netPnl < 0) {
      add(t, {
        tag: 'fee-eaten',
        reason: `До комиссий ${formatMoney(t.realizedPnl, { sign: true })}, после ${formatMoney(t.netPnl, { sign: true })}`,
      });
    }
  }

  return marks;
}

export interface StreakBefore {
  /** Убытков подряд, закрытых до входа в сделку. */
  count: number;
  lastLossAt: number;
}

/** Серия убытков перед входом в каждую сделку (закрытые до момента входа). */
export function lossStreakBefore(trades: readonly Trade[]): ReadonlyMap<string, StreakBefore> {
  const closed = closedByClose(trades);
  const byOpen = [...trades].sort((a, b) => time(a.openedAt) - time(b.openedAt));
  const result = new Map<string, StreakBefore>();
  let j = 0;
  let count = 0;
  let lastLossAt = 0;
  for (const t of byOpen) {
    const open = time(t.openedAt);
    while (j < closed.length && time(closed[j].closedAt) <= open) {
      const pnl = calculatePnl(closed[j]);
      if (isLoss(pnl)) {
        count++;
        lastLossAt = time(closed[j].closedAt);
      } else if (isWin(pnl)) {
        count = 0;
      }
      j++;
    }
    result.set(t.id, { count, lastLossAt });
  }
  return result;
}

/** Теги сделок одной строкой для фильтра/группировки. */
export function tagsOf(tags: TradeTags, trade: Trade): readonly AutoTag[] {
  return (tags.get(trade.id) ?? []).map((m) => m.tag);
}

function closedByClose(trades: readonly Trade[]): Trade[] {
  return trades
    .filter((t) => t.status === 'closed')
    .sort((a, b) => time(a.closedAt) - time(b.closedAt));
}

/** Последняя сделка списка (по закрытию), закрытая не позже `ms`. */
function latestBefore(sorted: readonly Trade[], ms: number): Trade | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let found: Trade | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time(sorted[mid].closedAt) <= ms) {
      found = sorted[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
