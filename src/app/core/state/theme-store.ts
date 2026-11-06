import { Injectable, effect, signal } from '@angular/core';
import { bumpThemeTick } from './theme-tick';

/**
 * «Ночь» — тёмная основная, «День» — светлая. Токены: styles/_tokens.scss
 * и styles/_theme.scss. Старые значения в localStorage: `paper` читается как
 * светлая, `carmine`/`graphite` — как тёмная.
 */
export type ThemeName = 'dark' | 'light';

export const THEME_LABELS: Record<ThemeName, string> = {
  dark: 'Ночь',
  light: 'День',
};

const STORAGE_KEY = 'tj.theme';
const DENSITY_KEY = 'tj.density';

/** Плотность таблиц: строки 46px или компактные — для сотен сделок в день. */
export type Density = 'comfortable' | 'compact';

export const DENSITY_LABELS: Record<Density, string> = {
  comfortable: 'Обычная',
  compact: 'Компактная',
};

function readStoredDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

function readStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'paper' ? 'light' : 'dark';
  } catch {
    return 'dark';
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
  private readonly _density = signal<Density>(readStoredDensity());
  readonly theme = this.current.asReadonly();
  readonly density = this._density.asReadonly();

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

    effect(() => {
      const density = this._density();
      document.documentElement.dataset['density'] = density;
      try {
        localStorage.setItem(DENSITY_KEY, density);
      } catch {
        // приватный режим
      }
    });
  }

  setDensity(density: Density): void {
    this._density.set(density);
  }

  setTheme(theme: ThemeName): void {
    this.current.set(theme);
  }

  private apply(theme: ThemeName): void {
    document.documentElement.dataset['theme'] = theme;
  }
}
