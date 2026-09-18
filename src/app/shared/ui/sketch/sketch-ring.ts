import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import type { RoughSVG } from 'roughjs/bin/svg';
import { seedFrom } from './sketch-seed';
import { SketchSurface } from './sketch-surface';

export interface RingSegment {
  value: number;
  /** Готовый CSS-цвет (hex/rgb): rough пишет его в атрибут stroke. */
  color: string;
}

/**
 * Кольцо долей, нарисованное маркером: сегменты — толстые дуги rough.js
 * с лёгкой дрожью. Для двух-трёх долей (лонг/шорт), не для точных диаграмм.
 */
@Component({
  selector: 'app-sketch-ring',
  template: '',
  styles: `
    :host {
      display: block;
      width: 48px;
      height: 48px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SketchRing {
  readonly segments = input.required<readonly RingSegment[]>();
  readonly thickness = input(6);
  readonly sketchSeed = input('ring');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private surface: SketchSurface | null = null;

  constructor() {
    afterNextRender(() => this.mount());
    inject(DestroyRef).onDestroy(() => this.surface?.destroy());
    effect(() => {
      this.segments();
      this.thickness();
      this.surface?.draw();
    });
  }

  private mount(): void {
    this.zone.runOutsideAngular(() => {
      this.surface = new SketchSurface(this.host, (rc, w, h) => this.render(rc, w, h), {
        layer: 'over',
        introDuration: 600,
      });
    });
  }

  private render(rc: RoughSVG, width: number, height: number): void {
    const svg = this.surface?.svg;
    if (!svg) return;
    const thickness = this.thickness();
    const diameter = Math.min(width, height) - thickness - 2;
    const cx = width / 2;
    const cy = height / 2;
    const seed = seedFrom(this.sketchSeed());
    const base = { strokeWidth: thickness, roughness: 0.9, bowing: 0.6, disableMultiStroke: true };

    const segments = this.segments().filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0) {
      svg.append(rc.circle(cx, cy, diameter, { ...base, stroke: 'currentColor', seed }));
      return;
    }

    const gap = segments.length > 1 ? 0.14 : 0;
    let angle = -Math.PI / 2;
    segments.forEach((segment, i) => {
      const span = (segment.value / total) * Math.PI * 2;
      const start = angle + gap / 2;
      const stop = angle + span - gap / 2;
      if (stop > start) {
        svg.append(
          rc.arc(cx, cy, diameter, diameter, start, stop, false, {
            ...base,
            stroke: segment.color,
            seed: seed + i,
          }),
        );
      }
      angle += span;
    });
  }
}
