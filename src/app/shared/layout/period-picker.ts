import { OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PERIOD_LABELS, PeriodPreset, PeriodStore } from '../../core/state/period-store';
import { Icon } from '../ui/icon';
import { Button } from '../ui/button';

const PRESETS: readonly PeriodPreset[] = ['7d', '30d', '90d', 'ytd', '1y', 'all'];

/** Глобальный период анализа в топбаре: пресеты + произвольный диапазон. */
@Component({
  selector: 'app-period-picker',
  imports: [OverlayModule, Icon, Button],
  templateUrl: './period-picker.html',
  styleUrl: './period-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodPicker {
  protected readonly store = inject(PeriodStore);
  protected readonly presets = PRESETS;
  protected readonly labels = PERIOD_LABELS;

  protected readonly open = signal(false);
  protected readonly draftFrom = signal<string>('');
  protected readonly draftTo = signal<string>('');

  protected toggle(): void {
    if (!this.open()) {
      this.draftFrom.set(this.store.customFrom() ?? '');
      this.draftTo.set(this.store.customTo() ?? '');
    }
    this.open.update((v) => !v);
  }

  protected pick(preset: PeriodPreset): void {
    this.store.setPreset(preset);
    this.open.set(false);
  }

  protected applyCustom(): void {
    const from = this.draftFrom() || null;
    const to = this.draftTo() || null;
    if (!from && !to) return;
    this.store.setCustomRange(from, to);
    this.open.set(false);
  }
}
