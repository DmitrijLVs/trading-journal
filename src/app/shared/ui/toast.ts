import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Icon } from './icon';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warn';
  message: string;
  /** Рукописный заголовок — голос тренера (предупреждения дисциплины). */
  title?: string;
}

/** Сколько живёт тост: предупреждение — дольше, его важно успеть прочитать. */
const TOAST_MS: Record<Toast['kind'], number> = { success: 3800, error: 3800, info: 3800, warn: 8000 };

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  /** Предупреждение дисциплины: заголовок от руки и пояснение. */
  warn(title: string, message: string): void {
    this.push('warn', message, title);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string, title?: string): void {
    const toast: Toast = { id: ++this.seq, kind, message, title };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), TOAST_MS[kind]);
  }
}

/** Рендерится один раз в Shell. */
@Component({
  selector: 'app-toast-outlet',
  imports: [Icon],
  template: `
    @for (toast of service.toasts(); track toast.id) {
      <div class="toast" [class]="toast.kind" (click)="service.dismiss(toast.id)">
        <app-icon [name]="icon(toast)" />
        <span class="body">
          @if (toast.title) {
            <b class="title">{{ toast.title }}</b>
          }
          <span>{{ toast.message }}</span>
        </span>
      </div>
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      position: fixed;
      bottom: $space-5;
      right: $space-5;
      z-index: $z-toast;
      display: flex;
      flex-direction: column;
      gap: $space-2;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: $space-2;
      min-width: 240px;
      max-width: 380px;
      padding: $space-3 $space-4;
      border-radius: $radius-lg;
      border: 1px solid var(--border-default);
      box-shadow: $shadow-lg;
      font-size: $text-sm;
      cursor: pointer;
      pointer-events: auto;
      animation: toast-in $duration-base $ease-out;
      @include frosted(color-mix(in srgb, var(--canvas-overlay) 90%, transparent));

      &.success app-icon { color: var(--success-fg); }
      &.error app-icon { color: var(--danger-fg); }
      &.info app-icon { color: var(--accent-fg); }
      &.warn {
        align-items: flex-start;
        border-color: var(--attention-muted);
        app-icon { color: var(--attention-fg); margin-top: 3px; }
      }
    }

    .body { display: flex; flex-direction: column; gap: 2px; }

    .title {
      font-family: $font-hand;
      font-size: $text-lg;
      font-weight: 400;
      color: var(--attention-fg);
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastOutlet {
  protected readonly service = inject(ToastService);

  protected icon(toast: Toast): 'check' | 'alert' | 'info' {
    if (toast.kind === 'success') return 'check';
    return toast.kind === 'info' ? 'info' : 'alert';
  }
}
