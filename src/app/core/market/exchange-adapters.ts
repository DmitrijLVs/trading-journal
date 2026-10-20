import { Candle, CandleQuery, MarketExchange, TIMEFRAME_MS, Timeframe } from './market.model';

/** Публичный REST-запрос свечей (без ключей, биржи отдают его с CORS). */
export interface KlinesRequest {
  url: string;
  params: Record<string, string>;
}

export interface StreamTick {
  topic: string;
  candle: Candle;
}

/** Протокол биржи: REST-страница свечей и kline-поток WebSocket. */
export interface ExchangeAdapter {
  /** Сколько свечей биржа отдаёт за один запрос. */
  readonly pageLimit: number;
  readonly streamUrl: string;
  /** Сообщение-пинг приложения (null — хватает пингов протокола). */
  readonly ping: string | null;
  klines(query: CandleQuery): KlinesRequest;
  /** Свечи ответа по возрастанию времени. */
  parseKlines(body: unknown): Candle[];
  topic(symbol: string, timeframe: Timeframe): string;
  subscribe(topics: readonly string[]): string;
  unsubscribe(topics: readonly string[]): string;
  parseStream(data: string): StreamTick[];
}

const BYBIT_INTERVAL: Readonly<Record<Timeframe, string>> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
};

/** Дневки OKX без суффикса `utc` открываются по Гонконгу — берём UTC-вариант. */
const OKX_BAR: Readonly<Record<Timeframe, string>> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1Dutc',
};

const QUOTE_ASSETS = ['USDT', 'USDC', 'USD'];

/** `BTCUSDT` → `BTC-USDT-SWAP` (перпетуалы OKX). */
export function toOkxInstId(symbol: string): string {
  const flat = symbol.toUpperCase().replace(/[/_-]/g, '');
  for (const quote of QUOTE_ASSETS) {
    if (flat.endsWith(quote) && flat.length > quote.length) {
      return `${flat.slice(0, -quote.length)}-${quote}-SWAP`;
    }
  }
  return flat;
}

function candleOf(row: readonly unknown[], volumeAt: number): Candle | null {
  const candle = [0, 1, 2, 3, 4, volumeAt].map((k) => Number(row[k]));
  return candle.every((value) => Number.isFinite(value)) && candle[0] > 0 ? candle : null;
}

function ascending(rows: (Candle | null)[]): Candle[] {
  return rows.filter((row): row is Candle => row !== null).sort((a, b) => a[0] - b[0]);
}

function parseJson(data: string): unknown {
  if (!data || (data[0] !== '{' && data[0] !== '[')) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** Binance USDⓈ-M futures: `/fapi/v1/klines`, kline-стримы. */
function binance(): ExchangeAdapter {
  let requestId = 0;
  const message = (method: string, params: readonly string[]) =>
    JSON.stringify({ method, params, id: ++requestId });
  return {
    pageLimit: 1500,
    streamUrl: 'wss://fstream.binance.com/market/ws',
    ping: null,
    klines: (q) => {
      const params: Record<string, string> = {
        symbol: q.symbol.toUpperCase(),
        interval: q.timeframe,
        limit: String(Math.min(q.limit, 1500)),
      };
      if (q.before !== undefined) params['endTime'] = String(q.before - 1);
      if (q.after !== undefined) params['startTime'] = String(q.after + 1);
      return { url: 'https://fapi.binance.com/fapi/v1/klines', params };
    },
    parseKlines: (body) =>
      Array.isArray(body) ? ascending(body.map((row: unknown[]) => candleOf(row, 5))) : [],
    topic: (symbol, tf) => `${symbol.toLowerCase()}@kline_${tf}`,
    subscribe: (topics) => message('SUBSCRIBE', topics),
    unsubscribe: (topics) => message('UNSUBSCRIBE', topics),
    parseStream: (data) => {
      const parsed = record(parseJson(data));
      const payload = record(parsed?.['data']) ?? parsed;
      const k = record(payload?.['k']);
      if (payload?.['e'] !== 'kline' || !k || typeof payload['s'] !== 'string') return [];
      const candle = candleOf([k['t'], k['o'], k['h'], k['l'], k['c'], k['v']], 5);
      const topic = `${payload['s'].toLowerCase()}@kline_${String(k['i'])}`;
      return candle ? [{ topic, candle }] : [];
    },
  };
}

/** Bybit v5 linear: `/v5/market/kline` (новые первыми), топики `kline.<bar>.<symbol>`. */
function bybit(): ExchangeAdapter {
  let requestId = 0;
  const message = (op: string, args: readonly string[]) =>
    JSON.stringify({ op, args, req_id: String(++requestId) });
  return {
    pageLimit: 1000,
    streamUrl: 'wss://stream.bybit.com/v5/public/linear',
    ping: '{"op":"ping"}',
    klines: (q) => {
      const limit = Math.min(q.limit, 1000);
      const params: Record<string, string> = {
        category: 'linear',
        symbol: q.symbol.toUpperCase(),
        interval: BYBIT_INTERVAL[q.timeframe],
        limit: String(limit),
      };
      if (q.before !== undefined) params['end'] = String(q.before - 1);
      if (q.after !== undefined) {
        // Без `end` Bybit отдаёт самые новые свечи — ограничиваем окно сверху.
        params['start'] = String(q.after + 1);
        params['end'] = String(q.after + limit * TIMEFRAME_MS[q.timeframe]);
      }
      return { url: 'https://api.bybit.com/v5/market/kline', params };
    },
    parseKlines: (body) => {
      const list = record(record(body)?.['result'])?.['list'];
      return Array.isArray(list) ? ascending(list.map((row: unknown[]) => candleOf(row, 5))) : [];
    },
    topic: (symbol, tf) => `kline.${BYBIT_INTERVAL[tf]}.${symbol.toUpperCase()}`,
    subscribe: (topics) => message('subscribe', topics),
    unsubscribe: (topics) => message('unsubscribe', topics),
    parseStream: (data) => {
      const parsed = record(parseJson(data));
      const topic = parsed?.['topic'];
      const rows = parsed?.['data'];
      if (typeof topic !== 'string' || !topic.startsWith('kline.') || !Array.isArray(rows)) {
        return [];
      }
      return ascending(
        rows.map((row: Record<string, unknown>) =>
          candleOf([row['start'], row['open'], row['high'], row['low'], row['close'], row['volume']], 5),
        ),
      ).map((candle) => ({ topic, candle }));
    },
  };
}

/** OKX v5 SWAP: `history-candles` (до 100 за раз, новые первыми), канал `candle<bar>`. */
function okx(): ExchangeAdapter {
  const message = (op: string, topics: readonly string[]) =>
    JSON.stringify({
      op,
      args: topics.map((topic) => {
        const [channel, instId] = topic.split(':');
        return { channel, instId };
      }),
    });
  // Объём SWAP в контрактах (колонка 5); в базовой валюте — колонка 6.
  const okxCandle = (row: unknown[]) => candleOf(row, 6);
  return {
    pageLimit: 100,
    streamUrl: 'wss://ws.okx.com:8443/ws/v5/business',
    ping: 'ping',
    klines: (q) => {
      const limit = Math.min(q.limit, 100);
      const params: Record<string, string> = {
        instId: toOkxInstId(q.symbol),
        bar: OKX_BAR[q.timeframe],
        limit: String(limit),
      };
      // У OKX `after` — «старше чем», `before` — «новее чем».
      if (q.before !== undefined) params['after'] = String(q.before);
      if (q.after !== undefined) {
        params['before'] = String(q.after);
        params['after'] = String(q.after + (limit + 1) * TIMEFRAME_MS[q.timeframe]);
      }
      return { url: 'https://www.okx.com/api/v5/market/history-candles', params };
    },
    parseKlines: (body) => {
      const rows = record(body)?.['data'];
      return Array.isArray(rows) ? ascending(rows.map(okxCandle)) : [];
    },
    topic: (symbol, tf) => `candle${OKX_BAR[tf]}:${toOkxInstId(symbol)}`,
    subscribe: (topics) => message('subscribe', topics),
    unsubscribe: (topics) => message('unsubscribe', topics),
    parseStream: (data) => {
      const parsed = record(parseJson(data));
      const arg = record(parsed?.['arg']);
      const rows = parsed?.['data'];
      const channel = arg?.['channel'];
      if (typeof channel !== 'string' || !channel.startsWith('candle') || !Array.isArray(rows)) {
        return [];
      }
      const topic = `${channel}:${String(arg?.['instId'])}`;
      return ascending(rows.map(okxCandle)).map((candle) => ({ topic, candle }));
    },
  };
}

export function exchangeAdapter(exchange: MarketExchange): ExchangeAdapter {
  switch (exchange) {
    case 'bybit':
      return bybit();
    case 'okx':
      return okx();
    default:
      return binance();
  }
}
