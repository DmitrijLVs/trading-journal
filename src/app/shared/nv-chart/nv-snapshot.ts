import type { CandleDataset, Chart } from '@nv/core';
import type { DrawingInput } from '@nv/tools';
import { NvRuntime } from './nv-runtime';
import { SceneLayer } from './nv-scene.types';

export interface ChartSnapshotRequest {
  /** График на экране: с него берём вид по времени и рисунки. */
  source: Chart;
  /** Его свечи — набор общий, с догруженной историей и живой свечой. */
  candles: CandleDataset;
  /** Размер кадра в CSS px; пикселей — вдвое больше на ретине. */
  width: number;
  height: number;
  /** Слои хоста поверх свечей (разметка сделки). */
  layers: readonly SceneLayer[];
}

/** Сколько ждать, пока свечи доедут до нового графика из воркера данных. */
const DATA_TIMEOUT_MS = 4000;
/** Сколько кадров ждать свечей окна; окно у правого края приходит сразу. */
const WINDOW_TIMEOUT_FRAMES = 40;

/**
 * Кадр графика ровно под снимок: временный невидимый график нужного размера
 * на тех же свечах, с тем же отрезком времени, разметкой и рисунками. Чётче
 * `screenshot()` графика на экране — тот пришлось бы растягивать под чужой
 * размер. Рисунки идут оверлеем: их не видно в списке и они не сохраняются.
 */
export async function chartSnapshot(runtime: NvRuntime, request: ChartSnapshotRequest): Promise<HTMLCanvasElement | null> {
  const context = await runtime.load().catch(() => null);
  const range = request.source.timeScale().visibleRange();
  if (!context || !range) return null;

  // В области экрана (движок не рисует график вне его), но невидимо и мимо мыши.
  const host = document.createElement('div');
  host.style.cssText =
    `position:fixed;left:0;top:0;width:${request.width}px;height:${request.height}px;` +
    'opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(host);

  let chart: Chart | null = null;
  try {
    chart = context.runtime.createChart(host, {
      theme: 'css',
      legend: false,
      legendActions: false,
      candleTimer: false,
      lastPrice: false,
      crosshair: false,
    });
    chart.pane(0).add('sceneBounds', {});
    chart.setDataset(request.candles);
    const scene = context.scenes.sceneOf(chart);
    for (const layer of request.layers) scene?.add(layer);
    const drawings: DrawingInput[] = context.tools
      .list(request.source)
      .filter((d) => !d.hidden)
      .map(({ id: _id, version: _version, ...input }) => input);
    if (drawings.length > 0) context.tools.setOverlay(chart, 'snapshot', drawings);

    const shown = chart;
    // Свечи доезжают раньше, чем график узнаёт свой размер: вид, заданный при
    // нулевой ширине плота, не применяется — ждём и того, и другого.
    const sized = () => shown.timeScale().visibleRange() !== null && (shown.pane(0).box()?.width ?? 0) > 0;
    if (!(await until(sized, DATA_TIMEOUT_MS))) return null;
    // Набор свечей общий — индексы баров совпадают, вид переносим по ним точно.
    const view = request.source.timeScale().logicalRange();
    shown.timeScale().setLogicalRange(view);
    await nextFrame();
    // Свечи нового окна воркер присылает позже: пока их нет, шкала цен
    // подогнана только под разметку. Ждём, когда она перестроится и замрёт.
    await settled(() => priceSpan(shown), WINDOW_TIMEOUT_FRAMES);
    shown.timeScale().setLogicalRange(view);
    await nextFrame();
    await nextFrame();
    return shown.screenshot();
  } catch {
    return null;
  } finally {
    if (chart) {
      context.tools.setOverlay(chart, 'snapshot', null);
      chart.destroy();
    }
    host.remove();
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Цены у верхнего и нижнего края плота — меняются, когда шкала перестроилась. */
function priceSpan(chart: Chart): string {
  const box = chart.pane(0).box();
  if (!box) return '';
  const scale = chart.pane(0).priceScale();
  return `${scale.coordinateToPrice(box.top)}|${scale.coordinateToPrice(box.top + box.height)}`;
}

/** Ждёт, пока значение сменится и три кадра подряд не меняется; не дольше `maxFrames`. */
async function settled(read: () => string, maxFrames: number): Promise<void> {
  const initial = read();
  let last = initial;
  let still = 0;
  for (let frame = 0; frame < maxFrames; frame++) {
    await nextFrame();
    const value = read();
    still = value === last ? still + 1 : 0;
    last = value;
    if (value !== initial && still >= 3) return;
  }
}

async function until(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;
  while (!check()) {
    if (performance.now() > deadline) return false;
    await nextFrame();
  }
  return true;
}
