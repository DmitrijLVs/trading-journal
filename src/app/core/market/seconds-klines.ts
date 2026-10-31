import { Candle, CandleQuery, SecondsTimeframe, TIMEFRAME_MS } from './market.model';
import { KlinesRequest } from './exchange-adapters';

/**
 * Секундные свечи Binance USDⓈ-M с прокси wintrading: биржа их не отдаёт,
 * бары собирает пайплайн wintrading из потока сделок. Ответ —
 * `[время (мс), open, high, low, close, объём (база), сделок]`, бары есть только
 * у секунд со сделками, история — последние сутки, страницы — только по `endTime`.
 */
const SECONDS_URL = 'https://wintrading-proxy-server-oc2nu.ondigitalocean.app/api/klines';
/** Прокси отдаёт и 20 000 за раз, но больше страницы Binance графику не нужно. */
const SECONDS_PAGE_LIMIT = 1500;

/**
 * Запрос страницы. `after` прокси не понимает — просим окно, которое кончается
 * через `limit` баров после `after` (не позже `now`), лишнее отсекает источник.
 */
export function secondsKlines(q: CandleQuery<SecondsTimeframe>, now: number): KlinesRequest {
  const limit = Math.min(q.limit, SECONDS_PAGE_LIMIT);
  const params: Record<string, string> = {
    symbol: q.symbol.toUpperCase(),
    interval: q.timeframe,
    limit: String(limit),
    exchange: 'BINANCE_FUTURES',
  };
  if (q.before !== undefined) {
    params['endTime'] = String(q.before - 1);
  } else if (q.after !== undefined) {
    params['endTime'] = String(Math.min(now, q.after + limit * TIMEFRAME_MS[q.timeframe]));
  }
  return { url: SECONDS_URL, params };
}

export function parseSecondsKlines(body: unknown): Candle[] {
  if (!Array.isArray(body)) return [];
  const rows: Candle[] = [];
  for (const row of body) {
    if (!Array.isArray(row)) continue;
    const candle = [0, 1, 2, 3, 4, 5].map((k) => Number(row[k]));
    if (candle.every((value) => Number.isFinite(value)) && candle[0] > 0) rows.push(candle);
  }
  return rows.sort((a, b) => a[0] - b[0]);
}

/**
 * Живой секундный бар из потока сделок — как у wintrading: первая сделка
 * интервала открывает бар, следующие двигают его; секунды без сделок бара не дают.
 */
export class SecondsBarBuilder {
  private bar: Candle | null = null;

  constructor(private readonly step: number) {}

  /** Сделка `[время, цена ×4, количество]` → текущий бар (null — сделка из прошлого бара). */
  add(trade: Candle): Candle | null {
    const [time, price, , , , qty] = trade;
    const open = Math.floor(time / this.step) * this.step;
    const bar = this.bar;
    if (bar && open < bar[0]) return null;
    if (bar && open === bar[0]) {
      bar[2] = Math.max(bar[2], price);
      bar[3] = Math.min(bar[3], price);
      bar[4] = price;
      bar[5] += qty;
      return [...bar];
    }
    const fresh: Candle = [open, price, price, price, price, qty];
    this.bar = fresh;
    return [...fresh];
  }
}
