import { signal } from '@angular/core';

/**
 * Счётчик смены темы. Живёт отдельно от chart-theme.ts, чтобы ThemeStore
 * (initial bundle) не тянул echarts: графики читают его через `cssVar()`,
 * и любой `computed` с опциями пересчитывается при переключении темы.
 */
const themeTick = signal(0);

export function bumpThemeTick(): void {
  themeTick.update((v) => v + 1);
}

export function currentThemeTick(): number {
  return themeTick();
}
