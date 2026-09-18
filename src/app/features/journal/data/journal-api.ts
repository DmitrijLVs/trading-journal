import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JournalEntry } from './journal.model';

@Injectable({ providedIn: 'root' })
export class JournalApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/journal';

  list() {
    return httpResource<JournalEntry[]>(() => this.baseUrl);
  }

  upsert(entry: JournalEntry): Promise<JournalEntry> {
    return firstValueFrom(this.http.put<JournalEntry>(`${this.baseUrl}/${entry.date}`, entry));
  }
}
