import { SetupGrade, Trade, TradeSide } from '../../features/trades/data/trade.model';
import { JournalEntry } from '../../features/journal/data/journal.model';
import { SeededRng, hashSeed } from './seeded-rng';
import {
  ACCOUNT_WEIGHTS,
  JOURNAL_DAY_NOTES,
  LOSS_NOTES,
  MISTAKES,
  MOCK_ACCOUNTS,
  OPEN_NOTES,
  STYLES,
  SYMBOLS,
  SymbolMeta,
  TAGS,
  WIN_NOTES,
} from './mock-universe';

const DAY_MS = 86_400_000;

/** Сегодняшняя UTC-полночь — история всегда «живая» и доходит до вчера. */
const TODAY = (() => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
})();

/** Год торговли: последняя закрытая сделка — вчера, открытые — сегодня. */
const HISTORY_END = TODAY - DAY_MS;
const HISTORY_START = HISTORY_END - 365 * DAY_MS;

/**
 * Правдоподобная цена инструмента в момент времени: базовая цена ×
 * годовой дрейф × две синусоиды (циклы рынка) — детерминированно.
 */
export function symbolPriceAt(meta: SymbolMeta, timeMs: number): number {
  const f = (timeMs - HISTORY_START) / (HISTORY_END - HISTORY_START);
  const phase = (hashSeed(meta.symbol) % 628) / 100;
  const wobble =
    0.16 * Math.sin(f * Math.PI * 2 * 2.3 + phase) + 0.07 * Math.sin(f * Math.PI * 2 * 7.1 + phase * 2);
  return meta.basePrice * Math.exp(meta.yearDrift * f + wobble);
}

export function roundPrice(price: number): number {
  const abs = Math.abs(price);
  const decimals = abs >= 1000 ? 1 : abs >= 100 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 5 : 8;
  return Number(price.toFixed(decimals));
}

function roundQty(qty: number, price: number): number {
  if (price >= 10000) return Number(qty.toFixed(3));
  if (price >= 100) return Number(qty.toFixed(2));
  if (price >= 1) return Number(qty.toFixed(1));
  return Math.round(qty);
}

interface GeneratedData {
  trades: Trade[];
  journal: JournalEntry[];
}

export function generateMockData(seed = 20260709): GeneratedData {
  const rng = new SeededRng(seed);
  const trades: Trade[] = [];

  const totalDays = Math.round((HISTORY_END - HISTORY_START) / DAY_MS);

  for (let dayIdx = 0; dayIdx <= totalDays; dayIdx++) {
    const dayStart = HISTORY_START + dayIdx * DAY_MS;
    const weekday = new Date(dayStart).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    // Торгует почти каждый будний день; по выходным — примерно через раз.
    if (!rng.bool(isWeekend ? 0.45 : 0.9)) continue;

    const tradesToday = rng.weighted([
      [1, 30],
      [2, 32],
      [3, 22],
      [4, 10],
      [5, 6],
    ] as const);

    // Стабильно прибыльный трейдер: винрейт 56–68%, растёт к концу года,
    // поверх — медленная синусоида «полос удачи». Вместе с длинным хвостом
    // побед по R это даёт положительный результат почти каждый месяц.
    const progress = dayIdx / totalDays;
    const winRate = 0.56 + progress * 0.08 + 0.04 * Math.sin(dayIdx / 9);

    for (let k = 0; k < tradesToday; k++) {
      trades.push(generateTrade(rng, dayStart, winRate));
    }
  }

  trades.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());

  // Несколько открытых позиций «сегодня» — ранним утром UTC, чтобы не уйти в будущее.
  const openCount = rng.int(2, 4);
  for (let i = 0; i < openCount; i++) {
    trades.push(generateOpenTrade(rng, TODAY + (1 + i * 2) * 3_600_000));
  }

  trades.forEach((t, i) => (t.id = `t-${String(i + 1).padStart(4, '0')}`));

  return { trades, journal: generateJournal(rng, trades) };
}

function generateTrade(rng: SeededRng, dayStart: number, winRate: number): Trade {
  const accountId = rng.weighted(ACCOUNT_WEIGHTS);
  const account = MOCK_ACCOUNTS.find((a) => a.id === accountId)!;
  const isSpot = account.market === 'spot';

  const styleMeta = isSpot
    ? STYLES[2] // спот — только свинг
    : rng.weighted([
        [STYLES[0], 0.3],
        [STYLES[1], 0.45],
        [STYLES[2], 0.25],
      ] as const);

  const symbolMeta = rng.weighted(SYMBOLS.map((s) => [s, s.weight] as const));
  const side: TradeSide = isSpot ? 'long' : rng.bool(0.58) ? 'long' : 'short';

  // Час открытия — с перевесом в Лондон/Нью-Йорк.
  const hour = rng.weighted([
    [rng.int(1, 6), 0.16],
    [rng.int(7, 11), 0.34],
    [rng.int(12, 20), 0.44],
    [rng.int(21, 23), 0.06],
  ] as const);
  const openedMs = dayStart + hour * 3_600_000 + rng.int(0, 59) * 60_000 + rng.int(0, 59) * 1000;
  const durationMin = Math.round(rng.range(styleMeta.durationMin, styleMeta.durationMax));
  const closedMs = openedMs + durationMin * 60_000;

  const entry = roundPrice(symbolPriceAt(symbolMeta, openedMs) * rng.range(0.995, 1.005));
  const slPct = rng.range(styleMeta.slPctMin, styleMeta.slPctMax);
  const slDist = (entry * slPct) / 100;
  const dir = side === 'long' ? 1 : -1;

  const isWin = rng.bool(winRate);
  // R исхода: победы — длинный хвост вправо, поражения — около −1R.
  const rMultiple = isWin
    ? Math.min(9, 0.25 + Math.abs(rng.gaussian(0, 0.9)) + rng.weighted([[0, 0.85], [rng.range(1.5, 4), 0.15]] as const))
    : -rng.weighted([
        [rng.range(0.75, 1.05), 0.8],
        [rng.range(0.3, 0.7), 0.12], // ручное закрытие раньше стопа
        [rng.range(1.2, 1.9), 0.08], // двинул стоп
      ] as const);

  const exit = roundPrice(entry + dir * slDist * rMultiple);
  const plannedRr = rng.weighted([
    [rng.range(1.2, 1.8), 0.35],
    [rng.range(1.8, 2.6), 0.45],
    [rng.range(2.6, 3.6), 0.2],
  ] as const);

  const hasStop = rng.bool(0.93);
  const stopLoss = hasStop ? roundPrice(entry - dir * slDist) : null;
  const takeProfit = rng.bool(0.82) ? roundPrice(entry + dir * slDist * plannedRr) : null;

  // Риск на сделку: 0.4–1.5% от ~30k депозита; иногда превышение (FOMO).
  const overRisk = rng.bool(0.07);
  const riskUsd = Math.round(rng.range(0.004, overRisk ? 0.028 : 0.015) * 30_000);
  const quantity = Math.max(roundQty(riskUsd / slDist, entry), price2minQty(entry));

  const notionalUsd = quantity * entry;
  const leverage = isSpot ? 1 : Math.min(20, Math.max(2, Math.round(notionalUsd / rng.range(400, 2200))));
  const fees = Number((notionalUsd * 0.00045 * 2).toFixed(2));
  const funding =
    styleMeta.style === 'swing' && !isSpot ? Number((notionalUsd * rng.range(-0.0004, 0.001)).toFixed(2)) : 0;

  const grade = rng.weighted([
    ['A+', isWin ? 0.14 : 0.05],
    ['A', isWin ? 0.34 : 0.2],
    ['B', 0.4],
    ['C', isWin ? 0.12 : 0.35],
  ] as (readonly [SetupGrade, number])[]);

  const mistakes = pickMistakes(rng, isWin, overRisk, rMultiple);
  const tags = rng.sample(TAGS, rng.weighted([[0, 0.15], [1, 0.4], [2, 0.32], [3, 0.13]] as const));
  if (overRisk && !tags.includes('FOMO')) tags.push('FOMO');

  const notes = rng.bool(0.38) ? rng.pick(isWin ? WIN_NOTES : LOSS_NOTES) : '';

  return {
    id: '',
    accountId,
    symbol: symbolMeta.symbol,
    market: account.market,
    side,
    leverage,
    quantity,
    entryPrice: entry,
    exitPrice: exit,
    stopLoss,
    takeProfit,
    riskUsd,
    status: 'closed',
    openedAt: new Date(openedMs).toISOString(),
    closedAt: new Date(closedMs).toISOString(),
    fees,
    funding,
    strategy: rng.pick(styleMeta.strategies),
    timeframe: rng.pick(styleMeta.timeframes),
    setupGrade: grade,
    mistakes,
    tags,
    notes,
  };
}

function generateOpenTrade(rng: SeededRng, openedMs: number): Trade {
  const accountId = rng.weighted(ACCOUNT_WEIGHTS.slice(0, 2));
  const symbolMeta = rng.weighted(SYMBOLS.slice(0, 5).map((s) => [s, s.weight] as const));
  const side: TradeSide = rng.bool(0.6) ? 'long' : 'short';
  const dir = side === 'long' ? 1 : -1;
  const entry = roundPrice(symbolPriceAt(symbolMeta, openedMs));
  const slPct = rng.range(0.8, 2.2);
  const slDist = (entry * slPct) / 100;
  const riskUsd = Math.round(rng.range(120, 420));
  const quantity = Math.max(roundQty(riskUsd / slDist, entry), price2minQty(entry));

  return {
    id: '',
    accountId,
    symbol: symbolMeta.symbol,
    market: 'futures',
    side,
    leverage: rng.int(3, 12),
    quantity,
    entryPrice: entry,
    exitPrice: 0,
    stopLoss: roundPrice(entry - dir * slDist),
    takeProfit: roundPrice(entry + dir * slDist * rng.range(1.8, 3)),
    riskUsd,
    status: 'open',
    openedAt: new Date(openedMs).toISOString(),
    closedAt: '',
    fees: 0,
    funding: 0,
    strategy: rng.pick(STYLES[1].strategies),
    timeframe: rng.pick(['15m', '1h']),
    setupGrade: rng.pick(['A', 'B'] as const),
    mistakes: [],
    tags: rng.sample(TAGS, 1),
    notes: rng.pick(OPEN_NOTES),
  };
}

function pickMistakes(rng: SeededRng, isWin: boolean, overRisk: boolean, rMultiple: number): string[] {
  const result: string[] = [];
  if (overRisk) result.push('Превышен риск');
  if (rMultiple < -1.15) result.push('Двинул стоп');
  if (!isWin && rng.bool(0.45)) {
    const extra = rng.sample(
      MISTAKES.filter((m) => !result.includes(m)),
      rng.bool(0.25) ? 2 : 1,
    );
    result.push(...extra);
  }
  if (isWin && rng.bool(0.08)) result.push('Рано зафиксировал');
  return result;
}

function price2minQty(price: number): number {
  if (price >= 10000) return 0.001;
  if (price >= 100) return 0.01;
  if (price >= 1) return 0.1;
  return 1;
}

function generateJournal(rng: SeededRng, trades: readonly Trade[]): JournalEntry[] {
  const byDay = new Set<string>();
  for (const t of trades) {
    if (t.status === 'closed') byDay.add(t.openedAt.slice(0, 10));
  }
  const entries: JournalEntry[] = [];
  for (const date of [...byDay].sort()) {
    if (!rng.bool(0.42)) continue;
    entries.push({
      date,
      note: rng.pick(JOURNAL_DAY_NOTES),
      mood: rng.pick(['confident', 'calm', 'neutral', 'anxious'] as const),
      followedPlan: rng.bool(0.75),
    });
  }
  return entries;
}
