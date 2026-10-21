import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Раскладки виджетов в профиле пользователя (Configuration-Service): бэкенд
 * хранит их как непрозрачный JSON до 64 КБ, содержимое — забота фронта.
 */
@Injectable({ providedIn: 'root' })
export class LayoutsApi {
  private readonly http = inject(HttpClient);

  /** Сохранённое состояние; null — пользователь ещё ничего не сохранял. */
  async load(scope: 'overview'): Promise<unknown | null> {
    try {
      const body = await firstValueFrom(
        this.http.get<{ state: unknown }>(`/config/widgets/${scope}`),
      );
      return body.state;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }

  async save(scope: 'overview', state: unknown): Promise<void> {
    await firstValueFrom(this.http.put(`/config/widgets/${scope}`, state));
  }
}
