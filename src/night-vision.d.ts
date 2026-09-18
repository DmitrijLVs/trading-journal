declare module 'night-vision' {
  export interface NightVisionProps {
    id?: string;
    width?: number;
    height?: number;
    autoResize?: boolean;
    colors?: Record<string, string>;
    config?: Record<string, unknown>;
    data?: unknown;
    scripts?: unknown[];
    timezone?: number;
    indexBased?: boolean;
  }

  export class NightVision {
    constructor(target: string, props?: NightVisionProps);
    hub: { chart: { id: number; settings: Record<string, unknown> } };
    events: { emit(name: string, payload?: unknown): void; on(name: string, cb: (arg: unknown) => void): void };
    root: HTMLElement;
    data: { panes: { overlays: { name: string; type: string; data: number[][] }[] }[] };
    colors: Record<string, string>;
    width: number;
    height: number;
    range: unknown;
    update(type?: string, opt?: Record<string, unknown>): void;
    fullReset(): void;
    destroy(): void;
  }
}
