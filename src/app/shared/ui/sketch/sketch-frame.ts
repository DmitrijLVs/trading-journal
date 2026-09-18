import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import type { Options } from 'roughjs/bin/core';
import type { RoughSVG } from 'roughjs/bin/svg';
import { seedFrom } from './sketch-seed';
import { SketchSurface } from './sketch-surface';

/** SVG-path скруглённого прямоугольника — rough.js «дрожит» его сам. */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M${x + r},${y}`,
    `H${x + w - r}`,
    `A${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V${y + h - r}`,
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H${x + r}`,
    `A${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V${y + r}`,
    `A${r},${r} 0 0 1 ${x + r},${y}`,
    'Z',
  ].join(' ');
}

let autoSeedSequence = 0;

/**
 * Рукописная рамка вокруг элемента (как прямоугольник в Excalidraw).
 * Цвет — через `--sketch-stroke` на host (currentColor у svg), поэтому
 * hover/drag-состояния переключаются обычным CSS.
 *
 * Вешается явно (`appSketchFrame`) или автоматически на любой `.tj-card`
 * в компоненте, который импортировал директиву.
 */
@Directive({ selector: '[appSketchFrame], .tj-card' })
export class SketchFrame {
  /** Строка-seed: один элемент — одна и та же «дрожь» между перерисовками.
   *  Пусто — у каждого экземпляра свой автоматический seed. */
  readonly sketchSeed = input('');
  private readonly autoSeed = `frame-${autoSeedSequence++}`;
  readonly sketchRadius = input(10);
  /** 0 — архитектор, 1 — художник (Excalidraw по умолчанию), 2 — карикатурист. */
  readonly sketchRoughness = input(1);
  readonly sketchStrokeWidth = input(1.2);
  /** Задержка дорисовывания при появлении, мс — для каскада по сетке. */
  readonly sketchDelay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private surface: SketchSurface | null = null;

  constructor() {
    afterNextRender(() => this.mount());
    inject(DestroyRef).onDestroy(() => this.surface?.destroy());
    effect(() => {
      this.sketchSeed();
      this.sketchRadius();
      this.sketchRoughness();
      this.sketchStrokeWidth();
      this.surface?.draw();
    });
  }

  private mount(): void {
    this.zone.runOutsideAngular(() => {
      this.surface = new SketchSurface(this.host, (rc, w, h) => this.render(rc, w, h), {
        layer: 'over',
        introDelay: this.sketchDelay(),
        introDuration: 700,
      });
    });
  }

  private render(rc: RoughSVG, width: number, height: number): void {
    const inset = 1.5;
    const w = width - inset * 2;
    const h = height - inset * 2;
    const radius = Math.max(0, Math.min(this.sketchRadius(), Math.min(w, h) / 2 - 1));
    const options: Options = {
      roughness: this.sketchRoughness(),
      bowing: 1,
      strokeWidth: this.sketchStrokeWidth(),
      stroke: 'currentColor',
      seed: seedFrom(this.sketchSeed() || this.autoSeed),
      preserveVertices: true,
    };
    this.surface?.svg.append(rc.path(roundedRectPath(inset, inset, w, h, radius), options));
  }
}
