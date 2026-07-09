import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-svg-icon',
  template: `<span class="content" [innerHTML]="safe()"></span>`,
  styles: `
    :host {
      display: inline-flex;
      width: var(--svg-icon-size, 16px);
      height: var(--svg-icon-size, 16px);
      line-height: 0;
      color: inherit;
    }
    .content {
      display: inline-flex;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvgIcon {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<string>();

  private readonly source = httpResource.text(() => `/icons/${this.name()}.svg`);

  protected readonly safe = computed<SafeHtml | null>(() => {
    const raw = this.source.value();
    return raw ? this.sanitizer.bypassSecurityTrustHtml(raw) : null;
  });
}
