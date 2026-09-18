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
import type { RoughSVG } from 'roughjs/bin/svg';
import { seedFrom } from './sketch-seed';
import { SketchSurface } from './sketch-surface';

/**
 * Рукописная линия вдоль нижнего края элемента: подчёркивание активной
 * вкладки, разделитель под шапкой виджета. Цвет — `--sketch-stroke` на host.
 */
@Directive({ selector: '[appSketchUnderline]' })
export class SketchUnderline {
  readonly sketchSeed = input('');
  readonly sketchStrokeWidth = input(1.4);
  readonly sketchRoughness = input(1.2);
  /** Отступ линии от краёв host, px. */
  readonly sketchInset = input(2);
  readonly sketchDelay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private surface: SketchSurface | null = null;

  constructor() {
    afterNextRender(() => this.mount());
    inject(DestroyRef).onDestroy(() => this.surface?.destroy());
    effect(() => {
      this.sketchSeed();
      this.sketchStrokeWidth();
      this.sketchRoughness();
      this.sketchInset();
      this.surface?.draw();
    });
  }

  private mount(): void {
    this.zone.runOutsideAngular(() => {
      this.surface = new SketchSurface(this.host, (rc, w, h) => this.render(rc, w, h), {
        layer: 'over',
        introDelay: this.sketchDelay(),
        introDuration: 450,
      });
    });
  }

  private render(rc: RoughSVG, width: number, height: number): void {
    const inset = this.sketchInset();
    const y = height - 1;
    this.surface?.svg.append(
      rc.line(inset, y, width - inset, y, {
        roughness: this.sketchRoughness(),
        bowing: 1.5,
        strokeWidth: this.sketchStrokeWidth(),
        stroke: 'currentColor',
        seed: seedFrom(this.sketchSeed() || 'underline'),
      }),
    );
  }
}
