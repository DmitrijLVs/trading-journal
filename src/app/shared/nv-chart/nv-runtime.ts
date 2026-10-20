import { Injectable, signal } from '@angular/core';
import type { Drawings } from '@nv/tools';
import { NvContext } from './nv-chart.types';
import { TOOL_DEFAULTS, TOOL_TEXTS, drawingBindings, rulerText } from './nv-drawing-tools';

const CHART_FONT = {
  family: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  size: 11,
};

/**
 * Один рантайм chart-engine на приложение (одно GPU-устройство на страницу),
 * создаётся лениво: движок не попадает в начальный бандл. Инструмент
 * рисования у движка общий для всех графиков — его и показывают тулбары.
 */
@Injectable({ providedIn: 'root' })
export class NvRuntime {
  private context: Promise<NvContext> | null = null;
  private drawings: Drawings | null = null;
  private readonly tool = signal<string | null>(null);

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

  private async create(): Promise<NvContext> {
    const [core, tools, scene] = await Promise.all([
      import('@nv/core'),
      import('@nv/tools'),
      import('./nv-scene'),
    ]);
    const scenes = scene.sceneRegistry();
    const drawings = tools.drawings({
      magnet: 'weak',
      bindings: drawingBindings(tools.DEFAULT_BINDINGS),
      toolDefaults: TOOL_DEFAULTS,
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
