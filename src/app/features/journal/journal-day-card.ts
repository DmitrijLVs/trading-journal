import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JournalDay, JournalStore } from './journal-store';
import {
  MOOD_EMOJI,
  MOOD_LABELS,
  Mood,
  calculatePnl,
  calculateRMultiple,
  formatDuration,
} from '../trades/data/trade.model';
import { Icon } from '../../shared/ui/icon';
import { Button } from '../../shared/ui/button';
import { PnlValue } from '../../shared/ui/pnl-value';
import { Select, SelectOption } from '../../shared/ui/select';
import { Toggle } from '../../shared/ui/toggle';
import { ToastService } from '../../shared/ui/toast';
import { SketchFrame } from '../../shared/ui/sketch/sketch-frame';

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** Карточка торгового дня: результат, сделки, заметка с настроением. */
@Component({
  selector: 'app-journal-day-card',
  imports: [SketchFrame, RouterLink, Icon, Button, PnlValue, Select, Toggle],
  templateUrl: './journal-day-card.html',
  styleUrl: './journal-day-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalDayCard {
  private readonly store = inject(JournalStore);
  private readonly toast = inject(ToastService);

  readonly day = input.required<JournalDay>();

  protected readonly expanded = signal(false);
  protected readonly editing = signal(false);
  protected readonly noteDraft = signal('');
  protected readonly moodDraft = signal<string | null>(null);
  protected readonly planDraft = signal(true);

  protected readonly moodOptions: SelectOption[] = (Object.keys(MOOD_LABELS) as Mood[]).map((m) => ({
    value: m,
    label: `${MOOD_EMOJI[m]} ${MOOD_LABELS[m]}`,
  }));

  protected readonly title = computed(() => {
    const d = new Date(`${this.day().date}T12:00:00Z`);
    return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });

  protected readonly winRate = computed(() => {
    const day = this.day();
    return day.trades.length === 0 ? 0 : (day.wins / day.trades.length) * 100;
  });

  protected readonly moodEmoji = computed(() => {
    const mood = this.day().entry?.mood;
    return mood ? MOOD_EMOJI[mood] : null;
  });

  protected readonly rows = computed(() =>
    this.day().trades.map((trade) => ({
      trade,
      pnl: calculatePnl(trade),
      r: calculateRMultiple(trade),
      duration: formatDuration(trade.openedAt, trade.closedAt),
    })),
  );

  protected startEdit(): void {
    const entry = this.day().entry;
    this.noteDraft.set(entry?.note ?? '');
    this.moodDraft.set(entry?.mood ?? null);
    this.planDraft.set(entry?.followedPlan ?? true);
    this.editing.set(true);
  }

  protected async save(): Promise<void> {
    await this.store.save({
      date: this.day().date,
      note: this.noteDraft().trim(),
      mood: (this.moodDraft() as Mood) ?? null,
      followedPlan: this.planDraft(),
    });
    this.editing.set(false);
    this.toast.success('Заметка дня сохранена');
  }
}
