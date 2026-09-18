import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Icon } from './icon';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

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

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string): void {
    const toast: Toast = { id: ++this.seq, kind, message };
    this._toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), 3800);
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
        <span>{{ toast.message }}</span>
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
    return toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'info';
  }
}
