import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import type { Point } from 'roughjs/bin/geometry';
import type { RoughSVG } from 'roughjs/bin/svg';
import { seedFrom } from './sketch-seed';
import { SketchSurface } from './sketch-surface';

/**
 * Рукописная изогнутая стрелка-указатель (аннотация «смотри сюда»).
 * Рисуется в координатах host: от верхнего левого угла вниз к центру низа.
 * Цвет — `--sketch-stroke`.
 */
@Component({
  selector: 'app-sketch-arrow',
  template: '',
  styles: `
    :host {
      display: block;
      width: 64px;
      height: 56px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SketchArrow {
  readonly sketchSeed = input('arrow');
  readonly sketchDelay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private surface: SketchSurface | null = null;

  constructor() {
    afterNextRender(() => this.mount());
    inject(DestroyRef).onDestroy(() => this.surface?.destroy());
  }

  private mount(): void {
    this.zone.runOutsideAngular(() => {
      this.surface = new SketchSurface(this.host, (rc, w, h) => this.render(rc, w, h), {
        layer: 'over',
        introDelay: this.sketchDelay(),
        introDuration: 600,
      });
    });
  }

  private render(rc: RoughSVG, width: number, height: number): void {
    const seed = seedFrom(this.sketchSeed());
    const options = {
      roughness: 1.2,
      bowing: 1,
      strokeWidth: 1.6,
      stroke: 'currentColor',
      seed,
    };

    // Хвост слева сверху, лёгкий S-изгиб, остриё внизу по центру.
    const tail: Point = [width * 0.12, height * 0.08];
    const bend: Point = [width * 0.78, height * 0.28];
    const tip: Point = [width * 0.5, height * 0.96];
    const curve: Point[] = [tail, bend, [width * 0.62, height * 0.66], tip];
    this.surface?.svg.append(rc.curve(curve, options));

    // Остриё: два штриха под углом к направлению последнего сегмента.
    const [px, py] = curve[curve.length - 2];
    const angle = Math.atan2(tip[1] - py, tip[0] - px);
    const headLength = Math.min(12, width * 0.2);
    for (const spread of [-0.55, 0.55]) {
      const a = angle + Math.PI + spread;
      this.surface?.svg.append(
        rc.line(tip[0], tip[1], tip[0] + Math.cos(a) * headLength, tip[1] + Math.sin(a) * headLength, {
          ...options,
          seed: seed + 3,
        }),
      );
    }
  }
}
