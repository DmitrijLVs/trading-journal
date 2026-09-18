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
      width: 36px;
      height: 21px;
      border-radius: $radius-full;
      background: var(--border-strong);
      position: relative;
      cursor: pointer;
      padding: 0;
      transition: background $duration-base $ease-apple;
      @include focus-ring;

      &.on { background: var(--success-fg); }
    }

    .knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      transition: transform $duration-base $ease-out;
    }

    .on .knob { transform: translateX(15px); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toggle {
  readonly checked = model(false);
}
