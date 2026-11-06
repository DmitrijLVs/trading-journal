import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { PeriodSummary } from '../analytics/data/periods';
import { AUTO_TAG_LABELS, AUTO_TAG_SHORT } from '../analytics/data/behavior';
import { PeriodReview, REVIEW_GRADE_LABELS, REVIEW_NOTE_MAX, ReviewGrade } from './data/review.model';
import { periodShareCard, periodShareFileName } from './data/journal-share';
import { formatDateTime, formatMoney } from '../trades/data/trade.model';
import { ShareService } from '../../shared/share/share-dialog';
import { PnlValue } from '../../shared/ui/pnl-value';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { Tooltip } from '../../shared/ui/tooltip';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';

export interface PeriodClose {
  note: string;
  grade: ReviewGrade | null;
}

/**
 * Итог недели или месяца. Цвет — только у денег: итог периода и столбики
 * дней. Счётчики, разбор ошибок, статус и закрытие — нейтральные, иначе
 * карточка превращается в светофор. Внизу — ритуал закрытия (вывод +
 * оценка) и снимок для публикации.
 */
@Component({
  selector: 'app-period-card',
  imports: [FormField, PnlValue, Button, Icon, Tooltip, Segmented],
  template: `
    @let p = period();
    @let week = p.span === 'week';
    <article class="period tj-card" [class.pending]="pending()" [id]="p.key">
      <header class="title">
        <h3 class="label">{{ p.label }}</h3>
        @if (p.isCurrent) {
          <span class="status live">{{ week ? 'неделя идёт' : 'месяц идёт' }}</span>
        } @else if (review()) {
          <span class="status">
            <app-icon name="check" style="--icon-size: 12px" />
            {{ week ? 'закрыта' : 'закрыт' }}
          </span>
        }
      </header>

      <div class="result">
        <app-pnl class="net" [value]="p.net" />
        @if (p.deltaNet !== null) {
          <span class="delta">{{ money(p.deltaNet, true) }} к {{ week ? 'прошлой' : 'прошлому' }}</span>
        }
      </div>

      <dl class="facts">
        <div class="fact">
          <dt>Сделок</dt>
          <dd>{{ p.trades }}</dd>
        </div>
        <div class="fact">
          <dt>Винрейт</dt>
          <dd>{{ percent(p.winRate) }}</dd>
        </div>
        <div class="fact">
          <dt>Дней в плюсе</dt>
          <dd>{{ p.greenDays }} <span class="of">из {{ p.tradingDays }}</span></dd>
        </div>
        <div class="fact">
          <dt>Комиссии</dt>
          <dd>{{ money(p.fees) }}</dd>
        </div>
      </dl>

      <div class="bars" [class.month]="!week" role="img" [attr.aria-label]="barsLabel()">
        @for (bar of bars(); track $index) {
          <span class="bar" [appTooltip]="bar.title">
            <span class="track">
              @if (bar.value === null) {
                <i class="none"></i>
              } @else {
                <i [class.pos]="bar.value > 0" [class.neg]="bar.value < 0" [style.height.%]="bar.height"></i>
              }
            </span>
            @if (week) {
              <b>{{ bar.label }}</b>
            }
          </span>
        }
      </div>

      @if (mistakes().length > 0) {
        <p class="mistakes">
          <span class="mistakes-label">Разбор</span>
          @for (m of mistakes(); track m.tag) {
            <span class="mistake" [appTooltip]="m.hint">
              {{ m.label }} <span class="count">×{{ m.count }}</span>
              <span class="cost">{{ money(m.pnl, true) }}</span>
            </span>
          }
        </p>
      }

      <footer class="foot">
        @if (editing()) {
          <form class="close-form" novalidate (submit)="$event.preventDefault(); submitClose()">
            <textarea
              class="tj-textarea"
              rows="2"
              [placeholder]="'Главный вывод ' + (week ? 'недели' : 'месяца') + ': что повторить, что убрать'"
              [formField]="closeForm.note"
            ></textarea>
            <div class="form-row">
              <span class="form-label">Как прошло</span>
              <app-segmented [options]="gradeOptions" [(value)]="grade" />
              <span class="spacer"></span>
              <button app-button variant="ghost" size="sm" type="button" (click)="editing.set(false)">Отмена</button>
              <button app-button variant="primary" size="sm" type="submit">
                Закрыть {{ week ? 'неделю' : 'месяц' }}
              </button>
            </div>
          </form>
        } @else {
          @if (review(); as r) {
            <div class="takeaway">
              @if (r.note) {
                <p class="note">{{ r.note }}</p>
              }
              <p class="takeaway-meta">
                @if (r.grade) {
                  <span class="grade">{{ grades[r.grade] }}</span>
                }
                <span>{{ r.note ? 'закрыто' : 'закрыто без вывода' }} {{ closedAt(r.closedAt) }}</span>
                <button type="button" class="link" (click)="reopen.emit()">Открыть заново</button>
              </p>
            </div>
          } @else {
            <button app-button [variant]="pending() ? 'primary' : 'outline'" size="sm" (click)="editing.set(true)">
              Закрыть {{ week ? 'неделю' : 'месяц' }}
            </button>
            @if (pending()) {
              <span class="nudge">{{ week ? 'Неделя' : 'Месяц' }} позади — подведите итог</span>
            }
          }
          <button app-button class="snap" variant="ghost" size="sm" (click)="shareSnapshot()">
            <app-icon name="camera" style="--icon-size: 14px" />
            Снимок
          </button>
        }
      </footer>
    </article>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; }

    // Слева — период и его счётчики, посередине — дни, справа — итог.
    .period {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(140px, auto);
      grid-template-areas:
        'title    bars     result'
        'facts    bars     result'
        'mistakes mistakes mistakes'
        'foot     foot     foot';
      column-gap: $space-8;
      row-gap: $space-3;
      padding: $space-4 $space-5;
    }

    .period.pending { border-color: var(--accent-muted); }

    // ── Шапка ──

    .title {
      grid-area: title;
      align-self: start;
      display: flex;
      align-items: baseline;
      gap: $space-3;
      min-width: 0;
    }

    .label {
      margin: 0;
      font-size: $text-lg;
      font-weight: 600;
      white-space: nowrap;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: $text-xs;
      color: var(--fg-subtle);
    }

    // Идущий период — точка-статус бренда, без плашки.
    .status.live::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-fg);
    }

    .result {
      grid-area: result;
      align-self: start;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }

    .net { @include figure(24px); }

    .delta {
      font-size: $text-xs;
      color: var(--fg-subtle);
      white-space: nowrap;
    }

    // ── Счётчики: подпись над значением, тонкие разделители ──

    .facts {
      grid-area: facts;
      display: flex;
      flex-wrap: wrap;
      row-gap: $space-3;
      margin: 0;
    }

    .fact {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 0 $space-5;
      border-left: 1px solid var(--border-muted);

      &:first-child {
        padding-left: 0;
        border-left: none;
      }
    }

    dt {
      font-size: $text-xs;
      color: var(--fg-subtle);
      white-space: nowrap;
    }

    dd {
      margin: 0;
      font-size: $text-md;
      font-weight: 500;
      color: var(--fg-default);
      white-space: nowrap;
    }

    .of {
      font-weight: 400;
      color: var(--fg-muted);
    }

    // ── Дни: столбики от нулевой линии ──

    .bars {
      grid-area: bars;
      align-self: center;
      display: flex;
      gap: 4px;
    }

    .bars.month { gap: 2px; }

    .bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      width: 20px;
    }

    .bars.month .bar { width: 6px; }

    .track {
      position: relative;
      width: 100%;
      height: 40px;

      // Нулевая линия.
      &::before {
        content: '';
        position: absolute;
        inset: 50% -2px auto;
        height: 1px;
        background: var(--border-default);
      }
    }

    // Высота — не меньше 5% дорожки (2px), см. bars().
    .track i {
      position: absolute;
      left: 2px;
      right: 2px;
    }

    .bars.month .track i { left: 0; right: 0; }

    .track i.pos {
      bottom: 50%;
      background: var(--success-fg);
    }

    .track i.neg {
      top: 50%;
      background: var(--danger-fg);
    }

    .track i.none {
      top: calc(50% - 2px);
      left: calc(50% - 2px);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--border-strong);
    }

    .bar b {
      font-size: 10px;
      font-weight: 400;
      color: var(--fg-subtle);
    }

    // ── Разбор: нейтральной строкой, самые дорогие — первыми ──

    .mistakes {
      grid-area: mistakes;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px $space-5;
      margin: 2px 0 0;
      font-size: $text-sm;
      color: var(--fg-default);
    }

    .mistakes-label {
      color: var(--fg-subtle);
      font-size: $text-xs;
    }

    .mistake { white-space: nowrap; }
    .count { color: var(--fg-muted); }
    .cost { margin-left: 4px; color: var(--fg-muted); }

    // ── Закрытие ──

    .foot {
      grid-area: foot;
      display: flex;
      align-items: center;
      gap: $space-3;
      padding-top: $space-3;
      border-top: 1px solid var(--border-muted);
    }

    .snap { margin-left: auto; }

    .nudge {
      font-size: $text-sm;
      color: var(--fg-muted);
    }

    .takeaway {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .note {
      margin: 0;
      font-size: $text-md;
      line-height: 1.45;
      color: var(--fg-default);
      white-space: pre-wrap;
    }

    .takeaway-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px $space-3;
      margin: 0;
      font-size: $text-xs;
      color: var(--fg-subtle);
    }

    .grade { color: var(--fg-muted); }

    .link {
      appearance: none;
      background: none;
      border: none;
      padding: 0;
      color: var(--fg-muted);
      font-size: $text-xs;
      cursor: pointer;

      &:hover { color: var(--fg-default); text-decoration: underline; }
      @include focus-ring;
    }

    .close-form { display: flex; flex-direction: column; gap: $space-2; width: 100%; }
    .close-form textarea { resize: vertical; min-height: 56px; }
    .form-row { display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; }
    .form-label { font-size: $text-sm; color: var(--fg-muted); }
    .spacer { flex: 1; }

    // Телефон: итог рядом с названием, счётчики сеткой 2×2, без столбиков.
    @media (max-width: 760px) {
      .period {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          'title    result'
          'facts    facts'
          'mistakes mistakes'
          'foot     foot';
        padding: $space-3 $space-4;
        column-gap: $space-4;
      }

      .title {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }

      .bars { display: none; }

      .facts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: $space-3 $space-4;
        margin-top: $space-1;
      }

      .fact {
        padding: 0;
        border-left: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodCard {
  private readonly share = inject(ShareService);

  readonly period = input.required<PeriodSummary>();
  readonly review = input<PeriodReview | null>(null);
  /** Последний завершённый, но не закрытый период — его ждут. */
  readonly pending = input(false);

  readonly closePeriod = output<PeriodClose>();
  readonly reopen = output<void>();

  protected readonly editing = signal(false);
  protected readonly grade = signal<string>('');
  protected readonly model = signal({ note: '' });
  protected readonly closeForm = form(this.model, (p) => {
    maxLength(p.note, REVIEW_NOTE_MAX, { message: `Не длиннее ${REVIEW_NOTE_MAX} символов` });
  });

  protected readonly grades = REVIEW_GRADE_LABELS;
  protected readonly gradeOptions: SegmentOption[] = (Object.keys(REVIEW_GRADE_LABELS) as ReviewGrade[]).map(
    (value) => ({ value, label: REVIEW_GRADE_LABELS[value] }),
  );

  /** Высота столбика — доля от самого большого по модулю дня (до половины дорожки). */
  protected readonly bars = computed(() => {
    const bars = this.period().bars;
    const max = Math.max(1e-9, ...bars.map((b) => Math.abs(b.value ?? 0)));
    return bars.map((b) => ({
      ...b,
      height: b.value === null ? 0 : Math.max(5, (Math.abs(b.value) / max) * 50),
      title: b.value === null ? `${b.label}: без сделок` : `${b.label}: ${formatMoney(b.value, { sign: true })}`,
    }));
  });

  protected readonly barsLabel = computed(() => {
    const p = this.period();
    return `Дни: ${p.greenDays} в плюсе, ${p.redDays} в минусе`;
  });

  /** Автотеги периода: самые дорогие — первыми. */
  protected readonly mistakes = computed(() =>
    [...this.period().tags]
      .sort((a, b) => a.pnl - b.pnl)
      .map((t) => ({ ...t, label: AUTO_TAG_SHORT[t.tag], hint: AUTO_TAG_LABELS[t.tag] })),
  );

  protected shareSnapshot(): void {
    const period = this.period();
    this.share.open({
      title: period.span === 'week' ? 'Снимок недели' : 'Снимок месяца',
      fileName: periodShareFileName(period.key),
      build: ({ mask }) => periodShareCard(period, mask),
    });
  }

  protected submitClose(): void {
    if (this.closeForm().invalid()) return;
    const grade = this.grade();
    this.closePeriod.emit({
      note: this.model().note,
      grade: grade === 'plan' || grade === 'mistakes' || grade === 'tilt' ? grade : null,
    });
    this.editing.set(false);
    this.model.set({ note: '' });
    this.grade.set('');
  }

  protected money(value: number, sign = false): string {
    return formatMoney(value, { sign });
  }

  protected percent(fraction: number): string {
    return `${Math.round(fraction * 100)}%`;
  }

  protected closedAt(iso: string): string {
    return formatDateTime(iso);
  }
}
