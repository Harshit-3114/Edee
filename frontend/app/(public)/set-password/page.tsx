import type { Metadata } from 'next';
import SetPasswordClient from './SetPasswordClient';

export const metadata: Metadata = { title: 'Choose a password' };

// The invite token arrives in the query string and is checked on every load,
// so there is nothing here worth prerendering.
export const dynamic = 'force-dynamic';

export default function SetPasswordPage() {
  return <SetPasswordClient />;
}
