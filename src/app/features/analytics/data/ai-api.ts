import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type AiReviewKind = 'trade' | 'day';

/** Ответ «Разбора от ИИ» (server/ai-review.mjs). */
export interface AiReview {
  /** Главный вывод одной фразой — заголовок голосом тренера. */
  headline: string;
  review: string;
  actions: string[];
  tone: 'good' | 'mixed' | 'bad';
}

/**
 * «Разбор от ИИ» — эндпоинт нашего сервера (не гейтвея платформы): он проверяет
 * ту же сессию и спрашивает Claude. Ключ сейчас серверный; когда пользователь
 * будет вставлять свой, он поедет отсюда заголовком — сервер берёт его в `apiKeyFor`.
 */
@Injectable({ providedIn: 'root' })
export class AiApi {
  private readonly http = inject(HttpClient);

  review(kind: AiReviewKind, facts: Record<string, unknown>): Promise<AiReview> {
    return firstValueFrom(this.http.post<AiReview>('/ai/review', { kind, facts }));
  }
}
