import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
} from '@angular/core';
import type { RoughSVG } from 'roughjs/bin/svg';
import { seedFrom } from './sketch-seed';
import { SketchSurface } from './sketch-surface';

/**
 * Штриховка под контентом элемента (фирменная заливка Excalidraw).
 * Цвет — `--sketch-fill` на host; плотность — `hachureGap`, чем меньше, тем
 * плотнее (так кодируется интенсивность, например размер дневного P&L).
 */
@Directive({ selector: '[appSketchHachure]' })
export class SketchHachure {
  /** Включена ли заливка (false — слой пустой, но готов к включению). */
  readonly appSketchHachure = input(true, { transform: booleanAttribute });
  readonly hachureGap = input(6);
  readonly hachureWeight = input(1);
  /** Угол штрихов; -41° — значение Excalidraw по умолчанию. */
  readonly hachureAngle = input(-41);
  readonly hachureSeed = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private surface: SketchSurface | null = null;

  constructor() {
    afterNextRender(() => this.mount());
    inject(DestroyRef).onDestroy(() => this.surface?.destroy());
    effect(() => {
      this.appSketchHachure();
      this.hachureGap();
      this.hachureWeight();
      this.hachureAngle();
      this.hachureSeed();
      this.surface?.draw();
    });
  }

  private mount(): void {
    this.zone.runOutsideAngular(() => {
      this.surface = new SketchSurface(this.host, (rc, w, h) => this.render(rc, w, h), {
        layer: 'under',
        introDuration: 500,
      });
    });
  }

  private render(rc: RoughSVG, width: number, height: number): void {
    if (!this.appSketchHachure()) return;
    this.surface?.svg.append(
      rc.rectangle(0, 0, width, height, {
        stroke: 'none',
        fill: 'currentColor',
        fillStyle: 'hachure',
        hachureGap: this.hachureGap(),
        hachureAngle: this.hachureAngle(),
        fillWeight: this.hachureWeight(),
        roughness: 0.8,
        seed: seedFrom(this.hachureSeed() || 'hachure'),
      }),
    );
  }
}
