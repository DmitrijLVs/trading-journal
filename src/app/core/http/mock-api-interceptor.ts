import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { mockDb } from '../mock/mock-db';
import { generateTradeCandles } from '../mock/mock-candles';
import { Account, AccountDraft } from '../../features/accounts/data/account.model';
import { JournalEntry } from '../../features/journal/data/journal.model';
import { Trade, TradeDraft } from '../../features/trades/data/trade.model';

/**
 * Мок-бэкенд: перехватывает все /api/* запросы и отвечает из in-memory базы
 * с небольшой сетевой задержкой. Удалить при подключении реального API.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const db = mockDb();
  const url = req.url;
  const method = req.method;

  const respond = <T>(body: T, ms = 260): Observable<HttpResponse<T>> =>
    of(new HttpResponse({ status: 200, body })).pipe(delay(ms));

  const notFound = () =>
    throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url }));

  // ── Счета ──────────────────────────────────────────────────────────────
  if (url === '/api/accounts') {
    if (method === 'GET') return respond(db.accounts.map((a) => ({ ...a })));
    if (method === 'POST') return respond(db.createAccount(req.body as AccountDraft), 600);
  }
  const accountMatch = url.match(/^\/api\/accounts\/([^/]+)$/);
  if (accountMatch) {
    const id = accountMatch[1];
    if (method === 'PUT') {
      const updated = db.updateAccount(id, req.body as Partial<Account>);
      return updated ? respond(updated) : notFound();
    }
    if (method === 'DELETE') return db.deleteAccount(id) ? respond({ ok: true }) : notFound();
  }

  // ── Сделки ─────────────────────────────────────────────────────────────
  if (url === '/api/trades') {
    if (method === 'GET') return respond(db.trades.map((t) => ({ ...t })), 380);
    if (method === 'POST') return respond(db.createTrade(req.body as TradeDraft), 420);
  }
  const candlesMatch = url.match(/^\/api\/trades\/([^/?]+)\/candles(?:\?(.*))?$/);
  if (candlesMatch && method === 'GET') {
    const trade = db.trades.find((t) => t.id === candlesMatch[1]);
    const tf = new URLSearchParams(candlesMatch[2] ?? '').get('tf');
    return trade ? respond(generateTradeCandles(trade, tf), 340) : notFound();
  }
  const tradeMatch = url.match(/^\/api\/trades\/([^/]+)$/);
  if (tradeMatch) {
    const id = tradeMatch[1];
    if (method === 'GET') {
      const trade = db.trades.find((t) => t.id === id);
      return trade ? respond({ ...trade }) : notFound();
    }
    if (method === 'PUT') {
      const updated = db.updateTrade(id, req.body as Partial<Trade>);
      return updated ? respond(updated, 300) : notFound();
    }
    if (method === 'DELETE') return db.deleteTrade(id) ? respond({ ok: true }) : notFound();
  }

  // ── Журнал ─────────────────────────────────────────────────────────────
  if (url === '/api/journal' && method === 'GET') {
    return respond(db.journal.map((e) => ({ ...e })));
  }
  const journalMatch = url.match(/^\/api\/journal\/(\d{4}-\d{2}-\d{2})$/);
  if (journalMatch && method === 'PUT') {
    return respond(db.upsertJournal({ ...(req.body as JournalEntry), date: journalMatch[1] }), 240);
  }

  return notFound();
};
