import { SceneLayer, SceneRange, SceneView } from '../../shared/nv-chart/nv-scene.types';
import { TradeFill, runningAverage } from './data/trade-chart.model';
import { Trade, calculatePnlPercent } from './data/trade.model';

/** Разметка сделки на свечах (референс — digash UserTrades, перенесено из diops). */
export interface TradeMarkup {
  /** Бегущие средние цены [время, цена] — по входам и по выходам. */
  entryLine: [number, number][];
  exitLine: [number, number][];
  fills: { time: number; buy: boolean; price: number }[];
  /** Цена пилюли результата; 0 — сделка открыта, пилюли нет. */
  exitPrice: number;
  pnlLabel: string;
  isLong: boolean;
  isProfit: boolean;
}

export interface TradePalette {
  up: string;
  down: string;
  /** Подложка шеврона — цвет фона графика. */
  back: string;
  /** Текст на цветной пилюле. */
  onColor: string;
}

const FONT = '510 11px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const CHEVRON = 7;

export function tradeMarkup(trade: Trade, fills: readonly TradeFill[], pnlLabel: string): TradeMarkup {
  const isLong = trade.side === 'long';
  const entrySide: TradeFill['side'] = isLong ? 'buy' : 'sell';
  return {
    entryLine: runningAverage(fills.filter((f) => f.side === entrySide)),
    exitLine: runningAverage(fills.filter((f) => f.side !== entrySide)),
    fills: fills.map((f) => ({ time: f.time, buy: f.side === 'buy', price: f.price })),
    exitPrice: trade.status === 'closed' ? (trade.exitPrice ?? 0) : 0,
    pnlLabel,
    isLong,
    isProfit: calculatePnlPercent(trade) >= 0,
  };
}

/**
 * Сделка на графике: пунктирные ступенчатые линии бегущей средней цены
 * (отдельно по входам и выходам, только при 2+ исполнениях на стороне),
 * шеврон на каждом исполнении (покупка ▲, продажа ▼) с пунктиром к оси
 * цен и пилюля результата у правого края на уровне цены выхода.
 */
export class TradeLayer implements SceneLayer {
  private markup: TradeMarkup | null = null;
  private palette: TradePalette = { up: '#3fb950', down: '#f85149', back: '#0d1117', onColor: '#0d1117' };

  set(markup: TradeMarkup, palette: TradePalette): void {
    this.markup = markup;
    this.palette = palette;
  }

  draw(ctx: CanvasRenderingContext2D, view: SceneView): void {
    const m = this.markup;
    if (!m) return;
    const p = this.palette;
    const w = view.width;
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    stepLine(ctx, view, m.entryLine, m.isLong ? p.up : p.down);
    stepLine(ctx, view, m.exitLine, m.isLong ? p.down : p.up);

    for (const fill of m.fills) {
      const x = view.xOfTime(fill.time);
      const y = view.y(fill.price);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const color = fill.buy ? p.up : p.down;
      markerLine(ctx, x, y, w, color);
      chevron(ctx, x, y, fill.buy, color, p.back);
    }

    if (m.exitPrice && m.pnlLabel) {
      badge(ctx, w, view.y(m.exitPrice), m.pnlLabel, m.isProfit ? p.up : p.down, p.onColor);
    }
  }

  // Автошкала обязана показать цены исполнений с запасом под шевроны. Запас — доля
  // разброса исполнений, не меньше 0,02% цены: фиксированные ±0,4% растягивали
  // секундный график скальпа на сотни долларов вокруг ровной цены.
  extend(range: SceneRange): void {
    const fills = this.markup?.fills ?? [];
    if (fills.length === 0) return;
    let low = Infinity;
    let high = -Infinity;
    for (const fill of fills) {
      low = Math.min(low, fill.price);
      high = Math.max(high, fill.price);
    }
    const pad = Math.max((high - low) * 0.15, high * 0.0002);
    range.max = Math.max(range.max, high + pad);
    range.min = Math.min(range.min, low - pad);
  }
}

function stepLine(
  ctx: CanvasRenderingContext2D,
  view: SceneView,
  points: readonly [number, number][],
  color: string,
): void {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  let prevY = 0;
  points.forEach(([time, price], k) => {
    const x = view.xOfTime(time);
    const y = view.y(price);
    if (k === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, prevY);
      ctx.lineTo(x, y);
    }
    prevY = y;
  });
  ctx.lineTo(view.width, prevY);
  ctx.stroke();
  ctx.restore();
}

function markerLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.restore();
}

function chevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  up: boolean,
  color: string,
  back: string,
): void {
  const dy = up ? CHEVRON : -CHEVRON;
  ctx.beginPath();
  ctx.moveTo(x - CHEVRON, y + dy);
  ctx.lineTo(x, y);
  ctx.lineTo(x + CHEVRON, y + dy);
  ctx.strokeStyle = back;
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

function badge(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  text: string,
  fill: string,
  textColor: string,
): void {
  const tw = ctx.measureText(text).width + 18;
  const x = w - tw - 6;
  ctx.beginPath();
  ctx.roundRect(x, y - 10, tw, 20, 4);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + tw / 2, y + 0.5);
}
