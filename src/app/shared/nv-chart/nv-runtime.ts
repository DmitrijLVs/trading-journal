import { Injectable, signal } from '@angular/core';
import type { DrawingStyle, Drawings, Magnet } from '@nv/tools';
import { readChartPref, writeChartPref } from './chart-prefs';
import { NvContext } from './nv-chart.types';
import { TOOL_DEFAULTS, TOOL_TEXTS, rulerText } from './nv-drawing-tools';

const CHART_FONT = {
  family: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  size: 11,
};

const MAGNET_KEY = 'tj.drawbar.magnet';
const STYLES_KEY = 'tj.drawbar.styles';

/**
 * Один рантайм chart-engine на приложение (одно GPU-устройство на страницу),
 * создаётся лениво: движок не попадает в начальный бандл. Инструмент
 * рисования у движка общий для всех графиков — его и показывают тулбары.
 * Клавиши и жесты — полные, как в wintrading (Alt+T тренд, ПКМ — луч, Shift+клик — линейка).
 */
@Injectable({ providedIn: 'root' })
export class NvRuntime {
  private context: Promise<NvContext> | null = null;
  private drawings: Drawings | null = null;
  private readonly tool = signal<string | null>(null);
  /** Последний цвет/толщина/стиль, которые пользователь дал инструменту. */
  private styles: Record<string, DrawingStyle> = readChartPref(STYLES_KEY, {});

  /** Активный инструмент рисования (null — курсор). */
  readonly activeTool = this.tool.asReadonly();

  load(): Promise<NvContext> {
    this.context ??= this.create().catch((error: unknown) => {
      this.context = null;
      throw error;
    });
    return this.context;
  }

  setTool(name: string | null): void {
    this.drawings?.setTool(name);
  }

  /** Магнит включён постоянно — запоминается между сессиями. */
  setMagnet(on: boolean): void {
    const tools = this.drawings;
    if (!tools) return;
    tools.setOptions({ magnet: on ? 'strong' : 'off' });
    writeChartPref(MAGNET_KEY, on ? 'strong' : 'off');
  }

  /** Следующие рисунки инструмента — в стиле, который пользователь дал последнему. */
  rememberStyle(tool: string, style: DrawingStyle): void {
    const keep: DrawingStyle = {};
    if (style.color !== undefined) keep.color = style.color;
    if (style.width !== undefined) keep.width = style.width;
    if (style.lineStyle !== undefined) keep.lineStyle = style.lineStyle;
    if (style.axisLabel !== undefined) keep.axisLabel = style.axisLabel;
    if (Object.keys(keep).length === 0) return;
    this.styles = { ...this.styles, [tool]: { ...this.styles[tool], ...keep } };
    writeChartPref(STYLES_KEY, this.styles);
    this.drawings?.setOptions({ toolDefaults: this.toolDefaults() });
  }

  private toolDefaults(): Record<string, DrawingStyle> {
    const merged: Record<string, DrawingStyle> = { ...TOOL_DEFAULTS };
    for (const [tool, style] of Object.entries(this.styles)) {
      merged[tool] = { ...merged[tool], ...style };
    }
    return merged;
  }

  private async create(): Promise<NvContext> {
    const [core, tools, scene] = await Promise.all([
      import('@nv/core'),
      import('@nv/tools'),
      import('./nv-scene'),
    ]);
    const scenes = scene.sceneRegistry();
    const magnet = readChartPref<Magnet>(MAGNET_KEY, 'off');
    const drawings = tools.drawings({
      magnet: magnet === 'off' ? 'off' : 'strong',
      holdMagnet: 'strong',
      toolDefaults: this.toolDefaults(),
      texts: TOOL_TEXTS,
      measureText: rulerText,
    });
    drawings.on('tool', (event) => this.tool.set(event.tool));
    const runtime = await core.createRuntime({
      font: CHART_FONT,
      extensions: [drawings, scenes.extension],
    });
    this.drawings = drawings;
    return { runtime, tools: drawings, scenes };
  }
}
