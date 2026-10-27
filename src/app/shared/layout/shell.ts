import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Icon } from '../ui/icon';
import { ToastOutlet, ToastService } from '../ui/toast';
import { AccountSwitcher } from './account-switcher';
import { PeriodPicker } from './period-picker';
import { SessionStrip } from './session-strip';
import { IconName } from '../ui/icons';
import { SketchUnderline } from '../ui/sketch/sketch-underline';
import { Tooltip } from '../ui/tooltip';
import { AuthStore } from '../../core/auth/auth-store';
import { AccountsStore } from '../../features/accounts/accounts-store';
import { EventsSocket } from '../../core/events/events-socket';
import { formatMoney } from '../../features/trades/data/trade.model';
import { PrivacyStore } from '../../core/state/privacy-store';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    Icon,
    ToastOutlet,
    AccountSwitcher,
    PeriodPicker,
    SessionStrip,
    SketchUnderline,
    Tooltip,
  ],
  host: { '(document:keydown)': 'toggleMoneyHotkey($event)' },
  templateUrl: './shell.html',
  // Телефонная раскладка (нижняя навигация) — отдельным файлом.
  styleUrls: ['./shell.scss', './shell-mobile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthStore);
  /** Пока счетов нет, период выбирать не из чего — в шапке только подключение. */
  protected readonly accounts = inject(AccountsStore);

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly onSettings = computed(() => this.url().startsWith('/settings'));

  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly initials = computed(() => this.email().slice(0, 2).toUpperCase());

  constructor() {
    // Живые события журнала — пока открыт каркас приложения (есть сессия).
    const events = inject(EventsSocket);
    const toast = inject(ToastService);
    events.connect();
    events.on((event) => {
      if (event.type !== 'trade' || event.data['status'] !== 'closed') return;
      const realized = Number(event.data['realized_pnl']);
      const result = Number.isFinite(realized) ? ` · ${formatMoney(realized, { sign: true })}` : '';
      toast.info(`Сделка ${event.symbol ?? ''} закрыта${result}`);
    });
  }

  /** Скрыть суммы — показ экрана, стрим, скриншот для чата. */
  protected readonly privacy = inject(PrivacyStore);

  /** Shift+H — быстро спрятать суммы (не в полях ввода). */
  protected toggleMoneyHotkey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code !== 'KeyH') return;
    event.preventDefault();
    this.privacy.toggle();
  }

  protected logout(): void {
    void this.auth.logout();
  }

  protected readonly mainNav: readonly NavItem[] = [
    { path: '/dashboard', label: 'Дашборд', icon: 'dashboard' },
    { path: '/trades', label: 'Сделки', icon: 'trades' },
    { path: '/diary', label: 'Журнал', icon: 'journal' },
  ];

  protected readonly systemNav: readonly NavItem[] = [
    { path: '/settings', label: 'Настройки', icon: 'settings' },
  ];
}
