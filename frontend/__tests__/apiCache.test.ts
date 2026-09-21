import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({ default: { get }, apiErrorMessage: (_e: unknown, f: string) => f }));

const { cachedGet, clearApiCache, invalidateApiCache, apiCacheSize } = await import(
  '@/lib/apiCache'
);

describe('apiCache', () => {
  beforeEach(() => {
    clearApiCache();
    get.mockReset();
    get.mockImplementation((url: string) => Promise.resolve({ data: { url, n: get.mock.calls.length } }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the network once for repeat reads inside the TTL', async () => {
    const a = await cachedGet('/shortlists/');
    const b = await cachedGet('/shortlists/');
    expect(get).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it('collapses concurrent reads of the same URL into one request', async () => {
    const [a, b, c] = await Promise.all([
      cachedGet('/shortlists/'),
      cachedGet('/shortlists/'),
      cachedGet('/shortlists/'),
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('keys on params, so a different filter is a different read', async () => {
    await cachedGet('/colleges/', { params: { state: 'MH' } });
    await cachedGet('/colleges/', { params: { state: 'KA' } });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('refetches once the entry is older than its TTL', async () => {
    vi.useFakeTimers();
    await cachedGet('/shortlists/', undefined, 1000);
    vi.advanceTimersByTime(1500);
    await cachedGet('/shortlists/', undefined, 1000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('serves a write-invalidated URL fresh', async () => {
    await cachedGet('/shortlists/');
    invalidateApiCache('/shortlists/');
    await cachedGet('/shortlists/');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('leaves unrelated entries alone when invalidating', async () => {
    await cachedGet('/shortlists/');
    await cachedGet('/notifications/');
    invalidateApiCache('/shortlists/');
    expect(apiCacheSize()).toBe(1);
  });

  it('holds nothing once cleared - a signed-out account leaves no data behind', async () => {
    await cachedGet('/shortlists/');
    expect(apiCacheSize()).toBe(1);
    clearApiCache();
    expect(apiCacheSize()).toBe(0);
    await cachedGet('/shortlists/');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed read', async () => {
    get.mockRejectedValueOnce(new Error('network'));
    await expect(cachedGet('/shortlists/')).rejects.toThrow('network');
    expect(apiCacheSize()).toBe(0);
    await cachedGet('/shortlists/');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
