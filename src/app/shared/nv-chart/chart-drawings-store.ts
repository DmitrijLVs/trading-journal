import { Injectable } from '@angular/core';
import type { Drawing, DrawingInput } from '@nv/tools';

const STORAGE_PREFIX = 'tj.drawings.';

/**
 * Рисунки графиков по символу — как в TradingView: уровень, проведённый на
 * BTCUSDT, виден на любой сделке по BTCUSDT и на любом таймфрейме (якоря —
 * время и цена). Хранятся в localStorage браузера.
 */
@Injectable({ providedIn: 'root' })
export class ChartDrawingsStore {
  load(symbol: string): DrawingInput[] {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + symbol);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as DrawingInput[]) : [];
    } catch {
      return [];
    }
  }

  save(symbol: string, drawings: readonly Drawing[]): void {
    try {
      if (drawings.length === 0) {
        localStorage.removeItem(STORAGE_PREFIX + symbol);
        return;
      }
      const inputs: DrawingInput[] = drawings.map((d) => ({
        id: d.id,
        type: d.type,
        pane: d.pane,
        points: d.points,
        style: d.style,
        locked: d.locked,
        hidden: d.hidden,
        text: d.text,
        version: d.version,
      }));
      localStorage.setItem(STORAGE_PREFIX + symbol, JSON.stringify(inputs));
    } catch {
      // приватный режим или переполнение — рисунки живут до перезагрузки
    }
  }
}
