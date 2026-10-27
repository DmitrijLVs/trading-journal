import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthStore } from '../auth/auth-store';
import { LayoutsApi } from './layouts-api';

/**
 * Раздел профиля `journal` целиком: правила дисциплины и закрытые недели и
 * месяцы. Один владелец у раздела, иначе сторы затирали бы записи друг друга
 * (сервер хранит последний PUT). Содержимое разделов знают их сторы.
 */
export interface JournalConfig {
  discipline?: unknown;
  reviews?: unknown;
}

const STORAGE_KEY = 'tj.journal-config';
const SAVE_DEBOUNCE_MS = 800;

@Injectable({ providedIn: 'root' })
export class JournalConfigStore {
  private readonly api = inject(LayoutsApi);
  private readonly auth = inject(AuthStore);
  private readonly _state = signal<JournalConfig>(restore());
  private loadedFor: string | null = null;
  private synced: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly state = this._state.asReadonly();

  constructor() {
    effect(() => {
      const json = JSON.stringify(this._state());
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch {
        // приватный режим — живём без кэша
      }
      untracked(() => this.scheduleSave(json));
    });
    effect(() => {
      const owner = this.auth.user()?.id ?? null;
      if (owner && owner !== this.loadedFor) untracked(() => void this.loadFromServer(owner));
    });
  }

  patch(part: Partial<JournalConfig>): void {
    this._state.update((s) => ({ ...s, ...part }));
  }

  private async loadFromServer(owner: string): Promise<void> {
    this.loadedFor = owner;
    try {
      const raw = await this.api.load('journal');
      if (raw && typeof raw === 'object') {
        const state = raw as JournalConfig;
        this.synced = JSON.stringify(state);
        this._state.set(state);
      }
    } catch {
      this.loadedFor = null;
    }
  }

  private scheduleSave(json: string): void {
    if (!this.loadedFor || json === this.synced) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.api.save('journal', JSON.parse(json)).then(
        () => (this.synced = json),
        () => undefined,
      );
    }, SAVE_DEBOUNCE_MS);
  }
}

function restore(): JournalConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JournalConfig) : {};
  } catch {
    return {};
  }
}
