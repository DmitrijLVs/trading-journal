import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  DistributionMetric,
  GroupKey,
  WidgetInstance,
  WidgetSettings,
  defaultWidgetTitle,
} from './data/workspace.model';
import { DialogShell } from '../../shared/ui/dialog-shell';
import { Button } from '../../shared/ui/button';
import { Select, SelectOption } from '../../shared/ui/select';
import { Toggle } from '../../shared/ui/toggle';
import { PERIOD_LABELS, PeriodPreset } from '../../core/state/period-store';

const PERIOD_OPTIONS: SelectOption[] = [
  { value: 'global', label: 'Глобальный период' },
  ...(['7d', '30d', '90d', 'ytd', '1y', 'all'] as PeriodPreset[]).map((p) => ({
    value: p,
    label: PERIOD_LABELS[p],
  })),
];

const GROUP_OPTIONS: SelectOption[] = [
  { value: 'symbol', label: 'Инструмент' },
  { value: 'strategy', label: 'Стратегия' },
  { value: 'tag', label: 'Тег' },
  { value: 'mistake', label: 'Ошибка' },
  { value: 'setup', label: 'Оценка сетапа' },
  { value: 'session', label: 'Сессия' },
  { value: 'weekday', label: 'День недели' },
  { value: 'hour', label: 'Час (UTC)' },
];

const METRIC_OPTIONS: SelectOption[] = [
  { value: 'pnl', label: 'P&L' },
  { value: 'count', label: 'Количество сделок' },
  { value: 'winrate', label: 'Винрейт' },
  { value: 'avgR', label: 'Средний R' },
];

/** Настройки экземпляра виджета: заголовок, период, разрез, метрика. */
@Component({
  imports: [DialogShell, Button, Select, Toggle],
  template: `
    <app-dialog-shell title="Настройки виджета" [subtitle]="placeholderTitle">
      <div class="form">
        <div class="tj-field">
          <label>Заголовок</label>
          <input
            class="tj-input"
            type="text"
            [placeholder]="placeholderTitle"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
          />
        </div>

        <div class="tj-field">
          <label>Период данных</label>
          <app-select [options]="periodOptions" [value]="period()" (valueChange)="period.set($event)" />
        </div>

        @if (isDistribution) {
          <div class="grid2">
            <div class="tj-field">
              <label>Разрез</label>
              <app-select [options]="groupOptions" [value]="groupBy()" (valueChange)="groupBy.set($event)" />
            </div>
            <div class="tj-field">
              <label>Метрика</label>
              <app-select [options]="metricOptions" [value]="metric()" (valueChange)="metric.set($event)" />
            </div>
          </div>
        }

        @if (hasLimit) {
          <div class="tj-field">
            <label>Показывать строк</label>
            <input
              class="tj-input"
              type="number"
              min="3"
              max="30"
              [value]="limit()"
              (input)="limit.set(+$any($event.target).value)"
            />
          </div>
        }

        @if (isEquity) {
          <label class="toggle-row">
            <span>Показывать просадку</span>
            <app-toggle [checked]="showDrawdown()" (checkedChange)="showDrawdown.set($event)" />
          </label>
        }
      </div>

      <ng-container dialog-footer>
        <button app-button variant="outline" (click)="ref.close()">Отмена</button>
        <button app-button variant="primary" (click)="save()">Сохранить</button>
      </ng-container>
    </app-dialog-shell>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; min-width: 420px; }
    .form { display: flex; flex-direction: column; gap: $space-4; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: $space-3; }
    app-select { display: block; width: 100%; }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: $text-sm;
      color: var(--fg-default);
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetSettingsDialog {
  protected readonly ref = inject(DialogRef<WidgetSettings | undefined>);
  private readonly widget = inject<WidgetInstance>(DIALOG_DATA);

  protected readonly periodOptions = PERIOD_OPTIONS;
  protected readonly groupOptions = GROUP_OPTIONS;
  protected readonly metricOptions = METRIC_OPTIONS;

  protected readonly isDistribution = this.widget.type === 'distribution';
  protected readonly isEquity = this.widget.type === 'equity-curve';
  protected readonly hasLimit =
    this.widget.type === 'distribution' ||
    this.widget.type === 'recent-trades' ||
    this.widget.type === 'best-worst';

  protected readonly placeholderTitle = defaultWidgetTitle({ ...this.widget, settings: { ...this.widget.settings, title: undefined } });

  protected readonly title = signal(this.widget.settings.title ?? '');
  protected readonly period = signal<string | null>(this.widget.settings.period ?? 'global');
  protected readonly groupBy = signal<string | null>(this.widget.settings.groupBy ?? 'symbol');
  protected readonly metric = signal<string | null>(this.widget.settings.metric ?? 'pnl');
  protected readonly limit = signal(this.widget.settings.limit ?? 10);
  protected readonly showDrawdown = signal(this.widget.settings.showDrawdown ?? true);

  protected save(): void {
    const settings: WidgetSettings = {
      ...this.widget.settings,
      title: this.title().trim() || undefined,
      period: (this.period() ?? 'global') as WidgetSettings['period'],
    };
    if (this.isDistribution) {
      settings.groupBy = (this.groupBy() ?? 'symbol') as GroupKey;
      settings.metric = (this.metric() ?? 'pnl') as DistributionMetric;
    }
    if (this.hasLimit) settings.limit = Math.max(3, Math.min(30, this.limit() || 10));
    if (this.isEquity) settings.showDrawdown = this.showDrawdown();
    this.ref.close(settings);
  }
}
