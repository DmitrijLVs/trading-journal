import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  template: `
    <section class="page">
      <header>
        <h1>Настройки</h1>
        <p>Предпочтения, тема, часовой пояс и параметры отображения.</p>
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
export class Settings {}
