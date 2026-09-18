import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Мини-график тренда (SVG, без зависимостей) — для карточек счетов и тайлов. */
@Component({
  selector: 'app-spark-line',
  template: `
    <svg [attr.viewBox]="'0 0 ' + w() + ' ' + h()" preserveAspectRatio="none">
      @if (points().length > 1) {
        <polyline [attr.points]="areaPoints()" class="area" [class.neg]="isNegative()" />
        <polyline [attr.points]="linePoints()" class="line" [class.neg]="isNegative()" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; line-height: 0; }
    svg { width: 100%; height: 100%; overflow: visible; }
    .line {
      fill: none;
      stroke: var(--success-fg);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .area { fill: var(--success-subtle); stroke: none; }
    .line.neg { stroke: var(--danger-fg); }
    .area.neg { fill: var(--danger-subtle); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparkLine {
  readonly data = input.required<readonly number[]>();
  readonly w = input(120);
  readonly h = input(36);

  protected readonly isNegative = computed(() => {
    const d = this.data();
    return d.length > 1 && d[d.length - 1] < d[0];
  });

  protected readonly points = computed(() => {
    const d = this.data();
    if (d.length < 2) return [];
    const min = Math.min(...d);
    const max = Math.max(...d);
    const span = max - min || 1;
    const stepX = this.w() / (d.length - 1);
    const pad = 2;
    const innerH = this.h() - pad * 2;
    return d.map((v, i) => [i * stepX, pad + innerH * (1 - (v - min) / span)] as const);
  });

  protected readonly linePoints = computed(() =>
    this.points()
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly areaPoints = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return `0,${this.h()} ${this.linePoints()} ${this.w()},${this.h()}`;
  });
}
