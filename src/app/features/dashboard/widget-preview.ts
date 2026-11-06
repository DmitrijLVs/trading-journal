import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import { PreviewKind } from './data/workspace.model';

const W = 72;
const H = 48;
const SVG_NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

/**
 * Миниатюра виджета для панели добавления — схема формы виджета (кривая,
 * столбцы, календарь…) чистой геометрией: тонкие линии и заливки токенов
 * темы, без иконок.
 */
@Component({
  selector: 'app-widget-preview',
  template: '',
  styles: `
    :host {
      display: block;
      width: 72px;
      height: 48px;
      color: var(--fg-subtle);
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
      this.svg.setAttribute('fill', 'none');
      this.svg.setAttribute('stroke-linecap', 'round');
      this.svg.setAttribute('stroke-linejoin', 'round');
      this.svg.style.overflow = 'visible';
      this.host.append(this.svg);
    }
    const svg = this.svg;
    svg.replaceChildren();

    const el = (tag: string, attrs: Attrs): SVGElement => {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      svg.append(node);
      return node;
    };
    const color = (token: string | null): string => (token ? `var(${token})` : 'currentColor');
    /** Контур — тонкая линия цветом подписи. */
    const frame = (x: number, y: number, w: number, h: number, r = 3): void => {
      el('rect', { x, y, width: w, height: h, rx: r, stroke: 'currentColor', 'stroke-width': 0.8, opacity: 0.6 });
    };
    /** Заливка — цвет токена с прозрачностью. */
    const block = (x: number, y: number, w: number, h: number, token: string | null, opacity = 0.85, r = 1.5): void => {
      el('rect', { x, y, width: w, height: h, rx: r, fill: color(token), opacity });
    };
    const line = (x1: number, y1: number, x2: number, y2: number, token: string | null, width = 1, opacity = 1): void => {
      el('line', { x1, y1, x2, y2, stroke: color(token), 'stroke-width': width, opacity });
    };
    const path = (points: [number, number][], token: string | null, width = 1.5): void => {
      el('polyline', { points: points.map((p) => p.join(',')).join(' '), stroke: color(token), 'stroke-width': width });
    };
    const area = (points: [number, number][], base: number, token: string): void => {
      const [first] = points;
      const last = points[points.length - 1];
      const d = `M${first[0]},${base} ${points.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${last[0]},${base}Z`;
      el('path', { d, fill: color(token), opacity: 0.18 });
      path(points, token, 1.5);
    };
    const dot = (cx: number, cy: number, r: number, token: string | null): void => {
      el('circle', { cx, cy, r, fill: color(token) });
    };
    /** Подпись-заглушка: короткая скруглённая черта. */
    const text = (x: number, y: number, w: number, strong = false): void => {
      line(x, y, x + w, y, null, strong ? 2.2 : 1.2, strong ? 0.9 : 0.55);
    };

    switch (this.kind()) {
      case 'hero':
        frame(2, 10, 68, 28, 6);
        line(9, 21, 30, 21, '--danger-fg', 3.4);
        text(9, 30, 14);
        block(38, 19, 26, 5, null, 0.25, 2.5);
        block(38, 19, 18, 5, '--attention-fg', 0.9, 2.5);
        break;
      case 'timeline':
        path([[6, 18], [16, 14], [26, 16], [34, 8], [44, 20], [54, 26], [66, 22]], '--accent-fg');
        line(8, 34, 20, 34, '--success-fg', 3);
        line(24, 34, 30, 34, '--danger-fg', 3);
        line(18, 41, 40, 41, '--success-fg', 3);
        line(44, 34, 64, 34, '--danger-fg', 3);
        break;
      case 'notes':
        [6, 21, 36].forEach((y, i) => {
          dot(9, y + 3, 2.6, i === 1 ? '--attention-fg' : '--danger-fg');
          text(17, y + 1, 35, true);
          text(17, y + 7, 47);
        });
        break;
      case 'tile':
        frame(4, 4, 64, 40, 6);
        line(12, 17, 42, 17, '--success-fg', 3.2);
        text(12, 26, 22);
        path([[12, 39], [24, 34], [34, 37], [46, 30], [60, 26]], '--success-fg', 1.2);
        break;
      case 'summary':
        [[5, 5], [38, 5], [5, 26], [38, 26]].forEach(([x, y]) => {
          frame(x, y, 29, 17, 4);
          text(x + 5, y + 7, 15, true);
          text(x + 5, y + 13, 9);
        });
        break;
      case 'line':
        line(6, 42, 66, 42, null, 0.8, 0.5);
        path([[8, 40], [18, 33], [26, 36], [34, 25], [44, 28], [54, 15], [64, 11]], '--accent-fg', 1.6);
        break;
      case 'area':
        line(6, 38, 66, 38, null, 0.8, 0.5);
        area([[8, 38], [18, 33], [27, 35], [36, 24], [45, 27], [56, 16], [64, 12]], 38, '--success-fg');
        break;
      case 'drawdown':
        line(6, 10, 66, 10, null, 0.8, 0.5);
        path([[8, 10], [18, 12], [28, 27], [38, 22], [48, 35], [64, 38]], '--danger-fg', 1.6);
        break;
      case 'bars':
        line(6, 30, 66, 30, null, 0.8, 0.5);
        [10, -6, 16, 8, -11, 14, 6].forEach((h, i) => {
          const x = 8 + i * 8.5;
          if (h > 0) block(x, 30 - h, 5.5, h, '--success-fg');
          else block(x, 30, 5.5, -h, '--danger-fg');
        });
        break;
      case 'hbars':
        [52, 40, 30, 20, -12].forEach((w, i) => {
          block(10, 6 + i * 8.5, Math.abs(w), 5, w > 0 ? '--success-fg' : '--danger-fg');
        });
        line(10, 4, 10, 46, null, 0.8, 0.5);
        break;
      case 'ring': {
        const r = 15;
        const c = 2 * Math.PI * r;
        el('circle', { cx: 36, cy: 24, r, stroke: 'var(--danger-fg)', 'stroke-width': 5.5 });
        el('circle', {
          cx: 36,
          cy: 24,
          r,
          stroke: 'var(--success-fg)',
          'stroke-width': 5.5,
          'stroke-dasharray': `${c * 0.6} ${c}`,
          transform: 'rotate(-90 36 24)',
        });
        break;
      }
      case 'scatter':
        line(6, 42, 66, 42, null, 0.8, 0.5);
        line(8, 4, 8, 42, null, 0.8, 0.5);
        [[14, 30], [22, 16], [30, 36], [38, 12], [46, 26], [54, 33], [62, 9]].forEach(([x, y]) =>
          dot(x, y, 2.6, y < 24 ? '--success-fg' : '--danger-fg'),
        );
        break;
      case 'calendar': {
        const marked: Record<string, string> = {
          '1,0': '--success-fg',
          '3,0': '--danger-fg',
          '5,1': '--success-fg',
          '0,2': '--success-fg',
          '4,2': '--danger-fg',
          '2,3': '--success-fg',
        };
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 7; c++) {
            const token = marked[`${c},${r}`];
            if (token) block(5 + c * 9, 5 + r * 10, 7.5, 8.5, token, 0.75);
            else frame(5 + c * 9, 5 + r * 10, 7.5, 8.5, 1.5);
          }
        }
        break;
      }
      case 'heatmap':
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 8; c++) {
            const weight = (r * 3 + c * 5) % 7;
            block(5 + c * 8, 5 + r * 10, 6.5, 8.5, weight > 3 ? '--accent-fg' : null, weight > 5 ? 0.9 : weight > 3 ? 0.5 : 0.12);
          }
        }
        break;
      case 'table':
        line(6, 9, 66, 9, null, 1.2, 0.8);
        [18, 26, 34, 42].forEach((y, i) => {
          line(6, y, 66, y, null, 0.6, 0.35);
          text(9, y - 4, 13, true);
          line(52, y - 4, 64, y - 4, i === 2 ? '--danger-fg' : '--success-fg', 1.8);
        });
        break;
    }
  }
}
