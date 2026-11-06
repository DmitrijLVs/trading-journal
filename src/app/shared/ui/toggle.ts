import { ChangeDetectionStrategy, Component, model } from '@angular/core';

/** Переключатель (switch) в стиле macOS. */
@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      class="track"
      [class.on]="checked()"
      (click)="checked.set(!checked())"
    >
      <span class="knob"></span>
    </button>
  `,
  styles: `
    @use 'styles/index' as *;

    .track {
      appearance: none;
      border: none;
      width: 40px;
      height: 24px;
      border-radius: $radius-full;
      background: var(--border-strong);
      position: relative;
      cursor: pointer;
      padding: 0;
      transition: background $duration-base $ease-apple;
      @include focus-ring;

      &.on { background: var(--accent-gradient); }
    }

    .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      transition: transform $duration-base $ease-out;
    }

    .on .knob { transform: translateX(16px); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toggle {
  readonly checked = model(false);
}
