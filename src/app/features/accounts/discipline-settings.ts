import { ChangeDetectionStrategy, Component, inject, linkedSignal } from '@angular/core';
import { FormField, form, max, min, submit } from '@angular/forms/signals';
import { DisciplineStore } from '../analytics/discipline-store';
import { DEFAULT_DISCIPLINE } from '../analytics/data/discipline.model';
import { Button } from '../../shared/ui/button';
import { ToastService } from '../../shared/ui/toast';

/** Модель формы: 0 в лимите — «не задан». */
interface DisciplineModel {
  dailyLossLimit: number;
  maxTrades: number;
  pauseAfterLosses: number;
  revengeMinutes: number;
}

/**
 * Правила дисциплины: по ним журнал ставит автотеги (реванш, тильт,
 * овертрейд) и предупреждает во время сессии.
 */
@Component({
  selector: 'app-discipline-settings',
  imports: [FormField, Button],
  template: `
    <header class="head">
      <h2>Дисциплина</h2>
      <p>
        Ваши правила. По ним журнал размечает сделки (реванш, тильт, овертрейд) и предупреждает прямо
        во время сессии — в шапке и всплывающим сообщением.
      </p>
    </header>

    <form class="form" novalidate (submit)="$event.preventDefault(); save()">
      <label class="row">
        <span class="row-text">
          <span class="t">Дневной лимит убытка, $</span>
          <span class="d">Дошли до него — на сегодня всё. 0 — без лимита.</span>
        </span>
        <input class="tj-input num" type="number" step="1" [formField]="rulesForm.dailyLossLimit" />
      </label>

      <label class="row">
        <span class="row-text">
          <span class="t">Норма сделок в день</span>
          <span class="d">Сделки сверх неё помечаются как овертрейд.</span>
        </span>
        <input class="tj-input num" type="number" step="1" [formField]="rulesForm.maxTrades" />
      </label>

      <label class="row">
        <span class="row-text">
          <span class="t">Пауза после убытков подряд</span>
          <span class="d">Вход после такой серии без паузы — тильт.</span>
        </span>
        <input class="tj-input num" type="number" step="1" [formField]="rulesForm.pauseAfterLosses" />
      </label>

      <label class="row">
        <span class="row-text">
          <span class="t">Окно реванша, минут</span>
          <span class="d">Вход в ту же монету раньше этого после убытка — реванш.</span>
        </span>
        <input class="tj-input num" type="number" step="1" [formField]="rulesForm.revengeMinutes" />
      </label>

      @if (rulesForm().invalid() && rulesForm().touched()) {
        <p class="error">Проверьте значения: сделок — от 1, пауза — от 1 до 10, окно — от 1 до 240 минут.</p>
      }

      <div class="actions">
        <button app-button variant="primary" size="sm" type="submit">Сохранить</button>
        <button app-button variant="ghost" size="sm" type="button" (click)="resetDefaults()">По умолчанию</button>
      </div>
    </form>
  `,
  styles: `
    @use 'styles/index' as *;

    .head p { margin: $space-1 0 $space-4; color: var(--fg-muted); font-size: $text-sm; max-width: 620px; line-height: 1.5; }
    .form { display: flex; flex-direction: column; }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $space-4;
      padding: $space-3 0;
      border-bottom: 1px solid var(--border-muted);
    }
    .row-text { display: flex; flex-direction: column; gap: 2px; }
    .t { font-weight: 500; }
    .d { font-size: $text-sm; color: var(--fg-muted); }
    .num { width: 110px; text-align: right; font-family: $font-mono; }
    .error { color: var(--danger-fg); font-size: $text-sm; margin: $space-3 0 0; }
    .actions { display: flex; gap: $space-2; margin-top: $space-4; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisciplineSettings {
  private readonly store = inject(DisciplineStore);
  private readonly toast = inject(ToastService);

  /** Правила подтянулись из профиля позже — форма следует за ними. */
  protected readonly model = linkedSignal<DisciplineModel>(() => toModel(this.store.settings()));
  protected readonly rulesForm = form(this.model, (p) => {
    min(p.dailyLossLimit, 0);
    min(p.maxTrades, 1);
    min(p.pauseAfterLosses, 1);
    max(p.pauseAfterLosses, 10);
    min(p.revengeMinutes, 1);
    max(p.revengeMinutes, 240);
  });

  protected save(): void {
    submit(this.rulesForm, async () => {
      const m = this.model();
      this.store.update({
        dailyLossLimit: m.dailyLossLimit > 0 ? m.dailyLossLimit : null,
        maxTrades: m.maxTrades,
        pauseAfterLosses: m.pauseAfterLosses,
        revengeMinutes: m.revengeMinutes,
      });
      this.toast.success('Правила сохранены — разметка сделок пересчитана');
    });
  }

  protected resetDefaults(): void {
    this.store.reset();
    this.model.set(toModel(DEFAULT_DISCIPLINE));
    this.toast.info('Правила — по умолчанию');
  }
}

function toModel(s: typeof DEFAULT_DISCIPLINE): DisciplineModel {
  return {
    dailyLossLimit: s.dailyLossLimit ?? 0,
    maxTrades: s.maxTrades,
    pauseAfterLosses: s.pauseAfterLosses,
    revengeMinutes: s.revengeMinutes,
  };
}
