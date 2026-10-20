import type { Chart, Extension, SeriesApi, SeriesOptions } from '@nv/core';

declare module '@nv/core' {
  interface AddableSeries {
    sceneBounds: [SeriesOptions, SeriesApi<SeriesOptions>];
  }
}

export interface SceneRange {
  min: number;
  max: number;
}

/** Геометрия области графика для слоя: CSS px от левого верхнего угла плота. */
export interface SceneView {
  readonly width: number;
  readonly height: number;
  /** x центра свечи, в которую попадает момент времени. */
  xOfTime(time: number): number;
  y(value: number): number;
}

/** Разметка хоста поверх свечей (Canvas2D на слое взаимодействия движка). */
export interface SceneLayer {
  draw(ctx: CanvasRenderingContext2D, view: SceneView): void;
  /** Цены, которые автошкала обязана показать. */
  extend?(range: SceneRange): void;
}

export interface Scene {
  add(layer: SceneLayer): () => void;
  /** Перерисовать слои (изменились их данные). */
  redraw(): void;
  /** Пересчитать автошкалу и перерисовать (изменились цены слоёв). */
  refresh(): void;
}

export interface SceneRegistry {
  readonly extension: Extension;
  sceneOf(chart: Chart): Scene | null;
}
