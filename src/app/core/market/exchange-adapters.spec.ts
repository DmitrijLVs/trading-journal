import { describe, expect, it } from 'vitest';
import { exchangeAdapter, toOkxInstId } from './exchange-adapters';

// Сообщения — сокращённые реальные ответы бирж (октябрь 2026).

describe('binance adapter', () => {
  const binance = exchangeAdapter('binance');

  it('pages history before a time and forward after it', () => {
    const before = binance.klines({ exchange: 'binance', symbol: 'BTCUSDT', timeframe: '15m', before: 1000, limit: 5000 });
    expect(before.params).toEqual({ symbol: 'BTCUSDT', interval: '15m', limit: '1500', endTime: '999' });
    const after = binance.klines({ exchange: 'binance', symbol: 'BTCUSDT', timeframe: '15m', after: 1000, limit: 10 });
    expect(after.params['startTime']).toBe('1001');
  });

  it('parses REST klines and kline stream events with volume', () => {
    const rows = binance.parseKlines([
      [1792490400000, '81459.60', '81589.50', '81442.80', '81571.20', '619.775', 1792491299999],
      [1792489500000, '81375.80', '81485.30', '81280.00', '81459.60', '1088.519', 1792490399999],
    ]);
    expect(rows).toEqual([
      [1792489500000, 81375.8, 81485.3, 81280, 81459.6, 1088.519],
      [1792490400000, 81459.6, 81589.5, 81442.8, 81571.2, 619.775],
    ]);
    const ticks = binance.parseStream(
      '{"e":"kline","E":1792491825167,"s":"BTCUSDT","k":{"t":1792491780000,"i":"1m","o":"81565.60","c":"81563.70","h":"81573.10","l":"81560.00","v":"12.5"}}',
    );
    expect(ticks).toEqual([
      { topic: 'btcusdt@kline_1m', candle: [1792491780000, 81565.6, 81573.1, 81560, 81563.7, 12.5] },
    ]);
    expect(binance.topic('BTCUSDT', '1m')).toBe('btcusdt@kline_1m');
    expect(binance.parseStream('{"result":null,"id":1}')).toEqual([]);
  });
});

describe('bybit adapter', () => {
  const bybit = exchangeAdapter('bybit');

  it('bounds a forward page from above (Bybit returns the newest otherwise)', () => {
    const page = bybit.klines({ exchange: 'bybit', symbol: 'BTCUSDT', timeframe: '1h', after: 0, limit: 2 });
    expect(page.params).toMatchObject({ interval: '60', start: '1', end: String(2 * 3_600_000) });
  });

  it('parses newest-first REST list and stream data ascending', () => {
    const rows = bybit.parseKlines({
      retCode: 0,
      result: {
        list: [
          ['1792407600000', '82390.8', '82390.8', '82143.7', '82170.1', '560.487', '46094661.7'],
          ['1792406700000', '82361.3', '82460.5', '82300.5', '82390.8', '410.1', '1'],
        ],
      },
    });
    expect(rows.map((r) => r[0])).toEqual([1792406700000, 1792407600000]);
    const ticks = bybit.parseStream(
      '{"topic":"kline.1.BTCUSDT","data":[{"start":1792491780000,"open":"81564.9","close":"81560.7","high":"81570.6","low":"81557.8","volume":"2.568"}]}',
    );
    expect(ticks).toEqual([
      { topic: 'kline.1.BTCUSDT', candle: [1792491780000, 81564.9, 81570.6, 81557.8, 81560.7, 2.568] },
    ]);
  });
});

describe('okx adapter', () => {
  const okx = exchangeAdapter('okx');

  it('maps symbols and UTC daily bars', () => {
    expect(toOkxInstId('BTCUSDT')).toBe('BTC-USDT-SWAP');
    expect(okx.topic('ETHUSDT', '1d')).toBe('candle1Dutc:ETH-USDT-SWAP');
  });

  it('parses candles with base-currency volume', () => {
    const ticks = okx.parseStream(
      '{"arg":{"channel":"candle1m","instId":"BTC-USDT-SWAP"},"data":[["1792491780000","81565.0","81571.0","81560.3","81560.4","1380.36","13.8036","1125885.7","0"]]}',
    );
    expect(ticks).toEqual([
      { topic: 'candle1m:BTC-USDT-SWAP', candle: [1792491780000, 81565, 81571, 81560.3, 81560.4, 13.8036] },
    ]);
    expect(okx.parseStream('pong')).toEqual([]);
  });
});
