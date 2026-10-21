import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth-store';
import { EventsSocket } from '../../core/events/events-socket';
import { AccountsApi } from './data/accounts-api';
import { Account, AccountDraft } from './data/account.model';

const STORAGE_KEY = 'tj.selectedAccount';
/** Пока идёт импорт истории, статус перечитываем сами (страховка к WS-событиям). */
const IMPORT_POLL_MS = 20_000;

/** Подключённые биржевые аккаунты + выбранный счёт (движет весь анализ). */
@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly api = inject(AccountsApi);
  private readonly auth = inject(AuthStore);
  private readonly owner = computed(() => this.auth.user()?.id ?? null);
  private readonly resource = this.api.list(this.owner);

  /** 'all' — агрегировать по всем счетам. */
  private readonly _selectedId = signal<string>(readStoredSelection());

  // value() бросает, пока ресурс в ошибке, — читаем только через hasValue().
  readonly accounts = computed<readonly Account[]>(() =>
    this.resource.hasValue() ? this.resource.value() : [],
  );
  readonly isLoading = this.resource.isLoading;
  readonly hasLoaded = computed(() => this.resource.hasValue());
  readonly error = this.resource.error;
  readonly selectedId = this._selectedId.asReadonly();
  readonly hasAccounts = computed(() => this.accounts().length > 0);

  readonly selected = computed<Account | null>(() => {
    const id = this._selectedId();
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  /** Хоть один счёт ещё грузит историю — сделки будут появляться. */
  readonly isImporting = computed(() =>
    this.accounts().some((a) => a.status === 'pending' || a.status === 'importing'),
  );

  constructor() {
    // Статус записи счёта меняется событием `sync`; после разрыва сокета — перечитать.
    const events = inject(EventsSocket);
    events.on((event) => event.type === 'sync' && this.resource.reload());
    events.onResync(() => this.resource.reload());

    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this._selectedId());
      } catch {
        // ignore
      }
    });
    // Выбранный счёт удалили — откатываемся на «все счета».
    effect(() => {
      if (!this.resource.hasValue()) return;
      const accounts = this.resource.value();
      if (this._selectedId() !== 'all' && !accounts.some((a) => a.id === this._selectedId())) {
        this._selectedId.set('all');
      }
    });
    effect((onCleanup) => {
      if (!this.isImporting()) return;
      const timer = setInterval(() => this.resource.reload(), IMPORT_POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  select(id: string): void {
    this._selectedId.set(id);
  }

  reload(): void {
    this.resource.reload();
  }

  async create(draft: AccountDraft): Promise<void> {
    await this.api.create(draft);
    this.resource.reload();
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(id);
    this.resource.reload();
  }
}

function readStoredSelection(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'all';
  } catch {
    return 'all';
  }
}
