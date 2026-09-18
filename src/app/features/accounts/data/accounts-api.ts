import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Account, AccountDraft } from './account.model';

@Injectable({ providedIn: 'root' })
export class AccountsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/accounts';

  list() {
    return httpResource<Account[]>(() => this.baseUrl);
  }

  create(draft: AccountDraft): Promise<Account> {
    return firstValueFrom(this.http.post<Account>(this.baseUrl, draft));
  }

  update(id: string, patch: Partial<Account>): Promise<Account> {
    return firstValueFrom(this.http.put<Account>(`${this.baseUrl}/${id}`, patch));
  }

  delete(id: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/${id}`));
  }
}
