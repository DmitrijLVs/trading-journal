import { Injectable, computed, inject } from '@angular/core';
import { JournalConfigStore } from '../../core/config/journal-config-store';
import { DEFAULT_DISCIPLINE, DisciplineSettings, sanitizeDiscipline } from './data/discipline.model';

/**
 * Правила дисциплины пользователя — в профиле, раздел `journal`
 * (`{ discipline }`), рядом с закрытыми неделями и месяцами.
 */
@Injectable({ providedIn: 'root' })
export class DisciplineStore {
  private readonly config = inject(JournalConfigStore);

  readonly settings = computed<DisciplineSettings>(() =>
    sanitizeDiscipline(this.config.state().discipline),
  );

  update(patch: Partial<DisciplineSettings>): void {
    this.config.patch({ discipline: sanitizeDiscipline({ ...this.settings(), ...patch }) });
  }

  reset(): void {
    this.config.patch({ discipline: DEFAULT_DISCIPLINE });
  }
}
