import type { Chart, Layer, SeriesOptions } from '@nv/core';
import {
  SeriesImpl,
  type ChartAttachment,
  type ChartHandle,
  type LegendValues,
  type Range,
  type SeriesHost,
} from '@nv/core/extend';
import { Scene, SceneLayer, SceneRange, SceneRegistry, SceneView } from './nv-scene.types';

const SCENE_EXTENSION = 'trade-journal-scenes';

class ChartSceneView implements SceneView {
  width = 0;
  height = 0;
  left = 0;
  top = 0;

  constructor(private readonly handle: ChartHandle) {}

  xOfTime(time: number): number {
    return this.handle.xOfIndex(Math.floor(this.handle.indexOfTime(time))) - this.left;
  }

  y(value: number): number {
    return this.handle.yOfValue(0, value) - this.top;
  }
}

/**
 * Слои хоста на графике (D-41: часть расширения на каждом графике): рисуются
 * Canvas2D на слое взаимодействия поверх свечей, в границах панели свечей.
 */
class ChartScene implements ChartAttachment, Scene {
  private layers: SceneLayer[] = [];
  private readonly view: ChartSceneView;
  private readonly plot = { left: 0, width: 0 };
  private readonly pane = { top: 0, height: 0 };
  private readonly range: SceneRange = { min: 0, max: 0 };

  constructor(private readonly handle: ChartHandle) {
    this.view = new ChartSceneView(handle);
  }

  add(layer: SceneLayer): () => void {
    this.layers.push(layer);
    this.refresh();
    return () => {
      this.layers = this.layers.filter((item) => item !== layer);
      this.refresh();
    };
  }

  redraw(): void {
    this.handle.invalidateOverlay();
  }

  refresh(): void {
    this.handle.invalidate();
  }

  extent(out: Range): void {
    const range = this.range;
    range.min = Infinity;
    range.max = -Infinity;
    for (const layer of this.layers) layer.extend?.(range);
    const found = Number.isFinite(range.min) && Number.isFinite(range.max);
    out.min = found ? range.min : Number.NaN;
    out.max = found ? range.max : Number.NaN;
  }

  overlay(ctx: CanvasRenderingContext2D): void {
    if (!this.measure()) return;
    const dpr = this.handle.dpr;
    const view = this.view;
    ctx.setTransform(dpr, 0, 0, dpr, view.left * dpr, view.top * dpr);
    ctx.beginPath();
    ctx.rect(0, 0, view.width, view.height);
    ctx.clip();
    for (const layer of this.layers) {
      ctx.save();
      try {
        layer.draw(ctx, view);
      } finally {
        ctx.restore();
      }
    }
  }

  destroy(): void {
    this.layers = [];
  }

  private measure(): boolean {
    const pane = this.handle.paneBox(0, this.pane);
    if (!pane || !this.handle.hasCandles(0)) return false;
    const plot = this.handle.plotBox(this.plot);
    const view = this.view;
    view.left = plot.left;
    view.width = plot.width;
    view.top = pane.top;
    view.height = pane.height;
    // Шкала ещё не знает диапазона цен — рисовать не по чему.
    return view.width > 0 && Number.isFinite(this.handle.valueOfY(0, pane.top + pane.height / 2));
  }
}

/** Невидимая серия: отдаёт автошкале цены слоёв сцены. */
class SceneBounds extends SeriesImpl {
  override readonly type = 'sceneBounds';
  protected override readonly defaultLayer: Layer = 'orders';

  constructor(
    host: SeriesHost,
    private readonly scene: ChartScene | undefined,
  ) {
    super(host, { legend: false }, 'right', true);
  }

  setOptions(options: SeriesOptions): void {
    this.applyBase(options);
    this.host.invalidate();
  }

  override range(_from: number, _to: number, out: Range): void {
    if (this.scene) {
      this.scene.extent(out);
      return;
    }
    out.min = Number.NaN;
    out.max = Number.NaN;
  }

  override draw(): void {}

  override isEmpty(): boolean {
    return true;
  }

  override legendValues(): LegendValues | null {
    return null;
  }

  override releaseGpu(): void {}
}

export function sceneRegistry(): SceneRegistry {
  const scenes = new WeakMap<object, ChartScene>();
  return {
    extension: {
      name: SCENE_EXTENSION,
      series: {
        sceneBounds: { create: (host) => new SceneBounds(host, scenes.get(host)) },
      },
      attach: (handle) => {
        const scene = new ChartScene(handle);
        scenes.set(handle.chart, scene);
        return scene;
      },
    },
    sceneOf: (chart: Chart) => scenes.get(chart) ?? null,
  };
}
