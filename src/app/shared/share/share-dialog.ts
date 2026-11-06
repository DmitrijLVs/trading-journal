import { DIALOG_DATA, Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ShareCard, ShareLayout, canvasToPng, readSharePalette, renderShareCard } from './share-card';
import { PrivacyStore } from '../../core/state/privacy-store';
import { storedChoice } from '../../core/state/stored-signal';
import { DialogShell } from '../ui/dialog-shell';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Toggle } from '../ui/toggle';
import { Skeleton } from '../ui/skeleton';
import { Segmented, SegmentOption } from '../ui/segmented';
import { ToastService } from '../ui/toast';

export interface ShareOptions {
  /** Скрыть суммы. */
  mask: boolean;
  /** Вид снимка (только у сделки; у остальных — 'card'). */
  layout: ShareLayout;
}

export interface ShareRequest {
  /** «Снимок сделки», «Снимок недели». */
  title: string;
  /** Имя файла без расширения. */
  fileName: string;
  /** Есть ли выбор вида «Карточка | Только график» (снимок сделки). */
  layouts?: boolean;
  /** Содержимое снимка; может ждать кадр графика. */
  build: (options: ShareOptions) => ShareCard | Promise<ShareCard>;
}

const LAYOUT_OPTIONS: SegmentOption<ShareLayout>[] = [
  { value: 'card', label: 'Карточка' },
  { value: 'chart', label: 'Только график' },
];

interface RenderedImage {
  blob: Blob;
  url: string;
  ratio: number;
}

/** Есть ли системное «Поделиться» с файлами (телефоны, Safari, Chrome на Windows/ChromeOS). */
function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob()], 'snapshot.png', { type: 'image/png' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Предпросмотр снимка и что с ним сделать: скопировать картинку в буфер
 * (вставить в чат), скачать PNG или отдать системному «Поделиться». Суммы
 * можно спрятать прямо здесь — по умолчанию как в приложении (глаз в шапке).
 */
@Component({
  imports: [DialogShell, Button, Icon, Toggle, Skeleton, Segmented],
  template: `
    <app-dialog-shell [title]="data.title">
      <div class="preview" [style.aspect-ratio]="image()?.ratio ?? 16 / 9">
        @if (image(); as img) {
          <img [src]="img.url" [alt]="data.title" />
        } @else if (failed()) {
          <p class="error">Картинка не собралась. Закройте окно и попробуйте ещё раз.</p>
        } @else {
          <app-skeleton height="100%" />
        }
      </div>

      <div class="options">
        @if (data.layouts) {
          <app-segmented class="layouts" [options]="layoutOptions" [value]="layout()" (valueChange)="setLayout($event)" />
        }
        <label class="option">
          <app-toggle [(checked)]="showMoney" />
          <span>Показывать суммы</span>
          <span class="hint">без них — только проценты и счётчики</span>
        </label>
      </div>

      <ng-container dialog-footer>
        <button app-button variant="outline" [disabled]="!image()" (click)="download()">
          <app-icon name="download" style="--icon-size: 14px" />
          Скачать
        </button>
        <button app-button [variant]="shareable ? 'outline' : 'primary'" [disabled]="!image()" (click)="copy()">
          <app-icon name="copy" style="--icon-size: 14px" />
          Копировать
        </button>
        @if (shareable) {
          <button app-button variant="primary" [disabled]="!image()" (click)="share()">Поделиться</button>
        }
      </ng-container>
    </app-dialog-shell>
  `,
  styles: `
    @use 'styles/index' as *;

    :host {
      display: block;
      width: min(94vw, 880px);
    }

    .preview {
      display: grid;
      width: 100%;
      max-height: 56vh;
      border-radius: $radius-lg;
      overflow: hidden;
      border: 1px solid var(--border-default);
      background: var(--canvas-default);
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .error {
      align-self: center;
      margin: 0;
      padding: $space-6;
      text-align: center;
      color: var(--fg-muted);
      font-size: $text-sm;
    }

    .options {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: $space-3 $space-6;
      margin-top: $space-4;
    }

    .layouts { width: 260px; }

    .option {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px $space-3;
      font-size: $text-sm;
      color: var(--fg-default);
      cursor: pointer;
    }

    .hint {
      color: var(--fg-subtle);
      font-size: $text-xs;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog {
  protected readonly data = inject<ShareRequest>(DIALOG_DATA);
  private readonly toast = inject(ToastService);
  /** Цвета берём один раз: снимок в теме, открытой в момент нажатия. */
  private readonly palette = readSharePalette();

  protected readonly showMoney = signal(!inject(PrivacyStore).hidden());
  /** Вид снимка сделки запоминается: кто делится «только графиком», делится им всегда. */
  protected readonly layout = storedChoice<ShareLayout>('tj.share.layout', ['card', 'chart'], 'card');
  protected readonly layoutOptions = LAYOUT_OPTIONS;
  protected readonly image = signal<RenderedImage | null>(null);
  protected readonly failed = signal(false);
  protected readonly shareable = canShareFiles();
  private seq = 0;

  constructor() {
    effect(() => {
      const options: ShareOptions = {
        mask: !this.showMoney(),
        layout: this.data.layouts ? this.layout() : 'card',
      };
      untracked(() => void this.render(options));
    });
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected setLayout(value: string): void {
    if (value === 'card' || value === 'chart') this.layout.set(value);
  }

  private async render(options: ShareOptions): Promise<void> {
    const seq = ++this.seq;
    try {
      const canvas = await renderShareCard(await this.data.build(options), this.palette);
      const blob = await canvasToPng(canvas);
      if (seq !== this.seq) return;
      this.revoke();
      this.failed.set(false);
      this.image.set({ blob, url: URL.createObjectURL(blob), ratio: canvas.width / canvas.height });
    } catch {
      if (seq === this.seq) this.failed.set(true);
    }
  }

  protected async copy(): Promise<void> {
    const img = this.image();
    if (!img) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ [img.blob.type]: img.blob })]);
      this.toast.success('Снимок скопирован — вставьте его в чат');
    } catch {
      this.toast.error('Браузер не дал скопировать картинку — скачайте файл');
    }
  }

  protected download(): void {
    const img = this.image();
    if (!img) return;
    const link = document.createElement('a');
    link.href = img.url;
    link.download = `${this.data.fileName}.png`;
    link.click();
  }

  protected async share(): Promise<void> {
    const img = this.image();
    if (!img) return;
    const file = new File([img.blob], `${this.data.fileName}.png`, { type: img.blob.type });
    try {
      await navigator.share({ files: [file], title: this.data.title });
    } catch (error) {
      // Закрыли системное окно — это не ошибка.
      if ((error as DOMException).name !== 'AbortError') {
        this.toast.error('Не получилось поделиться — скопируйте или скачайте снимок');
      }
    }
  }

  private revoke(): void {
    const img = this.image();
    if (img) URL.revokeObjectURL(img.url);
  }
}

/** Открыть снимок: `share.open({ title, fileName, build })`. */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly dialog = inject(Dialog);

  open(request: ShareRequest): void {
    this.dialog.open(ShareDialog, {
      data: request,
      panelClass: ['tj-dialog-panel', 'tj-dialog-panel--wide'],
      backdropClass: 'tj-dialog-backdrop',
      ariaLabel: request.title,
    });
  }
}

/** Часть имени файла: латиница и цифры, остальное — дефис (`BTCUSDT` → `btcusdt`). */
export function fileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
