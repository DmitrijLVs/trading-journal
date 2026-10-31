// Иконки инструментов рисования и действий тулбара (штрихи 18 × 18) — те же, что в
// wintrading (tradehive-ui, shared/nv-chart/nv-drawbar/nv-tool-icons.ts), и русские названия
// инструментов, групп и разделов оттуда же: панель рисования журнала повторяет wintrading.

const DOT = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.5"/>`;

const ICONS: Readonly<Record<string, string>> = {
  cursor: '<path d="M5 3l9 6-4 1 2.5 5-2 1-2.5-5L5 14z" fill="currentColor" stroke="none"/>',
  // lines
  trendLine: `<path d="M3 15L15 3"/>${DOT(3.5, 14.5)}${DOT(14.5, 3.5)}`,
  ray: `<path d="M4 14L16 2"/>${DOT(4.5, 13.5)}`,
  infoLine: `<path d="M3 15L12 6"/>${DOT(3.5, 14.5)}<rect x="10" y="2" width="7" height="5" rx="1"/>`,
  extendedLine: `<path d="M1 17L17 1"/>${DOT(6, 12)}${DOT(12, 6)}`,
  trendAngle: '<path d="M3 15L14 4M3 15h12"/><path d="M8 15a5 5 0 0 0-1.5-3.5"/>',
  horizontalLine: `<path d="M1 9h16"/>${DOT(9, 9)}`,
  horizontalRay: `<path d="M5 9h12"/>${DOT(5, 9)}`,
  verticalLine: `<path d="M9 1v16"/>${DOT(9, 9)}`,
  crossLine: '<path d="M1 9h16M9 1v16"/>',
  // channels and pitchforks
  parallelChannel: '<path d="M2 11L12 3M6 15L16 7"/><path d="M4 13L14 5" stroke-dasharray="2 2"/>',
  flatTopBottom: '<path d="M2 14L16 7M2 4h14"/>',
  disjointChannel: '<path d="M2 12L16 6M2 4l14 8"/>',
  pitchfork: '<path d="M2 9h6M8 9l8-5M8 9h8M8 9l8 5"/>',
  schiffPitchfork: '<path d="M2 12l6-3M8 9l8-5M8 9h8M8 9l8 5"/>',
  modifiedSchiffPitchfork:
    '<path d="M4 10l4-1M8 9l8-5M8 9h8M8 9l8 5"/><circle cx="4" cy="10" r="1"/>',
  // fibonacci and gann
  fibRetracement: '<path d="M2 3h14M2 7h14M2 10h14M2 15h14"/>',
  fibExtension: '<path d="M2 15l4-8 4 5M9 3h8M9 7h8M9 11h8"/>',
  fibChannel: '<path d="M2 14L12 4M4 16L14 6M6 17.5L16 8" stroke-width="1.1"/>',
  fibTimeZone: '<path d="M2 2v14M4 2v14M7 2v14M11 2v14M16 2v14"/>',
  trendBasedFibTime: '<path d="M2 14l4-6 3 4M10 2v14M13 2v14M16 2v14"/>',
  fibSpeedFan: '<path d="M2 16L16 2M2 16L16 7M2 16L16 11M2 16L11 2"/>',
  fibCircles:
    '<circle cx="9" cy="9" r="3"/><circle cx="9" cy="9" r="5.5"/><circle cx="9" cy="9" r="8"/>',
  fibArcs: '<path d="M3 14a6 6 0 0 1 12 0M6 14a3 3 0 0 1 6 0"/><path d="M3 14h12"/>',
  gannFan: '<path d="M2 16L16 2M2 16L16 9M2 16L9 2M2 16L16 13M2 16L5 2"/>',
  gannBox: '<rect x="2" y="2" width="14" height="14"/><path d="M2 9h14M9 2v14M2 2l14 14"/>',
  // patterns
  xabcd: '<path d="M2 14l3-10 4 6 4-8 3 12"/><path d="M2 14l7-4" stroke-dasharray="2 2"/>',
  cypher: '<path d="M2 12l3-8 4 7 4-9 3 12"/>',
  abcd: '<path d="M2 14l4-10 5 6 5-8"/>',
  headAndShoulders:
    '<path d="M1 14l3-6 2 3 3-9 3 9 2-3 3 6"/><path d="M1 11h16" stroke-dasharray="2 2"/>',
  trianglePattern:
    '<path d="M2 3l4 11 4-8 4 6"/><path d="M2 3l14 7M6 14l10-4" stroke-dasharray="2 2"/>',
  threeDrives: '<path d="M1 15l3-4 2 2 3-6 2 2 3-6 3 2"/>',
  elliottImpulse:
    '<path d="M1 15l3-6 2 3 4-9 2 4 4-5"/><text x="12" y="17" font-size="6" fill="currentColor" stroke="none">5</text>',
  elliottCorrection: '<path d="M2 3l5 10 4-4 5 7"/>',
  elliottTriangle: '<path d="M1 4l3 10 3-8 3 6 3-4 3 3"/>',
  elliottDoubleCombo: '<path d="M2 3l4 8 3-3 4 7 3-2"/>',
  elliottTripleCombo: '<path d="M1 3l3 7 2-2 3 6 2-2 3 6 3-2"/>',
  // forecasting, measuring, volume
  longPosition:
    '<rect x="2" y="2" width="14" height="7" fill="rgba(8,153,129,.35)" stroke="none"/><rect x="2" y="9" width="14" height="5" fill="rgba(242,54,69,.35)" stroke="none"/><path d="M2 9h14"/>',
  shortPosition:
    '<rect x="2" y="4" width="14" height="5" fill="rgba(242,54,69,.35)" stroke="none"/><rect x="2" y="9" width="14" height="7" fill="rgba(8,153,129,.35)" stroke="none"/><path d="M2 9h14"/>',
  priceRange: '<path d="M2 3h14M2 15h14M9 4v10M7 6l2-2 2 2"/>',
  dateRange: '<path d="M3 2v14M15 2v14M4 9h10M12 7l2 2-2 2"/>',
  datePriceRange: '<rect x="2" y="3" width="14" height="12"/><path d="M9 4v10M3 9h12"/>',
  measure: '<path d="M9 2v14M6 5l3-3 3 3M6 13l3 3 3-3"/>',
  zoomArea:
    '<rect x="2.5" y="4.5" width="10" height="8" rx="1" stroke-dasharray="2 1.5"/><circle cx="12" cy="11" r="2.6"/><path d="M14 13l2.5 2.5"/>',
  fixedRangeVolumeProfile:
    '<path d="M3 2v14M15 2v14"/><path d="M3 4h5M3 7h8M3 10h10M3 13h4" stroke-width="2"/>',
  anchoredVolumeProfile: `<path d="M3 2v14"/><path d="M3 5h6M3 8h10M3 11h7M3 14h4" stroke-width="2"/>${DOT(3, 16)}`,
  anchoredVwap: `<path d="M2 14c3-1 4-7 7-7s4 4 7 2"/>${DOT(2, 14)}`,
  // shapes, brushes, arrows
  rectangle: '<rect x="3" y="5" width="12" height="8"/>',
  ellipse: '<ellipse cx="9" cy="9" rx="7" ry="4.5"/>',
  circle: '<circle cx="9" cy="9" r="6"/>',
  triangle: '<path d="M9 3l7 12H2z"/>',
  arc: '<path d="M2 14C4 4 14 4 16 14"/>',
  curve: '<path d="M2 14C8 14 6 4 16 4"/>',
  path: '<path d="M2 15l4-8 5 4 4-8"/><path d="M13 3h2v2"/>',
  polyline: '<path d="M2 15l3-9 6 3 5-6-2 12z"/>',
  brush: '<path d="M2 14c2-4 4 2 7-3s4-6 7-7"/>',
  highlighter: '<path d="M2 14c3-4 5 1 8-3s4-5 6-6" stroke-width="4" stroke-opacity=".5"/>',
  arrow: '<path d="M3 15L15 3M15 3H9M15 3v6"/>',
  arrowMarker:
    '<path d="M3 15L13 5" stroke-width="3"/><path d="M15 3l-1 6-5-5z" fill="currentColor"/>',
  arrowUp: '<path d="M9 2l5 6h-3v8H7V8H4z" fill="currentColor" stroke="none"/>',
  arrowDown: '<path d="M9 16l5-6h-3V2H7v8H4z" fill="currentColor" stroke="none"/>',
  // text
  text: '<path d="M4 4h10M9 4v11M7 15h4"/>',
  note: '<rect x="3" y="2" width="12" height="9" rx="1.5"/><path d="M6 11l3 4 3-4M6 5h6M6 8h4"/>',
  callout: '<rect x="7" y="2" width="9" height="7" rx="1.5"/><path d="M8 9L3 15"/>',
  priceLabel: '<path d="M3 6h9l4 3-4 3H3z"/>',
  priceNote: `<path d="M3 14L13 5"/>${DOT(3, 14)}<path d="M11 4h5"/>`,
  flagMark: '<path d="M5 16V2M5 3l9 3-9 3" />',
  signpost: '<path d="M9 16V8"/><rect x="3" y="2" width="12" height="6" rx="1"/>',
  // utility
  magnet: '<path d="M4 3v6a5 5 0 0 0 10 0V3M4 6h3M11 6h3"/>',
  keep: '<path d="M12 2l4 4-9 9H3v-4z"/><path d="M10 4l4 4"/>',
  hide: '<path d="M1 9s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="9" cy="9" r="2.2"/>',
  trash: '<path d="M3 5h12M7 5V3h4v2M5 5l1 11h6l1-11"/>',
  bell: '<path d="M5 12V8a4 4 0 0 1 8 0v4l1.5 2h-11z"/><path d="M7.5 16h3"/><path d="M9 2.5v1.5"/>',
  // A level's price on the scale: the line ending in a tag on the axis.
  axisLabel: '<path d="M16 2v14"/><path d="M1.5 9h4.5"/><path d="M6 9l2.5-2.5H16v5H8.5z"/>',
  keys: '<rect x="1.5" y="4.5" width="15" height="9" rx="1.5"/><path d="M4 7.5h1M7 7.5h1M10 7.5h1M13 7.5h1M5 10.5h8"/>',
  undo: '<path d="M6 4L2 8l4 4"/><path d="M2 8h9a5 5 0 0 1 0 10H8"/>',
  redo: '<path d="M12 4l4 4-4 4"/><path d="M16 8H7a5 5 0 0 0 0 10h3"/>',
  lock: '<rect x="4" y="8" width="10" height="8" rx="1"/><path d="M6 8V6a3 3 0 0 1 6 0v2"/>',
  unlock: '<rect x="4" y="8" width="10" height="8" rx="1"/><path d="M6 8V6a3 3 0 0 1 6 0"/>',
  front:
    '<rect x="6" y="6" width="9" height="9" fill="currentColor" fill-opacity=".35"/><path d="M3 12V3h9"/>',
  back: '<rect x="3" y="3" width="9" height="9"/><path d="M15 6v9H6" />',
  fill: '<path d="M4 10l5-7 5 7a5 5 0 0 1-10 0z" fill="currentColor" fill-opacity=".35"/>',
  textTool: '<path d="M4 4h10M9 4v11M7 15h4"/>',
  clone: '<rect x="2" y="5" width="9" height="9" rx="1"/><path d="M6 5V2h9v9h-4"/>',
  // A price tag going to the clipboard: the selection bar's "copy the price".
  copyPrice: '<rect x="6" y="6" width="10" height="10" rx="1.5"/><path d="M12 6V3.5A1.5 1.5 0 0 0 10.5 2h-7A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H6"/><path d="M8.5 11h5"/>',
  settings:
    '<g transform="scale(0.75)" stroke-width="1.9"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g>',
  more: '<circle cx="4" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="14" cy="9" r="1.2" fill="currentColor"/>',
};

/** SVG-разметка иконки (статичная строка из таблицы выше — без пользовательских данных). */
export function toolIcon(name: string, size = 18): string {
  const body = ICONS[name] ?? ICONS['trendLine'];
  return `<svg viewBox="0 0 18 18" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Кнопки тулбара: группы инструментов движка, которые делят кнопку и её выпадающий список. */
export const BAR_GROUPS: readonly { id: string; groups: readonly string[] }[] = [
  { id: 'lines', groups: ['lines', 'channels', 'pitchforks'] },
  { id: 'fib', groups: ['fibonacci', 'gann'] },
  { id: 'patterns', groups: ['patterns', 'elliott'] },
  { id: 'forecast', groups: ['forecast', 'volume'] },
  { id: 'measure', groups: ['measure'] },
  { id: 'shapes', groups: ['shapes', 'brushes', 'arrows'] },
  { id: 'text', groups: ['text'] },
];

/** Название инструмента по его имени в движке. */
export const TOOL_NAMES: Readonly<Record<string, string>> = {
  trendLine: 'Трендовая линия',
  ray: 'Луч',
  infoLine: 'Инфо-линия',
  extendedLine: 'Продлённая линия',
  trendAngle: 'Угол тренда',
  horizontalLine: 'Горизонтальная линия',
  horizontalRay: 'Горизонтальный луч',
  verticalLine: 'Вертикальная линия',
  crossLine: 'Перекрестие',
  parallelChannel: 'Параллельный канал',
  flatTopBottom: 'Плоский верх/низ',
  disjointChannel: 'Расходящийся канал',
  pitchfork: 'Вилы Эндрюса',
  schiffPitchfork: 'Вилы Шиффа',
  modifiedSchiffPitchfork: 'Модифицированные вилы Шиффа',
  fibRetracement: 'Коррекция Фибоначчи',
  fibExtension: 'Расширение Фибоначчи по тренду',
  fibChannel: 'Канал Фибоначчи',
  fibTimeZone: 'Временные зоны Фибоначчи',
  trendBasedFibTime: 'Время Фибоначчи по тренду',
  fibSpeedFan: 'Веер скорости Фибоначчи',
  fibCircles: 'Окружности Фибоначчи',
  fibArcs: 'Дуги Фибоначчи',
  gannFan: 'Веер Ганна',
  gannBox: 'Бокс Ганна',
  xabcd: 'Паттерн XABCD',
  cypher: 'Паттерн Cypher',
  abcd: 'Паттерн ABCD',
  headAndShoulders: 'Голова и плечи',
  trianglePattern: 'Треугольник',
  threeDrives: 'Три движения',
  elliottImpulse: 'Импульс Эллиотта (12345)',
  elliottCorrection: 'Коррекция Эллиотта (ABC)',
  elliottTriangle: 'Треугольник Эллиотта (ABCDE)',
  elliottDoubleCombo: 'Двойная комбинация (WXY)',
  elliottTripleCombo: 'Тройная комбинация (WXYXZ)',
  longPosition: 'Длинная позиция',
  shortPosition: 'Короткая позиция',
  priceRange: 'Диапазон цен',
  dateRange: 'Диапазон дат',
  datePriceRange: 'Диапазон дат и цен',
  measure: 'Линейка',
  zoomArea: 'Детализация: меньший таймфрейм',
  fixedRangeVolumeProfile: 'Профиль объёма (диапазон)',
  anchoredVolumeProfile: 'Профиль объёма (от точки)',
  anchoredVwap: 'VWAP от точки',
  rectangle: 'Прямоугольник',
  ellipse: 'Эллипс',
  circle: 'Круг',
  triangle: 'Треугольник (фигура)',
  arc: 'Дуга',
  curve: 'Кривая',
  path: 'Путь',
  polyline: 'Ломаная',
  brush: 'Карандаш',
  highlighter: 'Маркер',
  arrow: 'Стрелка',
  arrowMarker: 'Стрелка-маркер',
  arrowUp: 'Стрелка вверх',
  arrowDown: 'Стрелка вниз',
  text: 'Текст',
  note: 'Заметка',
  callout: 'Выноска',
  priceLabel: 'Ценовая метка',
  priceNote: 'Ценовая заметка',
  flagMark: 'Флажок',
  signpost: 'Указатель',
  cursor: 'Курсор',
};

/** Заголовок выпадающего списка группы. */
export const GROUP_NAMES: Readonly<Record<string, string>> = {
  lines: 'Линии и каналы',
  fib: 'Фибоначчи и Ганн',
  patterns: 'Паттерны и волны',
  forecast: 'Прогноз, измерения, объём',
  shapes: 'Фигуры, кисти, стрелки',
  text: 'Текст и заметки',
  measure: 'Измерения и зум',
};

/** Раздел внутри списка (группа движка). */
export const SECTION_NAMES: Readonly<Record<string, string>> = {
  lines: 'Линии',
  channels: 'Каналы',
  pitchforks: 'Вилы',
  fibonacci: 'Фибоначчи',
  gann: 'Ганн',
  patterns: 'Паттерны',
  elliott: 'Волны Эллиотта',
  forecast: 'Прогноз',
  measure: 'Измерения',
  volume: 'Объём',
  shapes: 'Фигуры',
  brushes: 'Кисти',
  arrows: 'Стрелки',
  text: 'Текст',
};
