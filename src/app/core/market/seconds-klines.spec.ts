import { describe, expect, it } from 'vitest';
import { exchangeAdapter } from './exchange-adapters';
import { SecondsBarBuilder, parseSecondsKlines, secondsKlines } from './seconds-klines';
import { secondsAvailable } from './market.model';

describe('seconds klines', () => {
  it('asks the wintrading proxy for a window ending `limit` bars after `after`, not past now', () => {
    const now = 1_800_000_000_000;
    const request = secondsKlines(
      { exchange: 'binance', symbol: 'btcusdt', timeframe: '5s', after: now - 60_000, limit: 1500 },
      now,
    );
    expect(request.params['symbol']).toBe('BTCUSDT');
    expect(request.params['interval']).toBe('5s');
    expect(request.params['endTime']).toBe(String(now));

    const older = secondsKlines(
      { exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1s', after: 1_000_000, limit: 100 },
      now,
    );
    expect(older.params['endTime']).toBe(String(1_000_000 + 100 * 1000));
    const page = secondsKlines({ exchange: 'binance', symbol: 'BTCUSDT', timeframe: '1s', before: 5000, limit: 10 }, now);
    expect(page.params['endTime']).toBe('4999');
  });

  it('parses [time, o, h, l, c, volume, trades] rows in time order', () => {
    const rows = parseSecondsKlines([
      [2000, 1, 2, 0.5, 1.5, 10, 3],
      [1000, 1, 1, 1, 1, 2, 1],
      'garbage',
    ]);
    expect(rows).toEqual([
      [1000, 1, 1, 1, 1, 2],
      [2000, 1, 2, 0.5, 1.5, 10],
    ]);
    expect(parseSecondsKlines('Data for this coin does not exist')).toEqual([]);
  });

  it('builds the live bar from trades: opens on the first trade of a bucket, then moves it', () => {
    const builder = new SecondsBarBuilder(5000);
    expect(builder.add([10_100, 50, 50, 50, 50, 1])).toEqual([10_000, 50, 50, 50, 50, 1]);
    expect(builder.add([12_000, 52, 52, 52, 52, 2])).toEqual([10_000, 50, 52, 50, 52, 3]);
    expect(builder.add([14_999, 49, 49, 49, 49, 1])).toEqual([10_000, 50, 52, 49, 49, 4]);
    expect(builder.add([15_000, 51, 51, 51, 51, 1])).toEqual([15_000, 51, 51, 51, 51, 1]);
    expect(builder.add([14_000, 60, 60, 60, 60, 1])).toBeNull();
  });

  it('reads Binance aggTrade messages as one-trade candles on the trade topic', () => {
    const binance = exchangeAdapter('binance');
    expect(binance.tradeTopic?.('BTCUSDT')).toBe('btcusdt@aggTrade');
    const ticks = binance.parseStream(
      JSON.stringify({ e: 'aggTrade', s: 'BTCUSDT', p: '77000.5', q: '0.012', T: 1_793_439_763_123, m: false }),
    );
    expect(ticks).toEqual([
      { topic: 'btcusdt@aggTrade', candle: [1_793_439_763_123, 77000.5, 77000.5, 77000.5, 77000.5, 0.012] },
    ]);
  });

  it('offers seconds only on Binance and only for the last day', () => {
    const now = 1_800_000_000_000;
    expect(secondsAvailable('binance', now - 3_600_000, now)).toBe(true);
    expect(secondsAvailable('binance', now - 24 * 3_600_000, now)).toBe(false);
    expect(secondsAvailable('bybit', now - 60_000, now)).toBe(false);
  });
});
