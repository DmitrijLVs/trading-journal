import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Account,
  AccountDraft,
  ExchangeAccountDto,
  JournalAccountDto,
  toAccount,
} from './account.model';

/**
 * Биржевые аккаунты: ключи — Exchange-Service (`/exchange/exchanges`),
 * состояние записи — Journal-Service (`/journal/accounts`).
 */
@Injectable({ providedIn: 'root' })
export class AccountsApi {
  private readonly http = inject(HttpClient);

  /** Список счетов; `owner` — id пользователя (null: нет сессии — список пуст). */
  list(owner: Signal<string | null>) {
    return resource({
      params: () => owner() ?? undefined,
      loader: async () => {
        const [accounts, journal] = await Promise.all([
          firstValueFrom(this.http.get<ExchangeAccountDto[]>('/exchange/exchanges')),
          firstValueFrom(this.http.get<JournalAccountDto[]>('/journal/accounts')),
        ]);
        const byId = new Map(journal.map((j) => [j.id, j]));
        return accounts.map((a): Account => toAccount(a, byId.get(a.id)));
      },
    });
  }

  /** Подключить Binance Futures read-only ключом. Ключ проверяется на бирже — это пара секунд. */
  async create(draft: AccountDraft): Promise<string> {
    const { id } = await firstValueFrom(
      this.http.post<{ id: string }>('/exchange/exchanges', {
        exchange: 'BINANCE',
        label: draft.label,
        api_key: draft.apiKey,
        api_secret: draft.apiSecret,
      }),
    );
    return id;
  }

  /** Удаляет ключ и всю записанную историю счёта. */
  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/exchange/exchanges/${id}`));
  }
}
