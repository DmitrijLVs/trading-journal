import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JournalDay } from './journal-store';
import { calculatePnl, calculatePnlPercent, formatDuration, formatMoney } from '../trades/data/trade.model';
import { AUTO_TAG_SHORT } from '../analytics/data/behavior';
import { longDay } from '../analytics/data/periods';
import { dayShareCard } from './data/journal-share';
import { ShareService } from '../../shared/share/share-dialog';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { PnlValue } from '../../shared/ui/pnl-value';
import { SparkLine } from '../../shared/ui/spark-line';
import { Tooltip } from '../../shared/ui/tooltip';

/** Карточка торгового дня: итог, разбор ошибок строкой, сделки дня по раскрытию и снимок. */
@Component({
  selector: 'app-journal-day-card',
  imports: [RouterLink, Button, Icon, PnlValue, SparkLine, Tooltip],
  templateUrl: './journal-day-card.html',
  styleUrl: './journal-day-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalDayCard {
  private readonly share = inject(ShareService);

  readonly day = input.required<JournalDay>();

  protected readonly expanded = signal(false);

  protected readonly title = computed(() => longDay(this.day().date));

  protected readonly winRate = computed(() => {
    const day = this.day();
    return day.trades.length === 0 ? 0 : (day.wins / day.trades.length) * 100;
  });

  /** «реванш ×2 · тильт ×1» — пометки тренера за день, без цвета. */
  protected readonly mistakes = computed(() =>
    this.day()
      .tags.map((item) => `${AUTO_TAG_SHORT[item.tag]} ×${item.count}`)
      .join(' · '),
  );

  protected readonly fees = computed(() => formatMoney(this.day().fees));

  protected readonly rows = computed(() =>
    this.day().trades.map((trade) => ({
      trade,
      pnl: calculatePnl(trade),
      pct: calculatePnlPercent(trade),
      duration: formatDuration(trade.openedAt, trade.closedAt),
      time: formatTime(trade.closedAt),
    })),
  );

  protected shareSnapshot(): void {
    const day = this.day();
    this.share.open({
      title: 'Снимок дня',
      fileName: `day-${day.date}`,
      build: ({ mask }) => dayShareCard(day, mask),
    });
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
