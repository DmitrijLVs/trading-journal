import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model, signal } from '@angular/core';

/** Шаг стрелок клавиатуры; с Shift — крупнее. */
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
/** Панель справа не шире этой доли контейнера — графику слева остаётся место. */
const RESIZE_MAX_SHARE = 0.5;

/**
 * Перетаскиваемая граница между основной колонкой и панелью справа от неё.
 * Занимает зазор сетки (своя колонка шириной с зазор) и меняет `size` —
 * ширину правой панели в px: влево — панель шире, вправо — уже. Стрелки
 * двигают по 16px (с Shift — по 64), двойной клик возвращает `defaultSize`.
 * Родитель ограничивает колонку в CSS тем же `RESIZE_MAX_SHARE`
 * (`min(var(--w), 50%)`), чтобы у перетаскивания не было мёртвой зоны.
 */
@Component({
  selector: 'app-resize-handle',
  template: '',
  styles: `
    @use 'styles/index' as *;

    :host {
      position: relative;
      display: block;
      min-height: 0;
      cursor: col-resize;
      touch-action: none;
      outline: none;
    }

    // Зона захвата шире зазора: заходит на кромки соседних панелей.
    :host::before {
      content: '';
      position: absolute;
      inset: 0 -4px;
    }

    // Линия: в покое — короткая метка посередине, при наведении растягивается
    // на всю высоту, при перетаскивании и фокусе с клавиатуры — оранжевая.
    :host::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 2px;
      transform: translateX(-50%);
      background: var(--border-strong);
      clip-path: inset(calc(50% - 14px) 0 round 1px);
      transition:
        clip-path $duration-fast $ease-out,
        background $duration-fast $ease-out;
    }

    :host(:hover)::after {
      clip-path: inset(0 0 round 1px);
    }

    :host(.dragging)::after,
    :host(:focus-visible)::after {
      clip-path: inset(0 0 round 1px);
      background: var(--accent-fg);
    }
  `,
  host: {
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'vertical',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuenow]': 'size()',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[class.dragging]': 'dragging()',
    '(pointerdown)': 'startDrag($event)',
    '(pointermove)': 'drag($event)',
    '(lostpointercapture)': 'endDrag()',
    '(keydown)': 'nudge($event)',
    '(dblclick)': 'resetSize()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResizeHandle {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Ширина панели справа, px. */
  readonly size = model.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly defaultSize = input.required<number>();
  /** Что меняет граница — для экранного диктора. */
  readonly label = input.required<string>();

  protected readonly dragging = signal(false);
  private startX = 0;
  private startSize = 0;
  /** Предел по контейнеру — меряется в начале жеста. */
  private limit = Infinity;

  protected startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    // Без выделения текста под курсором во время протяжки.
    event.preventDefault();
    this.host.nativeElement.setPointerCapture(event.pointerId);
    this.limit = this.containerLimit();
    this.startX = event.clientX;
    // Сохранённая ширина может быть больше показанной (узкое окно) — тянем от показанной.
    this.startSize = this.clamp(this.size());
    this.dragging.set(true);
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragging()) return;
    this.size.set(this.clamp(this.startSize - (event.clientX - this.startX)));
  }

  protected endDrag(): void {
    this.dragging.set(false);
  }

  protected nudge(event: KeyboardEvent): void {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const delta = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
    if (delta === 0) return;
    event.preventDefault();
    this.limit = this.containerLimit();
    this.size.set(this.clamp(this.clamp(this.size()) + delta));
  }

  protected resetSize(): void {
    this.limit = this.containerLimit();
    this.size.set(this.clamp(this.defaultSize()));
  }

  private clamp(value: number): number {
    return Math.round(Math.max(this.min(), Math.min(value, this.max(), this.limit)));
  }

  /** Доля ширины содержимого родителя-сетки (без его внутренних полей). */
  private containerLimit(): number {
    const parent = this.host.nativeElement.parentElement;
    if (!parent) return Infinity;
    const style = getComputedStyle(parent);
    const content = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return content * RESIZE_MAX_SHARE;
  }
}
