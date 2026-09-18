import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Сколько ещё после окончания intro-анимации перерисовки продолжают её (gridster
 *  меняет размеры ячеек в первые кадры — без этого штрихи «схлопнутся»). */
const INTRO_GRACE_MS = 400;

export type SketchLayer = 'over' | 'under';

export interface SketchSurfaceOptions {
  /** Слой: поверх контента (рамки, линии) или под ним (заливки). */
  layer?: SketchLayer;
  /** Задержка «дорисовывания» при первом появлении, мс. */
  introDelay?: number;
  /** Длительность дорисовывания, мс. 0 — без анимации. */
  introDuration?: number;
}

export type SketchRenderer = (rc: RoughSVG, width: number, height: number) => void;

/**
 * SVG-слой поверх host-элемента (чистый DOM, без Angular): следит за размером,
 * перерисовывает rough-примитивы и умеет «дорисовывать» штрихи при появлении.
 * Стили — глобальные `.sketch-svg` / `.sketch-intro` (см. styles/_sketch.scss).
 */
export class SketchSurface {
  readonly svg: SVGSVGElement;
  readonly rc: RoughSVG;

  private readonly observer: ResizeObserver;
  private readonly mountedAt = performance.now();
  private frame = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly render: SketchRenderer,
    private readonly options: SketchSurfaceOptions = {},
  ) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', `sketch-svg sketch-svg--${options.layer ?? 'over'}`);
    this.svg.setAttribute('aria-hidden', 'true');
    this.rc = rough.svg(this.svg);

    host.classList.add('sketch-host');
    if (getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }
    if (options.layer === 'under') {
      host.prepend(this.svg);
    } else {
      host.append(this.svg);
    }

    this.observer = new ResizeObserver(() => this.schedule());
    this.observer.observe(host);
  }

  /** Перерисовать немедленно (например, при смене входов директивы). */
  draw(): void {
    const width = this.host.offsetWidth;
    const height = this.host.offsetHeight;
    if (width < 2 || height < 2) return;

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.replaceChildren();
    this.render(this.rc, width, height);
    this.applyIntro();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.svg.remove();
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  /** Штрихи «дорисовываются» через stroke-dashoffset; при перерисовке в первые
   *  кадры анимация продолжается с того же места (отрицательный delay). */
  private applyIntro(): void {
    const duration = this.options.introDuration ?? 0;
    if (!duration) return;

    const delay = this.options.introDelay ?? 0;
    const elapsed = performance.now() - this.mountedAt;
    if (elapsed > delay + duration + INTRO_GRACE_MS) return;

    for (const path of this.svg.querySelectorAll('path')) {
      path.setAttribute('pathLength', '1');
      path.style.setProperty('--sketch-intro-duration', `${duration}ms`);
      path.style.setProperty('--sketch-intro-delay', `${Math.round(delay - elapsed)}ms`);
      path.classList.add('sketch-intro');
    }
  }
}
