import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Мерцающий плейсхолдер загрузки. */
@Component({
  selector: 'app-skeleton',
  template: ``,
  styles: `
    :host {
      display: block;
      border-radius: 6px;
      background: linear-gradient(
        100deg,
        var(--canvas-overlay) 40%,
        var(--border-muted) 50%,
        var(--canvas-overlay) 60%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }

    @keyframes shimmer {
      from { background-position: 130% 0; }
      to { background-position: -30% 0; }
    }
  `,
  host: {
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('16px');
}
