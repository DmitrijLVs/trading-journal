import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../ui/icon';
import { ToastOutlet } from '../ui/toast';
import { AccountSwitcher } from './account-switcher';
import { PeriodPicker } from './period-picker';
import { IconName } from '../ui/icons';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon, ToastOutlet, AccountSwitcher, PeriodPicker],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly mainNav: readonly NavItem[] = [
    { path: '/dashboard', label: 'Дашборд', icon: 'dashboard' },
    { path: '/trades', label: 'Сделки', icon: 'trades' },
    { path: '/journal', label: 'Журнал', icon: 'journal' },
  ];

  protected readonly systemNav: readonly NavItem[] = [
    { path: '/accounts', label: 'Счета', icon: 'wallet' },
    { path: '/settings', label: 'Настройки', icon: 'settings' },
  ];
}
