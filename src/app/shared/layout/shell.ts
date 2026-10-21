import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../ui/icon';
import { ToastOutlet, ToastService } from '../ui/toast';
import { AccountSwitcher } from './account-switcher';
import { PeriodPicker } from './period-picker';
import { IconName } from '../ui/icons';
import { SketchUnderline } from '../ui/sketch/sketch-underline';
import { Tooltip } from '../ui/tooltip';
import { AuthStore } from '../../core/auth/auth-store';
import { AccountsStore } from '../../features/accounts/accounts-store';
import { EventsSocket } from '../../core/events/events-socket';
import { formatMoney } from '../../features/trades/data/trade.model';

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
    SketchUnderline,
    Tooltip,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthStore);
  /** Пока счетов нет, период выбирать не из чего — в шапке только подключение. */
  protected readonly accounts = inject(AccountsStore);

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
