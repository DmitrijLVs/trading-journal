/**
 * Реестр иконок: минималистичная геометрия, stroke = currentColor.
 * Инлайн вместо HTTP — иконки типизированы и доступны мгновенно.
 * Все — viewBox 24, stroke-width 1.7, round caps.
 */

const S = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  // ── Навигация ──
  dashboard: S('<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5"/><rect x="13.5" y="12" width="7.5" height="9" rx="1.5"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5"/>'),
  trades: S('<path d="M3 17l5-5 4 3 6-7"/><path d="M14 8h4v4"/><path d="M3 21h18"/>'),
  journal: S('<path d="M5 4a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2z"/><path d="M9 2v20"/><path d="M13 7h3M13 11h3"/>'),
  wallet: S('<path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h4v3h-4a1.5 1.5 0 0 1 0-3z"/><path d="M3 7l12-3.5V5"/>'),
  settings: S('<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.2 2.6 2.8-.6 1 2.7 2.7 1-.6 2.8 2.6 1.2-2.6 1.2.6 2.8-2.7 1-1 2.7-2.8-.6L12 21.5l-1.2-2.6-2.8.6-1-2.7-2.7-1 .6-2.8L2.3 12l2.6-1.2-.6-2.8 2.7-1 1-2.7 2.8.6z"/>'),

  // ── Действия ──
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  x: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: S('<path d="M4.5 12.5l5 5L19.5 7"/>'),
  search: S('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
  trash: S('<path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/><path d="M10 11v6M14 11v6"/>'),
  edit: S('<path d="M14.5 4.5l5 5L8 21H3v-5z"/><path d="M12.5 6.5l5 5"/>'),
  copy: S('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  refresh: S('<path d="M20 11a8 8 0 1 0-1.2 5.2"/><path d="M20 5v6h-6"/>'),
  download: S('<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 21h16"/>'),
  filter: S('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  'more-h': S('<circle cx="5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.1" fill="currentColor" stroke="none"/>'),
  grip: S('<circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none"/>'),
  maximize: S('<path d="M9 3H4a1 1 0 0 0-1 1v5M15 3h5a1 1 0 0 1 1 1v5M9 21H4a1 1 0 0 1-1-1v-5M15 21h5a1 1 0 0 0 1-1v-5"/>'),
  minimize: S('<path d="M3 9h6V3M21 9h-6V3M3 15h6v6M21 15h-6v6"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>'),
  unlock: S('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.8-1.2"/>'),
  duplicate: S('<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>'),
  'external-link': S('<path d="M14 4h6v6"/><path d="M20 4L11 13"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>'),
  eye: S('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  'eye-off': S('<path d="M4 4l16 16"/><path d="M9.9 5.1A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3 3.9M6.1 6.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),

  // ── Стрелки / шевроны ──
  'chevron-down': S('<path d="M6 9l6 6 6-6"/>'),
  'chevron-up': S('<path d="M6 15l6-6 6 6"/>'),
  'chevron-left': S('<path d="M15 6l-6 6 6 6"/>'),
  'chevron-right': S('<path d="M9 6l6 6-6 6"/>'),
  'arrow-left': S('<path d="M20 12H4"/><path d="M10 6l-6 6 6 6"/>'),
  'arrow-up-right': S('<path d="M7 17L17 7"/><path d="M9 7h8v8"/>'),
  'arrow-down-right': S('<path d="M7 7l10 10"/><path d="M17 9v8H9"/>'),

  // ── Домен ──
  long: S('<path d="M4 17l6-6 3.5 3L20 8"/><path d="M14.5 8H20v5.5"/>'),
  short: S('<path d="M4 7l6 6 3.5-3L20 16"/><path d="M14.5 16H20v-5.5"/>'),
  calendar: S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/>'),
  clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'),
  tag: S('<path d="M3 11V4a1 1 0 0 1 1-1h7l10 10-8 8L3 11z"/><circle cx="8" cy="8" r="1.4"/>'),
  target: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'),
  layers: S('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/>'),
  key: S('<circle cx="8" cy="15" r="4.5"/><path d="M11.5 11.5L20 3"/><path d="M16 7l2.5 2.5M13.5 9.5l2 2"/>'),
  zap: S('<path d="M13 2L4.5 13.5H11L9.5 22 19 10h-6.5z"/>'),
  note: S('<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9l-6 7H6a2 2 0 0 1-2-2z"/><path d="M14 21v-5a2 2 0 0 1 2-2h4"/>'),
  book: S('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
  brain: S('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/>'),
  alert: S('<path d="M12 3L1.8 20.2h20.4z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.5" r=".9" fill="currentColor" stroke="none"/>'),
  info: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none"/>'),
  'chart-line': S('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>'),
  'chart-bar': S('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M8 17v-5M13 17V7M18 17v-8"/>'),
  'chart-pie': S('<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'),
  'chart-scatter': S('<path d="M3 3v16a2 2 0 0 0 2 2h16"/><circle cx="9" cy="9" r="1.3"/><circle cx="14" cy="14" r="1.3"/><circle cx="17" cy="7" r="1.3"/><circle cx="11" cy="16" r="1.3"/>'),
  grid: S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/>'),
  table: S('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 15h18M12 9.5V20"/>'),
  fire: S('<path d="M12 22c4 0 7-2.8 7-6.8 0-3.5-2.3-5.6-3.8-7.2C13.8 6.5 13 4.7 13 2c-3.5 1.8-5 4.5-5 7 0 1.5.5 2.5.5 2.5S7 10.6 7 8.8C5.6 10.3 5 12.6 5 15.2 5 19.2 8 22 12 22z"/>'),
  scale: S('<path d="M12 3v18"/><path d="M8 21h8"/><path d="M4 7h16"/><path d="M6 7l-2.5 6a3 3 0 0 0 5 0L6 7zM18 7l-2.5 6a3 3 0 0 0 5 0L18 7z"/>'),
  percent: S('<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'),
  coins: S('<circle cx="9" cy="9" r="6"/><path d="M14.8 7.2A6 6 0 1 1 7.2 14.8"/>'),
  sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  moon: S('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>'),
  user: S('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  logout: S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  link: S('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'),
  inbox: S('<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 3h5L16 13h5"/>'),
  star: S('<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/>'),
  template: S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>'),
} as const;

export type IconName = keyof typeof ICONS;
