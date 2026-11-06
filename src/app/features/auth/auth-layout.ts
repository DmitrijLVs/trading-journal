import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ToastOutlet } from '../../shared/ui/toast';

/** Каркас экранов входа: логотип, заголовок и одна колонка формы по центру. */
@Component({
  selector: 'app-auth-layout',
  imports: [ToastOutlet],
  template: `
    <main class="page">
      <div class="column">
        <div class="brand">
          <img src="logo.png" alt="" width="40" height="40" />
          <span class="brand-name">ProboyScalp</span>
        </div>
        <section class="panel">
          <h1>{{ title() }}</h1>
          @if (subtitle()) {
            <p class="subtitle">{{ subtitle() }}</p>
          }
          <ng-content />
        </section>
        <ng-content select="[auth-footer]" />
      </div>
    </main>
    <app-toast-outlet />
  `,
  styles: `
    @use 'styles/index' as *;

    .page {
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 12vh $space-4 $space-8;
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: $space-5;
      width: 100%;
      max-width: 400px;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: $space-3;

      img { border-radius: 50%; box-shadow: 0 0 0 1px var(--border-muted); }
    }

    .brand-name {
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.025em;
      color: var(--fg-default);
    }

    // Форма — стеклянная панель; сверху на неё падает фоновый свет.
    .panel {
      padding: $space-8 $space-6 $space-6;
      background:
        radial-gradient(90% 70% at 50% -10%, color-mix(in srgb, var(--accent-fg) 10%, transparent), transparent 70%),
        var(--canvas-subtle);
      border: 1px solid var(--border-muted);
      border-radius: $radius-2xl;
      box-shadow: var(--inner-highlight);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    h1 {
      margin: 0;
      font-size: $text-2xl;
      font-weight: 600;
      letter-spacing: -0.025em;
    }

    .subtitle {
      margin: $space-2 0 0;
      color: var(--fg-muted);
      font-size: $text-sm;
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
