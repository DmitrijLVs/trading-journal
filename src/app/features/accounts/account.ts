import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-account',
  template: `
    <section class="page">
      <header>
        <h1>Аккаунт</h1>
        <p>Брокерские счета и API-ключи.</p>
      </header>
    </section>
  `,
  styles: `
    :host { display: block; }
    h1 { margin: 0 0 var(--space-1); font-size: var(--text-2xl); font-weight: 600; color: var(--fg-default); }
    p { margin: 0; color: var(--fg-muted); font-size: var(--text-md); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Account {}
