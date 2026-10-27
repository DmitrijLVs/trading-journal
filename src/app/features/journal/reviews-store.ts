import { Injectable, computed, inject } from '@angular/core';
import { JournalConfigStore } from '../../core/config/journal-config-store';
import {
  PeriodReview,
  PeriodReviews,
  REVIEW_NOTE_MAX,
  ReviewGrade,
  sanitizeReviews,
} from './data/review.model';

/** Закрытые недели и месяцы — в профиле, раздел `journal` (`{ reviews }`). */
@Injectable({ providedIn: 'root' })
export class ReviewsStore {
  private readonly config = inject(JournalConfigStore);

  readonly reviews = computed<PeriodReviews>(() => sanitizeReviews(this.config.state().reviews));

  review(key: string): PeriodReview | null {
    return this.reviews()[key] ?? null;
  }

  close(key: string, note: string, grade: ReviewGrade | null): void {
    const review: PeriodReview = {
      closedAt: new Date().toISOString(),
      note: note.trim().slice(0, REVIEW_NOTE_MAX),
      grade,
    };
    this.config.patch({ reviews: sanitizeReviews({ ...this.reviews(), [key]: review }) });
  }

  reopen(key: string): void {
    const { [key]: _removed, ...rest } = this.reviews();
    this.config.patch({ reviews: rest });
  }
}
