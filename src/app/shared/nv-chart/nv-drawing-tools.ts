import type { DrawingStyle, Measurement, ToolTexts } from '@nv/tools';

/** Уровень и горизонтальный луч подписывают свою цену на шкале — как в TradingView и wintrading. */
export const TOOL_DEFAULTS: Readonly<Record<string, DrawingStyle>> = {
  horizontalLine: { axisLabel: true },
  horizontalRay: { axisLabel: true },
};

export const TOOL_TEXTS: Partial<ToolTexts> = {
  target: 'Тейк',
  stop: 'Стоп',
  riskReward: 'Риск/прибыль',
  qty: 'Кол-во',
  openPnl: 'P&L',
  bars: 'бар.',
  volume: 'Объём',
  days: 'д',
  hours: 'ч',
  minutes: 'м',
  seconds: 'с',
};

const BAR_WORDS: readonly [string, string, string] = ['бар', 'бара', 'баров'];
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Подпись линейки: изменение цены и в %, затем бары и время. */
export function rulerText(m: Measurement): string {
  const sign = m.change >= 0 ? '+' : '−';
  const bars = Math.abs(m.bars);
  const lines = [
    `${sign}${m.changeText} (${sign}${Math.abs(m.percent).toFixed(2)}%)`,
    `${bars} ${barsWord(bars)} · ${spanText(m.ms)}`,
  ];
  if (m.volume !== null) lines.push(`Объём ${m.compact(m.volume)}`);
  return lines.join('\n');
}

function barsWord(count: number): string {
  const tail = count % 100;
  const last = count % 10;
  if (tail >= 11 && tail <= 14) return BAR_WORDS[2];
  if (last === 1) return BAR_WORDS[0];
  if (last >= 2 && last <= 4) return BAR_WORDS[1];
  return BAR_WORDS[2];
}

function spanText(ms: number): string {
  const total = Math.abs(ms);
  const days = Math.floor(total / DAY_MS);
  const hours = Math.floor((total % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((total % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((total % MINUTE_MS) / 1000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} д`);
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} мин`);
  // Секундный график: короткий замер без секунд был бы «0 мин».
  if (seconds > 0 && days === 0 && hours === 0 && minutes < 10) parts.push(`${seconds} с`);
  return parts.length ? parts.join(' ') : '0 с';
}
