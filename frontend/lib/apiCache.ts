import api from './api';
import type { AxiosRequestConfig } from './api';
import { onDevSessionChanged } from './devSession';

/**
 * A short-lived cache for GET responses, so moving between portal pages does
 * not refetch what was on screen a moment ago.
 *
 * Two jobs. It serves a fresh-enough response immediately, and it collapses
 * concurrent requests for the same URL into one - two components mounting at
 * once ask the network once.
 *
 * Scope is deliberately narrow: one tab, in memory, gone on reload. It holds
 * one person's data, so clearApiCache() MUST run on sign-out - otherwise the
 * next account signed in on the same tab could read the previous one's
 * responses out of it. useAuth.signOut and clearDevToken both call it.
 */

interface Entry {
  at: number;
  data: unknown;
}

const DEFAULT_TTL_MS = 30_000;

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

function keyFor(url: string, config?: AxiosRequestConfig): string {
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${url}?${params}`;
}

export function clearApiCache(): void {
  cache.clear();
  inFlight.clear();
}

/** Drop cached entries whose URL contains `fragment`, after a write. */
export function invalidateApiCache(fragment: string): void {
  for (const key of [...cache.keys()]) {
    if (key.includes(fragment)) cache.delete(key);
  }
}

/** Read `url`, reusing a recent response when there is one. */
export async function cachedGet<T>(
  url: string,
  config?: AxiosRequestConfig,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const key = keyFor(url, config);

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;

  const pending = inFlight.get(key);
  if (pending) return (await pending) as T;

  const request = api
    .get<T>(url, config)
    .then(({ data }) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return (await request) as T;
}

// Switching dev identity swaps the account without a reload, so drop
// everything the previous one read. (devSession never imports this module, so
// there is no cycle; off the browser the subscription is a no-op.)
onDevSessionChanged(() => clearApiCache());

/** Test seam. */
export function apiCacheSize(): number {
  return cache.size;
}
