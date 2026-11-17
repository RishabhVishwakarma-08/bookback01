import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
}

let store: typeof import('../src/data/localStore');

beforeEach(async () => {
  vi.resetModules();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new MemoryStorage(),
  });
  store = await import('../src/data/localStore');
});

describe('local demo data', () => {
  it('persists registered users and sign-in state across reloads', async () => {
    const user = store.registerDemoUser({
      name: 'Test Student',
      email: 'test.student@mitsgwalior.in',
      collegeId: 'TEST001',
      branch: 'CSE',
      year: '2nd Year',
      semester: 4,
      password: 'demo-password',
    });
    store.setCurrentUserId(user.id);

    vi.resetModules();
    const reloadedStore = await import('../src/data/localStore');

    expect(reloadedStore.getCurrentUserId()).toBe(user.id);
    expect(reloadedStore.getDemoUser(user.id)?.email).toBe('test.student@mitsgwalior.in');
  });

  it('searches and sorts the locally stored book catalog', () => {
    const books = store.getBooks();
    expect(books.length).toBeGreaterThan(1);
    expect(store.getBooks({ query: books[0].title }).map((book) => book.id)).toEqual([books[0].id]);

    const sortedByPrice = store.getBooks({ sort: 'price_asc' });
    expect(sortedByPrice.map((book) => book.price)).toEqual(
      [...sortedByPrice].map((book) => book.price).sort((a, b) => a - b),
    );
  });

  it('creates a request and conversation without a server', () => {
    const requester = store.registerDemoUser({
      name: 'Requesting Student',
      email: 'requester@mitsgwalior.in',
      collegeId: 'REQUEST001',
      branch: 'CSE',
      year: '2nd Year',
      semester: 4,
      password: 'demo-password',
    });
    const book = store.getBooks()[0];

    const request = store.createBookRequest(
      book.id,
      requester.id,
      'Is this copy still available?',
      'Central Library',
    );

    expect(store.getRequests(requester.id, 'outgoing').map((item) => item.id)).toContain(request.id);
    expect(store.getRequestDetails(request.id, requester.id).messages[0].body).toBe(
      'Is this copy still available?',
    );
  });
});
