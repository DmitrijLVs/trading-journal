import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import type { RoughSVG } from 'roughjs/bin/svg';
import { PreviewKind } from './data/workspace.model';
import { seedFrom } from '../../shared/ui/sketch/sketch-seed';

const W = 72;
const H = 48;
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Миниатюра виджета для панели добавления — набросок rough.js вместо иконки:
 * сразу видно, что за форма у виджета (кривая, столбцы, календарь…).
 */
@Component({
  selector: 'app-widget-preview',
  template: '',
  styles: `
    :host {
      display: block;
      width: 72px;
      height: 48px;
      color: var(--fg-muted);
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetPreview {
  readonly kind = input.required<PreviewKind>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private svg: SVGSVGElement | null = null;

  constructor() {
    afterNextRender(() => this.draw());
    effect(() => {
      this.kind();
      if (this.svg) this.draw();
    });
  }

  private draw(): void {
    if (!this.svg) {
      this.svg = document.createElementNS(SVG_NS, 'svg');
      this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      this.svg.setAttribute('width', '100%');
      this.svg.setAttribute('height', '100%');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.style.overflow = 'visible';
      this.host.append(this.svg);
    }
    this.svg.replaceChildren();
    const rc = rough.svg(this.svg);
    const kind = this.kind();
    const seed = seedFrom(`preview-${kind}`);
    const ink: Options = { stroke: 'currentColor', strokeWidth: 1.1, roughness: 0.9, bowing: 0.8, seed };
    const faint: Options = { ...ink, strokeWidth: 0.7 };
    const tint = (el: SVGGElement, token: string): SVGGElement => {
      el.style.color = `var(${token})`;
      return el;
    };
    const fill = (token: string, gap = 3): Options => ({
      ...ink,
      stroke: 'none',
      fill: 'currentColor',
      fillStyle: 'hachure',
      hachureGap: gap,
      hachureAngle: -41,
      fillWeight: 0.8,
    });
    const put = (...els: SVGGElement[]): void => this.svg?.append(...els);

    switch (kind) {
      case 'tile':
        put(
          rc.rectangle(4, 4, 64, 40, { ...ink, seed: seed + 1 }),
          tint(rc.line(12, 18, 44, 18, { ...ink, strokeWidth: 3.2, seed: seed + 2 }), '--success-fg'),
          rc.line(12, 27, 34, 27, { ...faint, seed: seed + 3 }),
          tint(rc.linearPath([[12, 40], [24, 35], [34, 38], [46, 31], [60, 27]], { ...ink, seed: seed + 4 }), '--success-fg'),
        );
        break;
      case 'summary':
        [[5, 5], [38, 5], [5, 26], [38, 26]].forEach(([x, y], i) => {
          put(rc.rectangle(x, y, 29, 17, { ...faint, seed: seed + i }));
          put(rc.line(x + 5, y + 7, x + 20, y + 7, { ...ink, strokeWidth: 2.2, seed: seed + 10 + i }));
          put(rc.line(x + 5, y + 13, x + 14, y + 13, { ...faint, seed: seed + 20 + i }));
        });
        break;
      case 'line':
        put(
          rc.line(6, 42, 66, 42, { ...faint, seed: seed + 1 }),
          tint(rc.curve([[8, 40], [18, 33], [26, 36], [34, 25], [44, 28], [54, 15], [64, 11]], { ...ink, strokeWidth: 1.6, seed: seed + 2 }), '--accent-fg'),
        );
        break;
      case 'area': {
        const curve: [number, number][] = [[8, 38], [18, 33], [27, 35], [36, 24], [45, 27], [56, 16], [64, 12]];
        put(
          rc.line(6, 38, 66, 38, { ...faint, seed: seed + 1 }),
          tint(rc.polygon([[8, 38], ...curve.slice(1), [64, 38]], { ...fill('--success-fg', 3.4), seed: seed + 2 }), '--success-fg'),
          tint(rc.curve(curve, { ...ink, strokeWidth: 1.6, seed: seed + 3 }), '--success-fg'),
        );
        break;
      }
      case 'drawdown':
        put(
          rc.line(6, 10, 66, 10, { ...faint, seed: seed + 1 }),
          tint(rc.curve([[8, 10], [18, 12], [28, 27], [38, 22], [48, 35], [64, 38]], { ...ink, strokeWidth: 1.6, seed: seed + 2 }), '--danger-fg'),
        );
        break;
      case 'bars':
        put(rc.line(6, 30, 66, 30, { ...faint, seed: seed + 1 }));
        [10, -6, 16, 8, -11, 14, 6].forEach((h, i) => {
          const x = 8 + i * 8.5;
          put(h > 0
            ? tint(rc.rectangle(x, 30 - h, 6, h, { ...fill('--success-fg'), seed: seed + 2 + i }), '--success-fg')
            : tint(rc.rectangle(x, 30, 6, -h, { ...fill('--danger-fg'), seed: seed + 2 + i }), '--danger-fg'));
        });
        break;
      case 'hbars':
        [52, 40, 30, 20, -12].forEach((w, i) => {
          const y = 6 + i * 8.5;
          put(w > 0
            ? tint(rc.rectangle(10, y, w, 5.5, { ...fill('--success-fg'), seed: seed + i }), '--success-fg')
            : tint(rc.rectangle(10, y, -w, 5.5, { ...fill('--danger-fg'), seed: seed + i }), '--danger-fg'));
        });
        put(rc.line(10, 4, 10, 46, { ...faint, seed: seed + 9 }));
        break;
      case 'ring': {
        const a0 = -Math.PI / 2;
        const split = a0 + Math.PI * 2 * 0.62;
        put(
          tint(rc.arc(36, 24, 32, 32, a0 + 0.1, split - 0.1, false, { ...ink, strokeWidth: 6, disableMultiStroke: true, seed: seed + 1 }), '--success-fg'),
          tint(rc.arc(36, 24, 32, 32, split + 0.1, a0 + Math.PI * 2 - 0.1, false, { ...ink, strokeWidth: 6, disableMultiStroke: true, seed: seed + 2 }), '--danger-fg'),
        );
        break;
      }
      case 'histogram':
        put(rc.line(6, 42, 66, 42, { ...faint, seed: seed + 1 }));
        [4, 9, 15, 20, 13, 7, 3].forEach((h, i) => {
          const x = 8 + i * 8.2;
          const token = i < 3 ? '--danger-fg' : '--success-fg';
          put(tint(rc.rectangle(x, 42 - h, 6, h, { ...fill(token), seed: seed + 2 + i }), token));
        });
        break;
      case 'scatter':
        put(rc.line(6, 42, 66, 42, { ...faint, seed: seed + 1 }), rc.line(8, 4, 8, 42, { ...faint, seed: seed + 2 }));
        [[14, 30], [22, 16], [30, 36], [38, 12], [46, 26], [54, 33], [62, 9]].forEach(([x, y], i) => {
          const token = y < 24 ? '--success-fg' : '--danger-fg';
          put(tint(rc.circle(x, y, 6, { ...ink, fill: 'currentColor', fillStyle: 'solid', strokeWidth: 0.8, seed: seed + 3 + i }), token));
        });
        break;
      case 'calendar': {
        const marked: Record<string, string> = { '1,0': '--success-fg', '3,0': '--danger-fg', '5,1': '--success-fg', '0,2': '--success-fg', '4,2': '--danger-fg', '2,3': '--success-fg' };
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 7; c++) {
            const x = 5 + c * 9;
            const y = 5 + r * 10;
            const token = marked[`${c},${r}`];
            put(rc.rectangle(x, y, 7.5, 8.5, { ...faint, seed: seed + r * 7 + c }));
            if (token) put(tint(rc.rectangle(x, y, 7.5, 8.5, { ...fill(token, 2.4), seed: seed + 40 + r * 7 + c }), token));
          }
        }
        break;
      }
      case 'heatmap':
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 8; c++) {
            const x = 5 + c * 8;
            const y = 5 + r * 10;
            const weight = (r * 3 + c * 5) % 7;
            put(rc.rectangle(x, y, 6.5, 8.5, { ...faint, strokeWidth: 0.5, seed: seed + r * 8 + c }));
            if (weight > 3) put(tint(rc.rectangle(x, y, 6.5, 8.5, { ...fill('--accent-fg', weight > 5 ? 1.8 : 3), seed: seed + 50 + r * 8 + c }), '--accent-fg'));
          }
        }
        break;
      case 'table':
        put(rc.line(6, 9, 66, 9, { ...ink, strokeWidth: 1.5, seed: seed + 1 }));
        [18, 26, 34, 42].forEach((y, i) => {
          put(rc.line(6, y, 66, y, { ...faint, seed: seed + 2 + i }));
          put(rc.line(9, y - 4, 22, y - 4, { ...ink, strokeWidth: 1.6, seed: seed + 10 + i }));
          put(tint(rc.line(52, y - 4, 64, y - 4, { ...ink, strokeWidth: 1.6, seed: seed + 20 + i }), i === 2 ? '--danger-fg' : '--success-fg'));
        });
        break;
    }
  }
}
