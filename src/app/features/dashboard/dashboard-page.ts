import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccountsStore } from '../accounts/accounts-store';
import { TradesStore } from '../trades/trades-store';
import { Skeleton } from '../../shared/ui/skeleton';
import { Dashboard } from './dashboard';
import { DashboardOnboarding } from './dashboard-onboarding';

/**
 * «Обзор»: без подключённого ключа (и пока первая история ещё грузится) —
 * онбординг вместо пустой сетки виджетов.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [Dashboard, DashboardOnboarding, Skeleton],
  template: `
    @switch (mode()) {
      @case ('loading') {
        <div class="loading"><app-skeleton height="240px" /></div>
      }
      @case ('onboarding') {
        <app-dashboard-onboarding />
      }
      @default {
        <app-dashboard />
      }
    }
  `,
  styles: `
    @use 'styles/index' as *;

    :host { display: block; height: 100%; }
    .loading { padding: $space-6; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly accounts = inject(AccountsStore);
  private readonly trades = inject(TradesStore);

  protected readonly mode = computed<'loading' | 'onboarding' | 'grid'>(() => {
    if (!this.accounts.hasLoaded()) return this.accounts.error() ? 'grid' : 'loading';
    if (!this.accounts.hasAccounts()) return 'onboarding';
    // Ключ только что подключён: пока не пришла первая сделка — показываем импорт.
    return this.accounts.isImporting() && this.trades.all().length === 0 ? 'onboarding' : 'grid';
  });
}
