import { Injectable, effect, signal } from '@angular/core';
import { configureMoneyMask } from '../../features/trades/data/trade.model';

const STORAGE_KEY = 'tj.hideMoney';

/**
 * «Скрыть суммы»: деньги и объёмы — точками, знак, цвет и проценты остаются.
 * Настройка устройства (localStorage): на работе скрыто, дома — нет.
 * Создаётся в provideAppInitializer — хук маски стоит до первого рендера.
 */
@Injectable({ providedIn: 'root' })
export class PrivacyStore {
  private readonly _hidden = signal(readStored());
  readonly hidden = this._hidden.asReadonly();

  constructor() {
    // Форматтеры денег читают сигнал через хук — computed и шаблоны,
    // которые показывают суммы, пересчитываются при переключении.
    configureMoneyMask(() => this._hidden());
    effect(() => {
      const hidden = this._hidden();
      document.documentElement.dataset['money'] = hidden ? 'hidden' : 'shown';
      try {
        localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0');
      } catch {
        // приватный режим
      }
    });
  }

  toggle(): void {
    this._hidden.update((v) => !v);
  }

  setHidden(hidden: boolean): void {
    this._hidden.set(hidden);
  }
}

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
