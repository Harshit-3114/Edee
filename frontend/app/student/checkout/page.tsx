import { serverGet } from '@/lib/serverApi';
import CheckoutClient from './CheckoutClient';
import type { ShortlistEntry } from '@/lib/types';

/**
 * Fetched here, on the server, with the session cookie - so the basket and its
 * total are on screen before the payment script has finished loading.
 */
export default async function Page() {
  const initialEntries = await serverGet<ShortlistEntry[]>('/shortlists/');

  return <CheckoutClient initialEntries={initialEntries} />;
}
