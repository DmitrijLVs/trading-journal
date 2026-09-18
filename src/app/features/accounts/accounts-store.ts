import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccountsApi } from './data/accounts-api';
import { Account, AccountDraft } from './data/account.model';

const STORAGE_KEY = 'tj.selectedAccount';

/** Все подключённые счета + выбранный счёт (движет весь анализ). */
@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly api = inject(AccountsApi);
  private readonly resource = this.api.list();

  /** 'all' — агрегировать по всем счетам. */
  private readonly _selectedId = signal<string>(readStoredSelection());

  readonly accounts = computed<readonly Account[]>(() => this.resource.value() ?? []);
  readonly isLoading = this.resource.isLoading;
  readonly selectedId = this._selectedId.asReadonly();

  readonly selected = computed<Account | null>(() => {
    const id = this._selectedId();
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this._selectedId());
      } catch {
        // ignore
      }
    });
    // Выбранный счёт удалили — откатываемся на «все счета».
    effect(() => {
      const accounts = this.resource.value();
      if (accounts && this._selectedId() !== 'all' && !accounts.some((a) => a.id === this._selectedId())) {
        this._selectedId.set('all');
      }
    });
  }

  select(id: string): void {
    this._selectedId.set(id);
  }

  async create(draft: AccountDraft): Promise<void> {
    await this.api.create(draft);
    this.resource.reload();
  }

  async update(id: string, patch: Partial<Account>): Promise<void> {
    await this.api.update(id, patch);
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
