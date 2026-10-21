import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { BINANCE_API_URL } from './exchange-key-form';

/** Как создать read-only ключ на Binance — коротко, по шагам. */
@Component({
  selector: 'app-binance-key-guide',
  imports: [Icon],
  template: `
    <ol class="steps">
      <li>
        Откройте
        <a [href]="apiUrl" target="_blank" rel="noopener noreferrer">
          управление API на Binance
          <app-icon name="link" style="--icon-size: 12px" />
        </a>
      </li>
      <li>«Создать API» → «Системный ключ», задайте имя и пройдите проверку безопасности</li>
      <li>
        В ограничениях оставьте <b>только «Разрешить чтение»</b>. Торговлю, вывод и переводы не включайте
      </li>
      <li>Скопируйте API Key и Secret Key — секрет Binance показывает один раз</li>
    </ol>
  `,
  styles: `
    @use 'styles/index' as *;

    .steps {
      display: flex;
      flex-direction: column;
      gap: $space-2;
      margin: 0;
      padding-left: 20px;
      color: var(--fg-muted);
      font-size: $text-sm;
      line-height: 1.5;
    }

    li::marker {
      color: var(--fg-subtle);
      font-family: $font-mono;
      font-size: $text-xs;
    }

    b {
      color: var(--fg-default);
      font-weight: 600;
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      color: var(--accent-fg);
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BinanceKeyGuide {
  protected readonly apiUrl = BINANCE_API_URL;
}
