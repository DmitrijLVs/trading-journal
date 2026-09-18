import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
  DestroyRef,
} from '@angular/core';

@Component({
  template: `{{ text() }}`,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      max-width: 280px;
      padding: $space-1 $space-2;
      background: var(--canvas-inset);
      border: 1px solid var(--border-default);
      border-radius: $radius-md;
      box-shadow: $shadow-md;
      color: var(--fg-default);
      font-size: $text-xs;
      line-height: 1.4;
      pointer-events: none;
      animation: tip-in $duration-fast $ease-out;
    }

    @keyframes tip-in {
      from {
        opacity: 0;
        transform: translateY(3px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipPanel {
  readonly text = signal('');
}

/** Всплывающая подсказка: <button appTooltip="Пояснение">…</button> */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'schedule()',
    '(mouseleave)': 'hide()',
    '(focus)': 'schedule()',
    '(blur)': 'hide()',
    '(click)': 'hide()',
  },
})
export class Tooltip {
  private readonly overlay = inject(Overlay);
  private readonly element = inject(ElementRef<HTMLElement>);

  readonly appTooltip = input('');

  private overlayRef: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected schedule(): void {
    if (!this.appTooltip()) return;
    this.timer = setTimeout(() => this.show(), 350);
  }

  private show(): void {
    if (this.overlayRef) return;
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.element)
      .withPositions([
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
      ]);
    this.overlayRef = this.overlay.create({ positionStrategy, scrollStrategy: this.overlay.scrollStrategies.close() });
    const ref = this.overlayRef.attach(new ComponentPortal(TooltipPanel));
    ref.instance.text.set(this.appTooltip());
  }

  protected hide(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
