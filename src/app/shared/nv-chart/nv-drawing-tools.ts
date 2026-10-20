import type { Bindings, DrawingStyle, Measurement, ToolTexts } from '@nv/tools';
import type { IconName } from '../ui/icons';

/** Инструмент рисования в тулбаре графика. */
export interface DrawingTool {
  /** Имя инструмента в @nv/tools. */
  name: string;
  label: string;
  icon: IconName;
  /** Горячая клавиша или жест — в подсказке кнопки. */
  hint: string;
}

/** Основные инструменты журнала: линейка, уровень, коррекция Фибоначчи. */
export const DRAWING_TOOLS: readonly DrawingTool[] = [
  { name: 'measure', label: 'Линейка', icon: 'ruler', hint: 'Shift + клик' },
  { name: 'horizontalLine', label: 'Уровень', icon: 'level', hint: 'Alt + H' },
  { name: 'fibRetracement', label: 'Фибоначчи', icon: 'fib', hint: 'Alt + F' },
];

export const DRAWING_TOOL_NAMES: readonly string[] = DRAWING_TOOLS.map((tool) => tool.name);

/** Команды, которые остаются из карты клавиш движка помимо инструментов. */
const COMMANDS = ['cursor', 'cancel', 'deleteSelected', 'undo', 'redo'];

/** Клавиши и жесты только наших инструментов: остальные (тренд, луч по ПКМ…) выключены. */
export function drawingBindings(defaults: Readonly<Bindings>): Bindings {
  const bindings: Bindings = {};
  for (const action of Object.keys(defaults)) {
    const kept = DRAWING_TOOL_NAMES.includes(action) || COMMANDS.includes(action);
    bindings[action] = kept ? (defaults[action] ?? []) : [];
  }
  return bindings;
}

/** Уровень подписывает свою цену на шкале — как в TradingView. */
export const TOOL_DEFAULTS: Readonly<Record<string, DrawingStyle>> = {
  horizontalLine: { axisLabel: true },
};

export const TOOL_TEXTS: Partial<ToolTexts> = {
  target: 'Тейк',
  stop: 'Стоп',
  riskReward: 'Риск/прибыль',
  qty: 'Кол-во',
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
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} д`);
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} мин`);
  return parts.length ? parts.join(' ') : '0 мин';
}
