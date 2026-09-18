import { Injectable, effect, signal } from '@angular/core';
import { bumpThemeTick } from './theme-tick';

/** «Графит» — тёмная основная, «Бумага» — светлая. Токены: styles/_theme.scss. */
export type ThemeName = 'graphite' | 'paper';

export const THEME_LABELS: Record<ThemeName, string> = {
  graphite: 'Графит',
  paper: 'Бумага',
};

const STORAGE_KEY = 'tj.theme';

function readStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'paper' ? 'paper' : 'graphite';
  } catch {
    return 'graphite';
  }
}

/**
 * Тема оформления. Ставит `data-theme` на <html> до первого рендера
 * (инстанцируется в provideAppInitializer), хранит выбор в localStorage
 * и сообщает графикам, что токены изменились.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly current = signal<ThemeName>(readStoredTheme());
  readonly theme = this.current.asReadonly();

  constructor() {
    // Синхронно — чтобы графики при первом вычислении читали уже нужные токены.
    this.apply(this.current());

    effect(() => {
      const theme = this.current();
      this.apply(theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // приватный режим — тема живёт только в сессии
      }
      bumpThemeTick();
    });
  }

  setTheme(theme: ThemeName): void {
    this.current.set(theme);
  }

  private apply(theme: ThemeName): void {
    document.documentElement.dataset['theme'] = theme;
  }
}
