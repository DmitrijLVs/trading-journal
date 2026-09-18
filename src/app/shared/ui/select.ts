import { OverlayModule } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { Icon } from './icon';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Выпадающий список на CDK Overlay. Один компонент на оба режима:
 * одиночный выбор (value) и множественный (multi + values).
 */
@Component({
  selector: 'app-select',
  imports: [OverlayModule, Icon],
  templateUrl: './select.html',
  styleUrl: './select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select {
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('Выбрать…');
  readonly multi = input(false);
  readonly clearable = input(false);
  readonly size = input<'sm' | 'md'>('md');
  /** Поиск в панели — включается сам на длинных списках. */
  readonly searchable = input<boolean | 'auto'>('auto');

  readonly value = model<string | null>(null);
  readonly values = model<string[]>([]);

  protected readonly open = signal(false);
  protected readonly query = signal('');

  protected readonly showSearch = computed(() => {
    const mode = this.searchable();
    return mode === 'auto' ? this.options().length > 8 : mode;
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(q));
  });

  protected readonly triggerLabel = computed(() => {
    if (this.multi()) {
      const selected = this.values();
      if (selected.length === 0) return this.placeholder();
      if (selected.length === 1) {
        return this.options().find((o) => o.value === selected[0])?.label ?? selected[0];
      }
      return `Выбрано: ${selected.length}`;
    }
    const value = this.value();
    if (value === null || value === '') return this.placeholder();
    return this.options().find((o) => o.value === value)?.label ?? value;
  });

  protected readonly hasSelection = computed(() =>
    this.multi() ? this.values().length > 0 : this.value() !== null && this.value() !== '',
  );

  protected toggle(): void {
    this.open.update((v) => !v);
    if (!this.open()) this.query.set('');
  }

  protected close(): void {
    this.open.set(false);
    this.query.set('');
  }

  protected isSelected(option: SelectOption): boolean {
    return this.multi() ? this.values().includes(option.value) : this.value() === option.value;
  }

  protected pick(option: SelectOption): void {
    if (this.multi()) {
      this.values.update((current) =>
        current.includes(option.value)
          ? current.filter((v) => v !== option.value)
          : [...current, option.value],
      );
    } else {
      this.value.set(option.value);
      this.close();
    }
  }

  protected clear(event: MouseEvent): void {
    event.stopPropagation();
    if (this.multi()) this.values.set([]);
    else this.value.set(null);
  }
}
