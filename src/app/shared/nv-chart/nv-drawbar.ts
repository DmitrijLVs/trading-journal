import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import type { Chart } from '@nv/core';
import type { Drawings, ToolInfo } from '@nv/tools';
import { Tooltip } from '../ui/tooltip';
import { readChartPref, writeChartPref } from './chart-prefs';
import { NvRuntime } from './nv-runtime';
import { BAR_GROUPS, GROUP_NAMES, SECTION_NAMES, TOOL_NAMES, toolIcon } from './nv-tool-icons';

const LAST_KEY = 'tj.drawbar.last';
const FAVORITES_KEY = 'tj.drawbar.favorites';
/** Как в wintrading: старые инструменты панели — в один клик. */
const DEFAULT_FAVORITES = ['trendLine', 'ray', 'horizontalRay', 'fibRetracement', 'rectangle', 'brush'];

interface ToolGroupButton {
  id: string;
  title: string;
  tools: readonly ToolInfo[];
  /** Инструмент на кнопке — последний взятый из группы. */
  shown: ToolInfo;
  active: boolean;
}

interface Flyout {
  group: ToolGroupButton;
  origin: CdkOverlayOrigin;
  sections: { id: string; title: string; tools: ToolInfo[] }[];
}

/** Справа от кнопки, сверху вниз; если не влезает — вверх от низа кнопки. */
const FLYOUT_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 6 },
  { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom', offsetX: 6 },
];

/**
 * Панель рисования графика — как в wintrading: все инструменты движка группами
 * (кнопка группы держит последний взятый инструмент, стрелка открывает список,
 * ★ закрепляет инструмент на панели), затем магнит, «оставаться в режиме
 * рисования», скрыть и удалить все рисунки, отмена и повтор. Горячие клавиши
 * движка работают на всей странице, пока панель открыта.
 */
@Component({
  selector: 'app-nv-drawbar',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Tooltip],
  host: { '(document:keydown)': 'routeKey($event)' },
  template: `
    @if (canScrollUp()) {
      <button type="button" class="scroll up" aria-label="Прокрутить панель вверх" (click)="scrollBar(-1)">
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
      </button>
    }
    <nav #nav class="bar" aria-label="Инструменты рисования" (scroll)="measure()">
      <button
        type="button"
        class="item"
        appTooltip="Курсор · Esc"
        aria-label="Курсор"
        [class.active]="tool() === null"
        (click)="pick(null)"
      >
        <span [innerHTML]="icon('cursor')"></span>
      </button>

      <hr />
      @for (t of favorites(); track t.name) {
        <button
          type="button"
          class="item"
          [appTooltip]="title(t.name)"
          [attr.aria-label]="name(t.name)"
          [class.active]="tool() === t.name"
          (click)="pick(t.name)"
        >
          <span [innerHTML]="icon(t.name)"></span>
        </button>
      }

      <hr />
      @for (g of groups(); track g.id) {
        <div class="group" cdkOverlayOrigin #origin="cdkOverlayOrigin">
          <button
            type="button"
            class="item"
            [appTooltip]="title(g.shown.name)"
            [attr.aria-label]="name(g.shown.name)"
            [class.active]="g.active"
            (click)="pick(g.shown.name)"
          >
            <span [innerHTML]="icon(g.shown.name)"></span>
          </button>
          <button
            type="button"
            class="more"
            [attr.aria-label]="g.title"
            [attr.aria-expanded]="flyout()?.group?.id === g.id"
            [class.open]="flyout()?.group?.id === g.id"
            (click)="toggleGroup(g, origin)"
          >
            <svg viewBox="0 0 6 6" width="6" height="6" aria-hidden="true">
              <path d="M1 0l4 3-4 3z" fill="currentColor" />
            </svg>
          </button>
        </div>
      }

      <hr />
      <button
        type="button"
        class="item"
        [appTooltip]="magnet() ? 'Магнит включён · к OHLC свечи' : 'Магнит выключен · с зажатым Ctrl (Cmd) работает всегда'"
        aria-label="Магнит"
        [class.active]="magnet() || magnetHeld()"
        (click)="toggleMagnet()"
      >
        <span [innerHTML]="icon('magnet')"></span>
      </button>
      <button
        type="button"
        class="item"
        appTooltip="Оставаться в режиме рисования"
        aria-label="Оставаться в режиме рисования"
        [class.active]="keep()"
        (click)="toggleKeep()"
      >
        <span [innerHTML]="icon('keep')"></span>
      </button>
      <button
        type="button"
        class="item"
        [appTooltip]="hidden() ? 'Показать все рисунки' : 'Скрыть все рисунки'"
        [attr.aria-label]="hidden() ? 'Показать все рисунки' : 'Скрыть все рисунки'"
        [class.active]="hidden()"
        [disabled]="count() === 0"
        (click)="toggleHidden()"
      >
        <span [innerHTML]="icon('hide')"></span>
      </button>
      <button
        type="button"
        class="item"
        appTooltip="Удалить все рисунки (можно отменить)"
        aria-label="Удалить все рисунки"
        [disabled]="count() === 0"
        (click)="removeAll()"
      >
        <span [innerHTML]="icon('trash')"></span>
      </button>

      <hr />
      <button
        type="button"
        class="item"
        [appTooltip]="undoLabel() ? 'Отменить: ' + undoLabel() + ' · Ctrl+Z' : 'Отменить · Ctrl+Z'"
        aria-label="Отменить"
        [disabled]="!canUndo()"
        (click)="undo()"
      >
        <span [innerHTML]="icon('undo')"></span>
      </button>
      <button
        type="button"
        class="item"
        [appTooltip]="redoLabel() ? 'Повторить: ' + redoLabel() + ' · Ctrl+Shift+Z' : 'Повторить · Ctrl+Shift+Z'"
        aria-label="Повторить"
        [disabled]="!canRedo()"
        (click)="redo()"
      >
        <span [innerHTML]="icon('redo')"></span>
      </button>
    </nav>
    @if (canScrollDown()) {
      <button type="button" class="scroll down" aria-label="Прокрутить панель вниз" (click)="scrollBar(1)">
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
      </button>
    }

    @if (flyout(); as f) {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="f.origin"
        [cdkConnectedOverlayOpen]="true"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayPush]="true"
        (overlayOutsideClick)="closeFlyout($event)"
        (detach)="flyout.set(null)"
        (overlayKeydown)="$event.key === 'Escape' && flyout.set(null)"
      >
        <div class="flyout" role="menu" [attr.aria-label]="f.group.title">
          <div class="head">{{ f.group.title }}</div>
          @for (section of f.sections; track section.id) {
            @if (f.sections.length > 1) {
              <div class="section">{{ section.title }}</div>
            }
            @for (t of section.tools; track t.name) {
              <div
                class="row"
                role="menuitem"
                tabindex="0"
                [class.active]="tool() === t.name"
                (click)="pickFromGroup(f.group, t)"
                (keydown.enter)="pickFromGroup(f.group, t)"
              >
                <span class="ico" [innerHTML]="icon(t.name)"></span>
                <span class="name">{{ name(t.name) }}</span>
                <kbd>{{ keysOf(t.name) }}</kbd>
                <button
                  type="button"
                  class="star"
                  [class.on]="isFavorite(t.name)"
                  [attr.aria-label]="isFavorite(t.name) ? 'Открепить от панели' : 'Закрепить на панели'"
                  [attr.aria-pressed]="isFavorite(t.name)"
                  (click)="toggleFavorite(t, $event)"
                >
                  ★
                </button>
              </div>
            }
          }
        </div>
      </ng-template>
    }
  `,
  styleUrl: './nv-drawbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NvDrawbar {
  private readonly runtime = inject(NvRuntime);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly nav = viewChild.required<ElementRef<HTMLElement>>('nav');

  /** График, который чистит «удалить все» и чьи рисунки прячет «скрыть». */
  readonly chart = input<Chart | null>(null);

  protected readonly positions = FLYOUT_POSITIONS;
  protected readonly tool = this.runtime.activeTool;
  protected readonly flyout = signal<Flyout | null>(null);
  protected readonly magnet = signal(false);
  protected readonly magnetHeld = signal(false);
  protected readonly keep = signal(false);
  protected readonly canUndo = signal(false);
  protected readonly canRedo = signal(false);
  protected readonly undoLabel = signal('');
  protected readonly redoLabel = signal('');
  /** Рисунков на графике / из них скрытых — меняется с каждым событием движка. */
  protected readonly count = signal(0);
  private readonly hiddenCount = signal(0);
  protected readonly hidden = computed(() => this.count() > 0 && this.hiddenCount() === this.count());
  /** Невысокий график: кнопки не помещаются — стрелки прокрутки, как в TradingView. */
  protected readonly canScrollUp = signal(false);
  protected readonly canScrollDown = signal(false);

  private readonly tools = signal<Drawings | null>(null);
  private readonly last = signal<Record<string, string>>(readChartPref(LAST_KEY, {}));
  private readonly favoriteNames = signal<string[]>(readChartPref(FAVORITES_KEY, DEFAULT_FAVORITES));
  private readonly icons = new Map<string, SafeHtml>();
  private readonly offs: (() => void)[] = [];

  protected readonly groups = computed<ToolGroupButton[]>(() => {
    const tools = this.tools();
    if (!tools) return [];
    const active = this.tool();
    const last = this.last();
    return BAR_GROUPS.flatMap((g) => {
      const list = tools.catalog.filter((t) => g.groups.includes(t.group));
      if (list.length === 0) return [];
      const current = list.find((t) => t.name === active);
      const shown = current ?? list.find((t) => t.name === last[g.id]) ?? list[0];
      return [{ id: g.id, title: GROUP_NAMES[g.id] ?? g.id, tools: list, shown, active: !!current }];
    });
  });

  protected readonly favorites = computed<ToolInfo[]>(() => {
    const catalog = this.tools()?.catalog ?? [];
    return this.favoriteNames().flatMap((n) => catalog.filter((t) => t.name === n));
  });

  constructor() {
    void this.connect();
    // Счётчики рисунков — того графика, что сейчас под панелью.
    effect(() => {
      this.chart();
      untracked(() => this.sync());
    });
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.nav().nativeElement);
      this.offs.push(() => observer.disconnect());
      this.measure();
    });
    inject(DestroyRef).onDestroy(() => {
      for (const off of this.offs.splice(0)) off();
    });
  }

  protected measure(): void {
    const nav = this.nav().nativeElement;
    this.canScrollUp.set(nav.scrollTop > 1);
    this.canScrollDown.set(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1);
  }

  protected scrollBar(direction: 1 | -1): void {
    const nav = this.nav().nativeElement;
    nav.scrollBy({ top: direction * Math.max(96, nav.clientHeight * 0.6), behavior: 'smooth' });
  }

  protected icon(name: string): SafeHtml {
    let html = this.icons.get(name);
    if (!html) {
      // Статичная SVG-разметка из таблицы иконок — без пользовательских данных.
      html = this.sanitizer.bypassSecurityTrustHtml(toolIcon(name));
      this.icons.set(name, html);
    }
    return html;
  }

  protected name(tool: string): string {
    return TOOL_NAMES[tool] ?? this.tools()?.catalog.find((t) => t.name === tool)?.title ?? tool;
  }

  protected keysOf(tool: string): string {
    return (this.tools()?.bindings[tool] ?? []).filter((k) => !k.includes('Click')).join(', ');
  }

  /** «Название · Alt+T». */
  protected title(tool: string): string {
    const keys = this.keysOf(tool);
    return keys ? `${this.name(tool)} · ${keys}` : this.name(tool);
  }

  protected isFavorite(tool: string): boolean {
    return this.favoriteNames().includes(tool);
  }

  protected pick(name: string | null): void {
    this.runtime.setTool(name !== null && this.tool() === name ? null : name);
  }

  protected toggleGroup(group: ToolGroupButton, origin: CdkOverlayOrigin): void {
    if (this.flyout()?.group.id === group.id) {
      this.flyout.set(null);
      return;
    }
    const sections: Flyout['sections'] = [];
    for (const t of group.tools) {
      const tail = sections[sections.length - 1];
      if (tail?.id === t.group) tail.tools.push(t);
      else sections.push({ id: t.group, title: SECTION_NAMES[t.group] ?? t.group, tools: [t] });
    }
    this.flyout.set({ group, origin, sections });
  }

  protected closeFlyout(event: MouseEvent): void {
    // Стрелка группы переключает список сама — иначе он закрылся бы и тут же открылся.
    const target = event.target as HTMLElement | null;
    if (target?.closest('.more')) return;
    this.flyout.set(null);
  }

  protected pickFromGroup(group: ToolGroupButton, tool: ToolInfo): void {
    this.last.update((last) => ({ ...last, [group.id]: tool.name }));
    writeChartPref(LAST_KEY, this.last());
    this.flyout.set(null);
    this.runtime.setTool(tool.name);
  }

  protected toggleFavorite(tool: ToolInfo, event: MouseEvent): void {
    event.stopPropagation();
    this.favoriteNames.update((names) =>
      names.includes(tool.name) ? names.filter((n) => n !== tool.name) : [...names, tool.name],
    );
    writeChartPref(FAVORITES_KEY, this.favoriteNames());
    queueMicrotask(() => this.measure());
  }

  protected toggleMagnet(): void {
    this.runtime.setMagnet(!this.magnet());
    this.sync();
  }

  protected toggleKeep(): void {
    const tools = this.tools();
    if (!tools) return;
    tools.setOptions({ keepTool: !tools.options.keepTool });
    this.sync();
  }

  protected toggleHidden(): void {
    const tools = this.tools();
    const chart = this.chart();
    if (!tools || !chart) return;
    const hide = !this.hidden();
    tools.history.batch(hide ? 'скрыть рисунки' : 'показать рисунки', () => {
      for (const d of tools.list(chart)) tools.update(d.id, { hidden: hide }, { undoable: true });
    });
  }

  protected removeAll(): void {
    const tools = this.tools();
    const chart = this.chart();
    if (tools && chart) tools.clear(chart, { undoable: true });
  }

  protected undo(): void {
    this.tools()?.history.undo();
  }

  protected redo(): void {
    this.tools()?.history.redo();
  }

  /** Горячие клавиши движка — на всей странице, кроме полей ввода и диалогов. */
  protected routeKey(event: KeyboardEvent): void {
    const tools = this.tools();
    if (!tools || event.defaultPrevented || isTypingTarget(event.target)) return;
    if (tools.handleKey(event)) event.preventDefault();
    const held = event.ctrlKey || event.metaKey;
    if (held !== this.magnetHeld()) this.magnetHeld.set(held);
  }

  private async connect(): Promise<void> {
    const context = await this.runtime.load().catch(() => null);
    if (!context) return;
    const tools = context.tools;
    this.tools.set(tools);
    const sync = () => this.sync();
    this.offs.push(
      tools.on('tool', sync),
      tools.on('created', sync),
      tools.on('updated', sync),
      tools.on('removed', sync),
      tools.history.on('change', sync),
    );
    const release = () => this.magnetHeld.set(false);
    const keyUp = (e: KeyboardEvent) => this.magnetHeld.set(e.ctrlKey || e.metaKey);
    window.addEventListener('blur', release);
    document.addEventListener('keyup', keyUp);
    this.offs.push(() => {
      window.removeEventListener('blur', release);
      document.removeEventListener('keyup', keyUp);
    });
    this.sync();
  }

  private sync(): void {
    const tools = this.tools();
    if (!tools) return;
    this.magnet.set(tools.options.magnet !== 'off');
    this.keep.set(tools.options.keepTool);
    const history = tools.history;
    this.canUndo.set(history.canUndo);
    this.canRedo.set(history.canRedo);
    this.undoLabel.set(history.undoLabel);
    this.redoLabel.set(history.redoLabel);
    const chart = this.chart();
    const list = chart ? tools.list(chart) : [];
    this.count.set(list.length);
    this.hiddenCount.set(list.filter((d) => d.hidden).length);
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return (
    el.isContentEditable ||
    !!el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
  );
}
