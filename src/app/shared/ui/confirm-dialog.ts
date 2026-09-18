import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Button } from './button';
import { DialogShell } from './dialog-shell';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Component({
  imports: [DialogShell, Button],
  template: `
    <app-dialog-shell [title]="data.title">
      <p class="message">{{ data.message }}</p>
      <ng-container dialog-footer>
        <button app-button variant="outline" (click)="ref.close(false)">
          {{ data.cancelLabel ?? 'Отмена' }}
        </button>
        <button app-button [variant]="data.danger ? 'danger' : 'primary'" (click)="ref.close(true)">
          {{ data.confirmLabel ?? 'Подтвердить' }}
        </button>
      </ng-container>
    </app-dialog-shell>
  `,
  styles: `
    .message {
      margin: 0;
      color: var(--fg-muted);
      line-height: 1.5;
      max-width: 380px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<boolean>);
}

/** Единая точка подтверждений: `if (await confirm.ask({...})) …` */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(Dialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      data: options,
      panelClass: 'tj-dialog-panel',
      backdropClass: 'tj-dialog-backdrop',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
