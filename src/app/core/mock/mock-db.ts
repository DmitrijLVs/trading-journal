import { Account, AccountDraft, maskApiKey } from '../../features/accounts/data/account.model';
import { JournalEntry } from '../../features/journal/data/journal.model';
import { Trade, TradeDraft } from '../../features/trades/data/trade.model';
import { generateMockData } from './mock-trades';
import { MOCK_ACCOUNTS } from './mock-universe';

/**
 * In-memory «база» мок-сервера. Генерируется один раз на сессию;
 * мутации (POST/PUT/DELETE) меняют её так, как менял бы настоящий бэкенд.
 */
class MockDb {
  readonly accounts: Account[];
  readonly trades: Trade[];
  readonly journal: JournalEntry[];
  private tradeSeq: number;
  private accountSeq = 1;

  constructor() {
    const { trades, journal } = generateMockData();
    this.accounts = MOCK_ACCOUNTS.map((a) => ({ ...a }));
    this.trades = trades;
    this.journal = journal;
    this.tradeSeq = trades.length + 1;
  }

  createTrade(draft: TradeDraft): Trade {
    const trade: Trade = { ...draft, id: `t-${String(this.tradeSeq++).padStart(4, '0')}` };
    this.trades.push(trade);
    return trade;
  }

  updateTrade(id: string, patch: Partial<Trade>): Trade | null {
    const idx = this.trades.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.trades[idx] = { ...this.trades[idx], ...patch, id };
    return this.trades[idx];
  }

  deleteTrade(id: string): boolean {
    const idx = this.trades.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.trades.splice(idx, 1);
    return true;
  }

  upsertJournal(entry: JournalEntry): JournalEntry {
    const idx = this.journal.findIndex((e) => e.date === entry.date);
    if (idx === -1) this.journal.push({ ...entry });
    else this.journal[idx] = { ...entry };
    return entry;
  }

  createAccount(draft: AccountDraft): Account {
    const account: Account = {
      id: `acc-${draft.exchange}-${this.accountSeq++}`,
      name: draft.name,
      exchange: draft.exchange,
      market: draft.market,
      currency: 'USDT',
      startBalance: draft.startBalance,
      createdAt: new Date().toISOString(),
      apiKeyMasked: maskApiKey(draft.apiKey),
      syncEnabled: true,
      lastSyncAt: new Date().toISOString(),
    };
    this.accounts.push(account);
    return account;
  }

  updateAccount(id: string, patch: Partial<Account>): Account | null {
    const idx = this.accounts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.accounts[idx] = { ...this.accounts[idx], ...patch, id };
    return this.accounts[idx];
  }

  deleteAccount(id: string): boolean {
    const idx = this.accounts.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.accounts.splice(idx, 1);
    // Сделки удалённого счёта тоже уходят — как при отключении биржи.
    for (let i = this.trades.length - 1; i >= 0; i--) {
      if (this.trades[i].accountId === id) this.trades.splice(i, 1);
    }
    return true;
  }
}

let db: MockDb | null = null;

export function mockDb(): MockDb {
  return (db ??= new MockDb());
}
