import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS, IconName } from './icons';

@Component({
  selector: 'app-icon',
  template: `<span class="i" [innerHTML]="svg()"></span>`,
  styles: `
    :host {
      display: inline-flex;
      width: var(--icon-size, 16px);
      height: var(--icon-size, 16px);
      flex: none;
      line-height: 0;
      color: inherit;
    }
    .i,
    .i ::ng-deep svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();

  protected readonly svg = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]),
  );
}
