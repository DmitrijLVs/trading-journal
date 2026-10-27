import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { PeriodSummary, shortDay } from '../analytics/data/periods';
import { AUTO_TAG_SHORT } from '../analytics/data/behavior';
import { PeriodReview, REVIEW_GRADE_LABELS, REVIEW_NOTE_MAX, ReviewGrade } from './data/review.model';
import { formatDateTime, formatMoney } from '../trades/data/trade.model';
import { PnlValue } from '../../shared/ui/pnl-value';
import { Button } from '../../shared/ui/button';
import { Segmented, SegmentOption } from '../../shared/ui/segmented';

export interface PeriodClose {
  note: string;
  grade: ReviewGrade | null;
}

/**
 * Итог недели или месяца с ритуалом закрытия: цифры периода, дни, ошибки,
 * а внизу — вывод трейдера от руки («что повторить, что убрать») и оценка.
 */
@Component({
  selector: 'app-period-card',
  imports: [FormField, PnlValue, Button, Segmented],
  template: `
    @let p = period();
    <article class="period tj-card" [class.pending]="pending()" [id]="p.key">
      <header class="head">
        <div class="title">
          <div class="label-row">
            <span class="label">{{ p.label }}</span>
            @if (p.isCurrent) {
              <span class="badge now">{{ p.span === 'week' ? 'неделя идёт' : 'месяц идёт' }}</span>
            } @else if (review()) {
              <span class="stamp">закрыт{{ p.span === 'week' ? 'а' : '' }}</span>
            }
          </div>
          <span class="meta">
            {{ p.trades }} сд. · винрейт {{ percent(p.winRate) }} · комиссии {{ money(p.fees) }}
          </span>
        </div>

        <div class="bars" [class.month]="p.span === 'month'" aria-hidden="true">
          @for (bar of bars(); track $index) {
            <span class="bar" [title]="bar.title">
              @if (bar.value === null) {
                <i class="none"></i>
              } @else {
                <i [class.pos]="bar.value > 0" [class.neg]="bar.value < 0" [style.height.%]="bar.height"></i>
              }
              @if (p.span === 'week') {
                <b>{{ bar.label }}</b>
              }
            </span>
          }
        </div>

        <div class="result">
          <app-pnl class="net" [value]="p.net" />
          @if (p.deltaNet !== null) {
            <span class="delta" [class.up]="p.deltaNet > 0" [class.down]="p.deltaNet < 0">
              {{ money(p.deltaNet, true) }} к {{ p.span === 'week' ? 'прошлой' : 'прошлому' }}
            </span>
          }
        </div>
      </header>

      <div class="facts">
        <span>{{ p.greenDays }} из {{ p.tradingDays }} {{ daysWord(p.tradingDays) }} в плюсе</span>
        @if (p.bestDay; as best) {
          <span>лучший — {{ day(best.date) }} <b class="pos">{{ money(best.pnl, true) }}</b></span>
        }
        @if (p.worstDay; as worst) {
          <span>худший — {{ day(worst.date) }} <b class="neg">{{ money(worst.pnl, true) }}</b></span>
        }
        <span>до комиссий <b [class.pos]="p.gross > 0" [class.neg]="p.gross < 0">{{ money(p.gross, true) }}</b></span>
        @for (t of p.tags; track t.tag) {
          <span class="tj-tag" [class]="'tj-tag ' + t.tag">{{ short[t.tag] }} ×{{ t.count }} · {{ money(t.pnl, true) }}</span>
        }
      </div>

      <footer class="foot">
        @if (review(); as r) {
          <div class="takeaway">
            <p class="note">{{ r.note || 'закрыто без вывода' }}</p>
            <div class="takeaway-meta">
              @if (r.grade) {
                <span class="grade" [class]="'grade ' + r.grade">{{ grades[r.grade] }}</span>
              }
              <span>закрыто {{ closedAt(r.closedAt) }}</span>
              <button type="button" class="link" (click)="reopen.emit()">открыть заново</button>
            </div>
          </div>
        } @else if (editing()) {
          <form class="close-form" novalidate (submit)="$event.preventDefault(); submitClose()">
            <textarea
              class="tj-textarea tj-textarea--hand"
              rows="2"
              [placeholder]="'Главный вывод ' + (p.span === 'week' ? 'недели' : 'месяца') + ': что повторить, что убрать'"
              [formField]="closeForm.note"
            ></textarea>
            <div class="form-row">
              <span class="form-label">Как прошло:</span>
              <app-segmented [options]="gradeOptions" [(value)]="grade" />
              <span class="spacer"></span>
              <button app-button variant="ghost" size="sm" type="button" (click)="editing.set(false)">Отмена</button>
              <button app-button variant="primary" size="sm" type="submit">
                Закрыть {{ p.span === 'week' ? 'неделю' : 'месяц' }}
              </button>
            </div>
          </form>
        } @else {
          <button app-button [variant]="pending() ? 'primary' : 'outline'" size="sm" (click)="editing.set(true)">
            Закрыть {{ p.span === 'week' ? 'неделю' : 'месяц' }}
          </button>
          @if (pending()) {
            <span class="nudge">{{ p.span === 'week' ? 'неделя' : 'месяц' }} позади — подведите итог</span>
          }
        }
      </footer>
    </article>
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; }

    .period { padding: $space-4 $space-5; display: flex; flex-direction: column; gap: $space-3; }
    .period.pending { border-style: dashed; border-color: var(--accent-muted); }

    .head { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(150px, auto); align-items: center; gap: $space-5; }
    .title { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .label-row { display: flex; align-items: center; gap: $space-2; }
    .label { font-size: $text-lg; font-weight: 600; }
    .meta { font-size: $text-xs; color: var(--fg-subtle); }
    .badge.now { font-size: $text-xs; padding: 1px 8px; border-radius: $radius-full; background: var(--accent-subtle); color: var(--accent-fg); }
    // Штамп «закрыта» — от руки, чуть наискось.
    .stamp {
      @include coach-voice(17px);
      color: var(--success-fg);
      border: 1.5px solid currentColor;
      border-radius: 6px;
      padding: 0 7px;
      transform: rotate(-4deg);
      opacity: 0.9;
    }

    .bars { display: flex; align-items: center; gap: 4px; height: 52px; }
    .bars.month { gap: 2px; }
    .bar { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 18px; height: 100%; }
    .bars.month .bar { width: 6px; }
    .bar i {
      display: block;
      width: 100%;
      min-height: 2px;
      max-height: 50%;
      border-radius: 2px;
      background: var(--fg-subtle);
    }
    // Плюс — вверх от середины, минус — вниз.
    .bar i.pos { background: var(--success-fg); align-self: center; transform: translateY(-50%); }
    .bar i.neg { background: var(--danger-fg); transform: translateY(50%); }
    .bar i.none { width: 4px; height: 4px; min-height: 0; border-radius: 50%; background: var(--border-default); }
    .bar b { position: absolute; bottom: -14px; font-size: 10px; font-weight: 400; color: var(--fg-subtle); }

    .result { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .net { @include figure(26px); }
    .delta { font-size: $text-xs; color: var(--fg-subtle); white-space: nowrap; }
    .delta.up { color: var(--success-fg); }
    .delta.down { color: var(--danger-fg); }

    .facts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px $space-4; font-size: $text-sm; color: var(--fg-muted); }
    .facts b { font-family: $font-mono; font-weight: 600; }
    .pos { color: var(--success-fg); }
    .neg { color: var(--danger-fg); }

    .foot { display: flex; align-items: center; gap: $space-3; padding-top: $space-3; border-top: 1px solid var(--border-muted); }
    .nudge { @include coach-voice(17px); color: var(--accent-fg); }

    .takeaway { display: flex; flex-direction: column; gap: 4px; width: 100%; }
    .takeaway .note { margin: 0; @include coach-voice(20px); color: var(--fg-default); white-space: pre-wrap; }
    .takeaway-meta { display: flex; align-items: center; gap: $space-3; font-size: $text-xs; color: var(--fg-subtle); }
    .grade { padding: 1px 8px; border-radius: $radius-full; background: var(--canvas-inset); color: var(--fg-muted); }
    .grade.plan { background: var(--success-subtle); color: var(--success-fg); }
    .grade.mistakes { background: var(--attention-subtle); color: var(--attention-fg); }
    .grade.tilt { background: var(--danger-subtle); color: var(--danger-fg); }
    .link { appearance: none; background: none; border: none; padding: 0; color: var(--fg-muted); font-size: $text-xs; cursor: pointer; &:hover { color: var(--fg-default); text-decoration: underline; } }

    .close-form { display: flex; flex-direction: column; gap: $space-2; width: 100%; }
    .close-form textarea { width: 100%; resize: vertical; min-height: 56px; }
    .form-row { display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; }
    .form-label { font-size: $text-sm; color: var(--fg-muted); }
    .spacer { flex: 1; }

    @media (max-width: 760px) {
      .period { padding: $space-3 $space-4; }
      .head { grid-template-columns: 1fr auto; }
      .bars { display: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodCard {
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

  protected readonly short = AUTO_TAG_SHORT;
  protected readonly grades = REVIEW_GRADE_LABELS;
  protected readonly gradeOptions: SegmentOption[] = (Object.keys(REVIEW_GRADE_LABELS) as ReviewGrade[]).map(
    (value) => ({ value, label: REVIEW_GRADE_LABELS[value] }),
  );

  /** Высота столбика — доля от максимального по модулю дня периода (до половины ячейки). */
  protected readonly bars = computed(() => {
    const bars = this.period().bars;
    const max = Math.max(1e-9, ...bars.map((b) => Math.abs(b.value ?? 0)));
    return bars.map((b) => ({
      ...b,
      height: b.value === null ? 0 : Math.max(4, (Math.abs(b.value) / max) * 50),
      title: b.value === null ? `${b.label}: без сделок` : `${b.label}: ${formatMoney(b.value, { sign: true })}`,
    }));
  });

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

  protected day(date: string): string {
    return shortDay(date);
  }

  protected closedAt(iso: string): string {
    return formatDateTime(iso);
  }

  protected daysWord(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'дня';
    return 'дней';
  }
}
