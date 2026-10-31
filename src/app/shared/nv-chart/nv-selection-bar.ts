import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { Chart } from '@nv/core';
import type { Drawing, DrawingPatch, DrawingStyle, Drawings, LineStyle } from '@nv/tools';
import { Tooltip } from '../ui/tooltip';
import { NvRuntime } from './nv-runtime';
import { toolIcon } from './nv-tool-icons';

/** Инструменты с площадью, которую можно залить. */
const FILLED = new Set([
  'rectangle', 'ellipse', 'circle', 'triangle', 'polyline', 'parallelChannel', 'flatTopBottom',
  'disjointChannel', 'pitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'gannBox',
  'priceRange', 'dateRange', 'datePriceRange', 'xabcd', 'cypher', 'headAndShoulders', 'trianglePattern',
]);
/** Линии, которые продлеваются за свои точки. */
const EXTENDABLE = new Set(['trendLine', 'infoLine', 'trendAngle', 'parallelChannel', 'flatTopBottom', 'disjointChannel']);
/** Уровни на одной цене: их цену можно вывести на шкалу. */
const AXIS_LEVELS = new Set(['horizontalLine', 'horizontalRay']);
/** Палитра как у TradingView: базовые цвета разметки плюс белый и серый. */
const SWATCHES = [
  '#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4',
  '#2962ff', '#7e57c2', '#9c27b0', '#e91e63', '#ffffff', '#787b86',
];
const WIDTHS = [1, 2, 3, 4];
const LINE_STYLES: readonly LineStyle[] = ['solid', 'dashed', 'dotted'];
const MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];

type Menu = 'color' | 'fill' | 'width' | 'style' | 'text';

/**
 * Панель над выделенным рисунком — как в wintrading и TradingView: цвет,
 * заливка, толщина, стиль линии, текст, продление линии, цена уровня на шкале,
 * на передний/задний план, блокировка, копия, удаление. Каждое изменение — шаг
 * отмены; цвет, толщина и стиль запоминаются для следующих рисунков инструмента.
 * Живёт поверх своего графика и ездит за рисунком.
 */
@Component({
  selector: 'app-nv-selection-bar',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Tooltip],
  template: `
    @if (drawing(); as d) {
      <div #bar class="bar" role="toolbar" aria-label="Рисунок" (pointerdown)="$event.stopPropagation()">
        <button type="button" class="btn" appTooltip="Цвет" aria-label="Цвет" cdkOverlayOrigin #colorO="cdkOverlayOrigin" (click)="toggle('color', colorO)">
          <span class="dot" [style.background]="d.style.color"></span>
        </button>
        @if (filled()) {
          <button type="button" class="btn" appTooltip="Заливка" aria-label="Заливка" [class.active]="!!d.style.fill" cdkOverlayOrigin #fillO="cdkOverlayOrigin" (click)="toggle('fill', fillO)">
            <span [innerHTML]="icon('fill')"></span>
          </button>
        }
        <button type="button" class="btn" appTooltip="Толщина" aria-label="Толщина" cdkOverlayOrigin #widthO="cdkOverlayOrigin" (click)="toggle('width', widthO)">
          <span class="mark">{{ d.style.width }}px</span>
        </button>
        <button type="button" class="btn" appTooltip="Стиль линии" aria-label="Стиль линии" cdkOverlayOrigin #styleO="cdkOverlayOrigin" (click)="toggle('style', styleO)">
          <span class="mark">{{ styleMark(d.style.lineStyle) }}</span>
        </button>
        <span class="sep"></span>
        <button type="button" class="btn" appTooltip="Текст" aria-label="Текст" [class.active]="!!d.text" cdkOverlayOrigin #textO="cdkOverlayOrigin" (click)="toggle('text', textO)">
          <span [innerHTML]="icon('textTool')"></span>
        </button>
        @if (extendable()) {
          <button type="button" class="btn" appTooltip="Продлить влево" aria-label="Продлить влево" [class.active]="!!d.style.extendLeft" (click)="toggleExtend('extendLeft')">⇤</button>
          <button type="button" class="btn" appTooltip="Продлить вправо" aria-label="Продлить вправо" [class.active]="!!d.style.extendRight" (click)="toggleExtend('extendRight')">⇥</button>
        }
        @if (axisLevel()) {
          <button type="button" class="btn" appTooltip="Цена на шкале" aria-label="Цена на шкале" [class.active]="!!d.style.axisLabel" (click)="toggleAxisLabel()">
            <span [innerHTML]="icon('axisLabel')"></span>
          </button>
        }
        <span class="sep"></span>
        <button type="button" class="btn" appTooltip="На передний план" aria-label="На передний план" (click)="arrange(true)"><span [innerHTML]="icon('front')"></span></button>
        <button type="button" class="btn" appTooltip="На задний план" aria-label="На задний план" (click)="arrange(false)"><span [innerHTML]="icon('back')"></span></button>
        <button type="button" class="btn" [appTooltip]="d.locked ? 'Разблокировать' : 'Заблокировать'" [attr.aria-label]="d.locked ? 'Разблокировать' : 'Заблокировать'" [class.active]="d.locked" (click)="toggleLock()">
          <span [innerHTML]="icon(d.locked ? 'lock' : 'unlock')"></span>
        </button>
        <button type="button" class="btn" appTooltip="Копия" aria-label="Копия" (click)="clone()"><span [innerHTML]="icon('clone')"></span></button>
        <button type="button" class="btn danger" appTooltip="Удалить · Delete" aria-label="Удалить" (click)="remove()"><span [innerHTML]="icon('trash')"></span></button>
      </div>

      @if (menu(); as m) {
        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="m.origin"
          [cdkConnectedOverlayOpen]="true"
          [cdkConnectedOverlayPositions]="menuPositions"
          [cdkConnectedOverlayPush]="true"
          (overlayOutsideClick)="menu.set(null)"
          (detach)="menu.set(null)"
        (overlayKeydown)="$event.key === 'Escape' && menu.set(null)"
        >
          <div class="menu" (keydown)="$event.stopPropagation()">
            @switch (m.kind) {
              @case ('color') {
                <div class="swatches">
                  @for (c of swatches; track c) {
                    <button type="button" class="swatch" [style.background]="c" [attr.aria-label]="c" [class.on]="sameColor(d.style.color, c)" (click)="setColor(c)"></button>
                  }
                </div>
                <label class="custom">Свой цвет <input type="color" [value]="hex(d.style.color)" (input)="setColor(inputValue($event))" /></label>
              }
              @case ('fill') {
                <button type="button" class="row" (click)="toggleFill()">{{ d.style.fill ? 'Без заливки' : 'Залить цветом линии' }}</button>
                <div class="swatches">
                  @for (c of swatches; track c) {
                    <button type="button" class="swatch" [style.background]="c" [attr.aria-label]="c" (click)="setFill(c)"></button>
                  }
                </div>
              }
              @case ('width') {
                @for (w of widths; track w) {
                  <button type="button" class="row" [class.active]="d.style.width === w" (click)="setWidth(w)">
                    <span class="line" [style.height.px]="w"></span><span>{{ w }}px</span>
                  </button>
                }
              }
              @case ('style') {
                @for (s of lineStyles; track s) {
                  <button type="button" class="row mono" [class.active]="d.style.lineStyle === s" (click)="setLineStyle(s)">{{ styleMark(s) }}</button>
                }
              }
              @case ('text') {
                <textarea class="text" rows="3" placeholder="Ваш текст…" [value]="d.text" (input)="setText(inputValue($event))"></textarea>
                <button type="button" class="row" (click)="editInPlace()">Править на графике</button>
              }
            }
          </div>
        </ng-template>
      }
    }
  `,
  styleUrl: './nv-selection-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NvSelectionBar {
  private readonly runtime = inject(NvRuntime);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly zone = inject(NgZone);
  private readonly barRef = viewChild<ElementRef<HTMLElement>>('bar');

  /** График, чьи рисунки обслуживает панель (у других графиков страницы — свои). */
  readonly chart = input<Chart | null>(null);

  protected readonly swatches = SWATCHES;
  protected readonly widths = WIDTHS;
  protected readonly lineStyles = LINE_STYLES;
  protected readonly menuPositions = MENU_POSITIONS;

  protected readonly drawing = signal<Drawing | null>(null);
  protected readonly menu = signal<{ kind: Menu; origin: CdkOverlayOrigin } | null>(null);
  protected readonly filled = computed(() => FILLED.has(this.drawing()?.type ?? ''));
  protected readonly extendable = computed(() => EXTENDABLE.has(this.drawing()?.type ?? ''));
  protected readonly axisLevel = computed(() => AXIS_LEVELS.has(this.drawing()?.type ?? ''));

  private tools: Drawings | null = null;
  private readonly icons = new Map<string, SafeHtml>();
  private readonly offs: (() => void)[] = [];
  private raf = 0;

  constructor() {
    void this.connect();
    inject(DestroyRef).onDestroy(() => {
      for (const off of this.offs.splice(0)) off();
      cancelAnimationFrame(this.raf);
    });
  }

  protected icon(name: string): SafeHtml {
    let html = this.icons.get(name);
    if (!html) {
      // Статичная SVG-разметка из таблицы иконок — без пользовательских данных.
      html = this.sanitizer.bypassSecurityTrustHtml(toolIcon(name, 16));
      this.icons.set(name, html);
    }
    return html;
  }

  protected styleMark(s: LineStyle): string {
    return s === 'solid' ? '───' : s === 'dashed' ? '‒ ‒ ‒' : '· · · ·';
  }

  protected hex(color: string | null | undefined): string {
    return toHex(color) ?? '#2962ff';
  }

  protected sameColor(a: string | null | undefined, b: string): boolean {
    return toHex(a) === b;
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected toggle(kind: Menu, origin: CdkOverlayOrigin): void {
    this.menu.update((open) => (open?.kind === kind ? null : { kind, origin }));
  }

  protected setColor(color: string): void {
    const style: DrawingStyle = { color };
    // Заливка идёт за цветом линии, как у прямоугольника в wintrading.
    if (this.drawing()?.style.fill) style.fill = withAlpha(color, 0.2);
    this.patch({ style }, true);
  }

  protected setFill(color: string): void {
    this.patch({ style: { fill: withAlpha(color, 0.2) } });
  }

  protected toggleFill(): void {
    const d = this.drawing();
    if (d) this.patch({ style: { fill: d.style.fill ? null : withAlpha(this.hex(d.style.color), 0.2) } });
  }

  protected setWidth(width: number): void {
    this.patch({ style: { width } }, true);
  }

  protected setLineStyle(lineStyle: LineStyle): void {
    this.patch({ style: { lineStyle } }, true);
  }

  protected setText(text: string): void {
    this.patch({ text });
  }

  protected editInPlace(): void {
    const d = this.drawing();
    this.menu.set(null);
    if (d) this.tools?.editText(d.id);
  }

  protected toggleExtend(side: 'extendLeft' | 'extendRight'): void {
    const d = this.drawing();
    if (d) this.patch({ style: { [side]: !d.style[side] } });
  }

  protected toggleAxisLabel(): void {
    const d = this.drawing();
    if (d) this.patch({ style: { axisLabel: !d.style.axisLabel } }, true);
  }

  protected arrange(front: boolean): void {
    const d = this.drawing();
    if (d) this.tools?.arrange(d.id, front, { undoable: true });
  }

  protected toggleLock(): void {
    const d = this.drawing();
    if (d) this.patch({ locked: !d.locked });
  }

  /** Копия рядом с оригиналом — сдвинута вправо на десятую часть рисунка. */
  protected clone(): void {
    const tools = this.tools;
    const chart = this.chart();
    const d = this.drawing();
    if (!tools || !chart || !d) return;
    const times = d.points.map((p) => p.time);
    const span = times.length > 1 ? Math.max(...times) - Math.min(...times) : 0;
    const shift = Math.max(60_000, span * 0.1);
    const copy = tools.add(
      chart,
      {
        type: d.type,
        pane: d.pane,
        points: d.points.map((p) => ({ ...p, time: p.time + shift })),
        style: d.style,
        text: d.text,
      },
      { undoable: true },
    );
    tools.selectById(copy.id);
  }

  protected remove(): void {
    const d = this.drawing();
    if (d) this.tools?.remove(d.id, { undoable: true });
  }

  private patch(patch: DrawingPatch, remember = false): void {
    const d = this.drawing();
    if (!this.tools || !d) return;
    const next = this.tools.update(d.id, patch, { undoable: true });
    if (next) this.drawing.set(next);
    if (remember && patch.style) this.runtime.rememberStyle(d.type, patch.style);
  }

  private async connect(): Promise<void> {
    const context = await this.runtime.load().catch(() => null);
    if (!context) return;
    const tools = (this.tools = context.tools);
    const show = (drawing: Drawing | null) => {
      if (drawing?.id !== this.drawing()?.id) this.menu.set(null);
      this.drawing.set(drawing);
      this.follow();
    };
    this.offs.push(
      tools.on('selected', (e) => show(e.chart && e.chart === this.chart() ? e.drawing : null)),
      tools.on('updated', (e) => {
        if (e.drawing.id === this.drawing()?.id) this.drawing.set(e.drawing);
      }),
      tools.on('removed', (e) => {
        if (e.drawing.id === this.drawing()?.id) show(null);
      }),
    );
  }

  /** Над рисунком (под ним, если сверху нет места) — каждый кадр, пока он выделен. */
  private follow(): void {
    cancelAnimationFrame(this.raf);
    this.zone.runOutsideAngular(() => {
      const step = () => {
        if (!this.drawing()) return;
        this.place();
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  private place(): void {
    const el = this.barRef()?.nativeElement;
    const d = this.drawing();
    const box = d ? this.tools?.bounds(d.id) : null;
    const chart = this.chart();
    if (!el) return;
    if (!box || !chart || box.chart !== chart) {
      el.style.visibility = 'hidden';
      return;
    }
    const host = chart.element;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const x = (box.left + box.right) / 2 - width / 2;
    let y = box.top - height - 10;
    if (y < 4) y = Math.min(box.bottom + 10, host.clientHeight - height - 30);
    el.style.left = `${Math.round(Math.max(4, Math.min(x, host.clientWidth - width - 70)))}px`;
    el.style.top = `${Math.round(Math.max(4, y))}px`;
    el.style.visibility = 'visible';
  }
}

/** '#rgb' / '#rrggbb' / 'rgb(a)(…)' → '#rrggbb'; иначе null. */
function toHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const c = color.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(c)) return c.slice(0, 7);
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
  if (!rgb) return null;
  return `#${[rgb[1], rgb[2], rgb[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

function withAlpha(color: string, alpha: number): string {
  const hex = toHex(color) ?? '#2962ff';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
