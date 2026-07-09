import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  template: `
    <section class="page">
      <header>
        <h1>Главная</h1>
        <p>Здесь будут общий обзор, кривая капитала и ключевые метрики.</p>
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
export class Dashboard {}
