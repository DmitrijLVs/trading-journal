import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { ICONS, IconDef, IconName } from './icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Иконка из реестра ICONS: чистый штрих в сетке 24×24. Дрожь пера на 16 px
 * читалась как шум, поэтому геометрия рисуется ровно; «от руки» осталось
 * только там, где это осмысленно (подписи, заметки, пустые состояния).
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      #svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
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
    const def: IconDef = ICONS[this.name()];
    const node = (tag: string, attrs: Record<string, string | number>): SVGElement => {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      return el;
    };

    svg.replaceChildren();
    for (const d of def.p ?? []) svg.append(node('path', { d }));
    for (const [cx, cy, r] of def.c ?? []) svg.append(node('circle', { cx, cy, r }));
    for (const [cx, cy] of def.d ?? []) {
      svg.append(node('circle', { cx, cy, r: 1.3, fill: 'currentColor', stroke: 'none' }));
    }
  }
}
