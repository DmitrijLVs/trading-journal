import type { Runtime } from '@nv/core';
import type { Drawings } from '@nv/tools';
import type { Candle } from '../../core/market/market.model';
import type { SceneRegistry } from './nv-scene.types';

/** Рантайм chart-engine приложения: GPU-устройство, рисунки, слои сцены. */
export interface NvContext {
  runtime: Runtime;
  tools: Drawings;
  scenes: SceneRegistry;
}

/** Цены в движке — целые тики: знаки цены задают размер тика. */
export interface CandleMeta {
  decimals: number;
  tickSize: number;
  intervalMs: number;
}

/** Куда лента свечей кладёт подгруженное: история, догрузка вперёд, живая свеча. */
export interface CandleSink {
  prepend(candles: readonly Candle[]): void;
  append(candles: readonly Candle[]): void;
  update(candle: Candle): void;
}

/** Диапазон баров на экране: индексы свечей, дробные и за краями данных. */
export interface BarRange {
  from: number;
  to: number;
}
