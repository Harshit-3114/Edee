import { serverGet } from '@/lib/serverApi';
import ShortlistClient from './ShortlistClient';
import type { ShortlistEntry } from '@/lib/types';

/**
 * Fetched here, on the server, with the session cookie.
 */
export default async function Page() {
  const initialEntries = await serverGet<ShortlistEntry[]>('/shortlists/');

  return <ShortlistClient initialEntries={initialEntries} />;
}
