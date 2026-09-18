import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

/** Сегмент-контрол с анимированным «бегунком» (iOS-style). */
@Component({
  selector: 'app-segmented',
  template: `
    <div class="track" role="tablist" [style.--count]="options().length">
      @if (activeIndex() >= 0) {
        <span class="thumb" [style.transform]="'translateX(' + activeIndex() * 100 + '%)'"></span>
      }
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          class="seg"
          [class.active]="opt.value === value()"
          [attr.aria-selected]="opt.value === value()"
          (click)="value.set(opt.value)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styles: `
    @use 'styles/index' as *;

    .track {
      position: relative;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      background: var(--canvas-inset);
      border: 1px solid var(--border-muted);
      border-radius: $radius-md;
      padding: 2px;
      height: 30px;
    }

    .thumb {
      position: absolute;
      top: 2px;
      bottom: 2px;
      left: 2px;
      width: calc((100% - 4px) / var(--count));
      background: var(--canvas-overlay);
      border: 1px solid var(--border-default);
      border-radius: 5px;
      box-shadow: $shadow-sm;
      transition: transform $duration-base $ease-out;
    }

    .seg {
      position: relative;
      z-index: 1;
      appearance: none;
      background: none;
      border: none;
      border-radius: $radius-sm;
      color: var(--fg-muted);
      font-size: $text-sm;
      font-weight: 500;
      cursor: pointer;
      padding: 0 $space-3;
      transition: color $duration-fast $ease-apple;
      white-space: nowrap;
      @include focus-ring;

      &:hover { color: var(--fg-default); }
      &.active { color: var(--fg-default); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Segmented {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly value = model<string>('');

  protected readonly activeIndex = computed(() =>
    this.options().findIndex((o) => o.value === this.value()),
  );
}
