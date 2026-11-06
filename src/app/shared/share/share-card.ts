/**
 * Снимок для публикации (сделка, день, неделя, месяц): картинка рисуется
 * Canvas2D по готовому описанию — без DOM-растеризации, поэтому одинакова в
 * любом браузере и не зависит от того, что сейчас на экране. Цвета — из
 * токенов текущей темы, шрифт — Onest приложения, кадр графика сделки — из
 * `chart.screenshot()` движка.
 */

export type ShareTone = 'pos' | 'neg' | 'flat';

/**
 * Вид снимка сделки: 'card' — итог и факты слева, график справа; 'chart' —
 * только график, а сделка — строкой над ним (тикер, таймфрейм, сторона,
 * результат, время).
 */
export type ShareLayout = 'card' | 'chart';

export interface ShareFact {
  label: string;
  value: string;
  /** Приглушённое уточнение перед значением: тип ордера, количество. */
  note?: string;
}

export interface ShareBar {
  /** Подпись под столбиком; пустая — без подписи (в месяце подписан каждый пятый день). */
  label: string;
  /** null — в этот день не торговали. */
  value: number | null;
}

export type ShareVisual =
  | { kind: 'chart'; image: CanvasImageSource & { width: number; height: number } }
  | { kind: 'bars'; bars: readonly ShareBar[] }
  | { kind: 'curve'; points: readonly number[] };

export interface ShareCard {
  /** Только для снимка с графиком; по умолчанию 'card'. */
  layout?: ShareLayout;
  title: string;
  /** Нейтральная метка после заголовка — таймфрейм. */
  chip?: string;
  /** Метка рядом с заголовком — направление сделки. */
  badge?: { text: string; tone: 'long' | 'short' };
  subtitle: string;
  result: { text: string; tone: ShareTone };
  /** Под итогом: ход цены, сравнение с прошлым периодом. */
  resultNote?: string;
  facts: readonly ShareFact[];
  visual: ShareVisual | null;
  /** Дата снимка в правом верхнем углу. */
  stamp: string;
}

export interface SharePalette {
  canvas: string;
  chartSurface: string;
  fg: string;
  muted: string;
  subtle: string;
  border: string;
  borderStrong: string;
  pos: string;
  neg: string;
  long: string;
  short: string;
  glowWarm: string;
  glowWarmFar: string;
  glowCool: string;
}

/** Ширина снимка в CSS px; рисуем вдвое плотнее — чётко на ретине и в мессенджерах. */
const W = 1200;
const SUMMARY_H = 675;
/** Вид 'chart': полоса сделки сверху, под ней график во всю ширину. */
const STRIP_H = 96;
const SCALE = 2;
const PAD = 56;
const TOP = PAD + 32 + 40;
const FONT = "Onest, -apple-system, 'Segoe UI', sans-serif";

/** Цвета снимка — из токенов темы, которая сейчас открыта. */
export function readSharePalette(): SharePalette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    canvas: v('--canvas-default', '#09090b'),
    chartSurface: v('--chart-surface', '#141416'),
    fg: v('--fg-default', '#f4f4f5'),
    muted: v('--fg-muted', '#a1a1aa'),
    subtle: v('--fg-subtle', '#7b7b85'),
    border: v('--border-default', 'rgba(255, 255, 255, 0.09)'),
    borderStrong: v('--border-strong', 'rgba(255, 255, 255, 0.17)'),
    pos: v('--success-fg', '#44cf8f'),
    neg: v('--danger-fg', '#f2616e'),
    long: v('--long-fg', '#84b4f2'),
    short: v('--short-fg', '#c4a0f2'),
    glowWarm: v('--glow-warm', 'rgba(255, 128, 32, 0.2)'),
    glowWarmFar: v('--glow-warm-far', 'rgba(255, 168, 82, 0.06)'),
    glowCool: v('--glow-cool', 'rgba(96, 118, 168, 0.1)'),
  };
}

/**
 * Размер кадра графика (CSS px) для вида: под него рисуется отдельный график,
 * чтобы на снимке он был 1:1, без растяжения.
 */
export function shareChartSize(layout: ShareLayout): { width: number; height: number } {
  return layout === 'chart' ? { width: W, height: SUMMARY_H - STRIP_H } : { width: FRAME_W, height: LEFT_H };
}

export async function renderShareCard(card: ShareCard, palette: SharePalette): Promise<HTMLCanvasElement> {
  const { logo } = await loadAssets();
  const visual = card.visual;
  const chartOnly = visual?.kind === 'chart' && card.layout === 'chart';
  const height = visual?.kind === 'chart' && !chartOnly ? TOP + LEFT_H + PAD : SUMMARY_H;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  if (chartOnly && visual?.kind === 'chart') {
    paintChartOnly(ctx, card, visual.image, logo, palette);
    return canvas;
  }
  paintBackground(ctx, height, palette);
  paintBrand(ctx, card.stamp, logo, palette);
  if (visual?.kind === 'chart') paintChartLayout(ctx, card, visual.image, palette);
  else paintSummaryLayout(ctx, card, palette);
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty canvas'))), 'image/png'),
  );
}

// ── Ресурсы ────────────────────────────────────────────────────────────────

let assets: Promise<{ logo: HTMLImageElement | null }> | null = null;

function loadAssets(): Promise<{ logo: HTMLImageElement | null }> {
  assets ??= (async () => {
    // Canvas не ждёт веб-шрифт сам: без загрузки первый снимок вышел бы системным шрифтом.
    await Promise.all(
      ['400 20px', '500 80px', '600 40px'].map((f) => document.fonts.load(`${f} Onest`).catch(() => [])),
    );
    const logo = await loadImage(new URL('logo.png', document.baseURI).href).catch(() => null);
    return { logo };
  })();
  return assets;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── Общие части ────────────────────────────────────────────────────────────

/** Холст с тем же светом, что у приложения: янтарь слева сверху, холодный отсвет справа снизу. */
function paintBackground(ctx: CanvasRenderingContext2D, h: number, p: SharePalette): void {
  ctx.fillStyle = p.canvas;
  ctx.fillRect(0, 0, W, h);
  glow(ctx, h, -0.06 * W, -0.12 * h, 0.62 * W, p.glowWarm);
  glow(ctx, h, 0.34 * W, -0.2 * h, 0.48 * W, p.glowWarmFar);
  glow(ctx, h, 1.08 * W, 1.12 * h, 0.5 * W, p.glowCool);
}

function glow(ctx: CanvasRenderingContext2D, h: number, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
}

function paintBrand(ctx: CanvasRenderingContext2D, stamp: string, logo: HTMLImageElement | null, p: SharePalette): void {
  const size = 32;
  let x = PAD;
  if (logo) {
    paintLogo(ctx, logo, x, PAD, size);
    x += size + 12;
  }
  text(ctx, 'ProboyScalp', x, PAD + 22, { size: 19, weight: 600, color: p.fg, tracking: -0.2 });
  text(ctx, stamp, W - PAD, PAD + 22, { size: 16, color: p.subtle, align: 'right' });
}

function paintLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(logo, x, y, size, size);
  ctx.restore();
}

/** Метка-плашка с текстом; возвращает ширину. */
function chip(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  baseline: number,
  color: string,
  back: string,
  size = 15,
): number {
  ctx.font = font(size, 600);
  const w = ctx.measureText(value).width + 18;
  const h = size + 11;
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, baseline - size - 2, w, h, 5);
  ctx.fill();
  text(ctx, value, x + 9, baseline, { size, weight: 600, color });
  return w;
}

/** Заголовок, метка направления и подзаголовок; возвращает низ блока. */
function paintTitle(ctx: CanvasRenderingContext2D, card: ShareCard, x: number, y: number, p: SharePalette): number {
  const titleW = text(ctx, card.title, x, y + 34, { size: 38, weight: 600, color: p.fg, tracking: -0.8 });
  if (card.badge) {
    const color = card.badge.tone === 'long' ? p.long : p.short;
    chip(ctx, card.badge.text, x + titleW + 14, y + 30, color, withAlpha(color, 0.14));
  }
  text(ctx, card.subtitle, x, y + 68, { size: 17, color: p.muted });
  return y + 68;
}

function toneColor(tone: ShareTone, p: SharePalette): string {
  return tone === 'pos' ? p.pos : tone === 'neg' ? p.neg : p.fg;
}

// ── Сделка: колонка фактов слева, кадр графика справа ─────────────────────

const LEFT_W = 340;
const GAP = 40;
const FRAME_X = PAD + LEFT_W + GAP;
const FRAME_W = W - PAD - FRAME_X;
/** Высота левой колонки: заголовок, итог и четыре факта. */
const LEFT_H = 446;

function paintChartLayout(
  ctx: CanvasRenderingContext2D,
  card: ShareCard,
  image: ShareImage,
  p: SharePalette,
): void {
  paintTitle(ctx, card, PAD, TOP, p);

  const resultSize = fitSize(ctx, card.result.text, LEFT_W, 76, 500, 44, -2.6);
  text(ctx, card.result.text, PAD, TOP + 168, {
    size: resultSize,
    weight: 500,
    color: toneColor(card.result.tone, p),
    tracking: -resultSize * 0.035,
  });
  if (card.resultNote) text(ctx, card.resultNote, PAD, TOP + 204, { size: 19, color: p.muted });

  // Факты — список «подпись … значение» с тонкими линиями, как в панели сделки.
  const rowH = 46;
  let y = TOP + 246;
  for (const fact of card.facts.slice(0, 4)) {
    hline(ctx, PAD, PAD + LEFT_W, y, p.border);
    text(ctx, fact.label, PAD, y + 30, { size: 16, color: p.muted });
    const valueW = text(ctx, fact.value, PAD + LEFT_W, y + 30, { size: 17, weight: 500, color: p.fg, align: 'right' });
    if (fact.note) {
      text(ctx, fact.note, PAD + LEFT_W - valueW - 8, y + 30, { size: 15, color: p.subtle, align: 'right' });
    }
    y += rowH;
  }
  hline(ctx, PAD, PAD + LEFT_W, y, p.border);

  // Кадр графика на той же непрозрачной панели, что и в приложении.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(FRAME_X, TOP, FRAME_W, LEFT_H, 12);
  ctx.fillStyle = p.chartSurface;
  ctx.fill();
  ctx.clip();
  drawContained(ctx, image, { x: FRAME_X, y: TOP, w: FRAME_W, h: LEFT_H });
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(FRAME_X + 0.5, TOP + 0.5, FRAME_W - 1, LEFT_H - 1, 12);
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ── Сделка, вид «только график»: строка сделки сверху, график во всю ширину ──

const STRIP_X = 28;

function paintChartOnly(
  ctx: CanvasRenderingContext2D,
  card: ShareCard,
  image: ShareImage,
  logo: HTMLImageElement | null,
  p: SharePalette,
): void {
  ctx.fillStyle = p.chartSurface;
  ctx.fillRect(0, 0, W, SUMMARY_H);

  // Бренд справа — от него зависит, сколько места остаётся строке сделки.
  const brandW = text(ctx, 'ProboyScalp', W - STRIP_X, 54, { size: 17, weight: 600, color: p.fg, align: 'right' });
  if (logo) paintLogo(ctx, logo, W - STRIP_X - brandW - 38, 34, 28);

  // Строка 1: тикер, таймфрейм, сторона, результат в процентах и деньгах.
  let x = STRIP_X;
  x += text(ctx, card.title, x, 48, { size: 26, weight: 600, color: p.fg, tracking: -0.5 }) + 14;
  if (card.chip) x += chip(ctx, card.chip, x, 45, p.muted, withAlpha(p.fg, 0.07), 13) + 8;
  if (card.badge) {
    const color = card.badge.tone === 'long' ? p.long : p.short;
    x += chip(ctx, card.badge.text, x, 45, color, withAlpha(color, 0.14), 13) + 18;
  }
  const tone = toneColor(card.result.tone, p);
  x += text(ctx, card.result.text, x, 48, { size: 24, weight: 600, color: tone, tracking: -0.5 }) + 12;
  if (card.resultNote) text(ctx, card.resultNote, x, 48, { size: 18, weight: 500, color: tone });

  // Строка 2: биржа, время, цены входа и выхода.
  text(ctx, card.subtitle, STRIP_X, 76, { size: 15, color: p.muted });

  hline(ctx, 0, W, STRIP_H - 1, p.border);
  drawContained(ctx, image, { x: 0, y: STRIP_H, w: W, h: SUMMARY_H - STRIP_H });
}

type ShareImage = CanvasImageSource & { width: number; height: number };

/** Картинка целиком в рамке; кадр нужного размера ложится 1:1. */
function drawContained(ctx: CanvasRenderingContext2D, image: ShareImage, box: Box): void {
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

// ── День / неделя / месяц: итог слева, график дней справа, факты строкой ──

const VISUAL_X = 640;
const VISUAL_H = 280;
const FACTS_Y = SUMMARY_H - PAD - 118;

function paintSummaryLayout(ctx: CanvasRenderingContext2D, card: ShareCard, p: SharePalette): void {
  paintTitle(ctx, card, PAD, TOP, p);

  const resultSize = fitSize(ctx, card.result.text, VISUAL_X - PAD - GAP, 96, 500, 52, -3.4);
  text(ctx, card.result.text, PAD, TOP + 200, {
    size: resultSize,
    weight: 500,
    color: toneColor(card.result.tone, p),
    tracking: -resultSize * 0.035,
  });
  if (card.resultNote) text(ctx, card.resultNote, PAD, TOP + 240, { size: 19, color: p.muted });

  const box = { x: VISUAL_X, y: TOP + 8, w: W - PAD - VISUAL_X, h: VISUAL_H };
  if (card.visual?.kind === 'bars') paintBars(ctx, card.visual.bars, box, p);
  else if (card.visual?.kind === 'curve') paintCurve(ctx, card.visual.points, box, p);

  // Факты — колонками «подпись над значением» с тонкими разделителями.
  hline(ctx, PAD, W - PAD, FACTS_Y, p.border);
  const facts = card.facts.slice(0, 5);
  const colW = (W - PAD * 2) / Math.max(1, facts.length);
  facts.forEach((fact, i) => {
    const x = PAD + i * colW + (i === 0 ? 0 : 24);
    if (i > 0) vline(ctx, PAD + i * colW, FACTS_Y + 28, FACTS_Y + 100, p.border);
    text(ctx, fact.label, x, FACTS_Y + 52, { size: 16, color: p.muted });
    const size = fitSize(ctx, fact.value, colW - 32, 28, 500, 18, -0.6);
    text(ctx, fact.value, x, FACTS_Y + 92, { size, weight: 500, color: p.fg, tracking: -0.6 });
  });
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Столбики дней от нулевой линии: плюс — вверх, минус — вниз. */
function paintBars(ctx: CanvasRenderingContext2D, bars: readonly ShareBar[], box: Box, p: SharePalette): void {
  if (bars.length === 0) return;
  const values = bars.map((b) => b.value ?? 0);
  const maxPos = Math.max(0, ...values);
  const maxNeg = Math.max(0, ...values.map((v) => -v));
  const span = maxPos + maxNeg || 1;
  const zeroY = maxPos + maxNeg === 0 ? box.y + box.h / 2 : box.y + (box.h * maxPos) / span;
  const slot = box.w / bars.length;
  const barW = Math.min(slot * 0.62, 44);
  const radius = Math.min(4, barW / 2);

  hline(ctx, box.x, box.x + box.w, zeroY, p.borderStrong);
  bars.forEach((bar, i) => {
    const cx = box.x + slot * i + slot / 2;
    if (bar.value === null || bar.value === 0) {
      ctx.fillStyle = p.subtle;
      ctx.beginPath();
      ctx.arc(cx, zeroY, Math.min(3, barW / 3), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const h = Math.max(3, (Math.abs(bar.value) / span) * box.h);
      ctx.fillStyle = bar.value > 0 ? p.pos : p.neg;
      ctx.beginPath();
      if (bar.value > 0) ctx.roundRect(cx - barW / 2, zeroY - h, barW, h, [radius, radius, 0, 0]);
      else ctx.roundRect(cx - barW / 2, zeroY, barW, h, [0, 0, radius, radius]);
      ctx.fill();
    }
    if (bar.label) text(ctx, bar.label, cx, box.y + box.h + 30, { size: 15, color: p.subtle, align: 'center' });
  });
}

/** Накопленный итог дня по сделкам: линия с заливкой до нуля. */
function paintCurve(ctx: CanvasRenderingContext2D, points: readonly number[], box: Box, p: SharePalette): void {
  if (points.length < 2) return;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const x = (i: number) => box.x + (box.w * i) / (points.length - 1);
  const y = (v: number) => box.y + box.h - ((v - min) / range) * box.h;
  const last = points[points.length - 1];
  const color = last > 0 ? p.pos : last < 0 ? p.neg : p.muted;
  const zeroY = y(0);

  hline(ctx, box.x, box.x + box.w, zeroY, p.borderStrong);

  ctx.beginPath();
  ctx.moveTo(x(0), zeroY);
  points.forEach((v, i) => ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(points.length - 1), zeroY);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  fill.addColorStop(0, withAlpha(color, last >= 0 ? 0.22 : 0.04));
  fill.addColorStop(1, withAlpha(color, last >= 0 ? 0.04 : 0.22));
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  points.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x(points.length - 1), y(last), 5, 0, Math.PI * 2);
  ctx.fill();

  text(ctx, 'первая сделка', box.x, box.y + box.h + 30, { size: 15, color: p.subtle });
  text(ctx, 'последняя', box.x + box.w, box.y + box.h + 30, { size: 15, color: p.subtle, align: 'right' });
}

// ── Примитивы ──────────────────────────────────────────────────────────────

interface TextStyle {
  size: number;
  weight?: number;
  color: string;
  align?: CanvasTextAlign;
  /** Трекинг, px. */
  tracking?: number;
}

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${FONT}`;
}

/** Рисует строку и возвращает её ширину. */
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, style: TextStyle): number {
  ctx.font = font(style.size, style.weight);
  ctx.letterSpacing = `${style.tracking ?? 0}px`;
  ctx.fillStyle = style.color;
  ctx.textAlign = style.align ?? 'left';
  ctx.fillText(value, x, y);
  const width = ctx.measureText(value).width;
  ctx.letterSpacing = '0px';
  return width;
}

/** Самый крупный кегль от `max` до `min`, при котором строка влезает в `width`. */
function fitSize(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
  max: number,
  weight: number,
  min: number,
  tracking: number,
): number {
  for (let size = max; size > min; size -= 2) {
    ctx.font = font(size, weight);
    ctx.letterSpacing = `${(tracking * size) / max}px`;
    const fits = ctx.measureText(value).width <= width;
    ctx.letterSpacing = '0px';
    if (fits) return size;
  }
  return min;
}

function hline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x1, Math.round(y), x2 - x1, 1);
}

function vline(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), y1, 1, y2 - y1);
}

/** Тот же цвет с другой альфой: `#rrggbb` и `rgb[a](…)` (градиенты canvas — без «тёмной каймы»). */
export function withAlpha(color: string, a: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(color.trim());
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})` : color;
}
