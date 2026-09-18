import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  input,
  viewChild,
} from '@angular/core';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import { ICONS, IconDef, IconName } from './icons';
import { seedFrom } from './sketch/sketch-seed';

/**
 * Иконка «пером»: геометрия из реестра ICONS рисуется rough.js с едва
 * заметной дрожью — тот же почерк, что у рамок и подчёркиваний. Seed из имени,
 * поэтому одна и та же иконка везде выглядит одинаково.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      #svg
      viewBox="0 0 24 24"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    ></svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: var(--icon-size, 16px);
      height: var(--icon-size, 16px);
      flex: none;
      line-height: 0;
      color: inherit;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private mounted = false;

  constructor() {
    afterNextRender(() => {
      this.mounted = true;
      this.draw();
    });
    effect(() => {
      this.name();
      if (this.mounted) this.draw();
    });
  }

  private draw(): void {
    const svg = this.svg().nativeElement;
    const name = this.name();
    const def: IconDef = ICONS[name];
    const rc = rough.svg(svg);
    const seed = seedFrom(`icon-${name}`);
    // Дрожь маленькая в единицах viewBox (24): на 16 px это доли пикселя —
    // читается как перо, а не как шум.
    const stroke: Options = {
      stroke: 'currentColor',
      strokeWidth: 1.7,
      roughness: 0.7,
      bowing: 0.8,
      maxRandomnessOffset: 0.55,
      disableMultiStroke: true,
      preserveVertices: true,
      curveFitting: 0.96,
      seed,
    };

    svg.replaceChildren();
    (def.p ?? []).forEach((d, i) => svg.append(rc.path(d, { ...stroke, seed: seed + i })));
    (def.c ?? []).forEach(([cx, cy, r], i) =>
      svg.append(rc.circle(cx, cy, r * 2, { ...stroke, seed: seed + 20 + i })),
    );
    (def.d ?? []).forEach(([cx, cy], i) =>
      svg.append(
        rc.circle(cx, cy, 2.6, {
          ...stroke,
          stroke: 'none',
          fill: 'currentColor',
          fillStyle: 'solid',
          seed: seed + 40 + i,
        }),
      ),
    );
  }
}
