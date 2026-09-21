import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Nothing here is worth prerendering: the whole screen depends on a Firebase
 * session that only exists in the browser, and static generation would need
 * Firebase credentials at build time to render a form nobody sees.
 */
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginClient />;
}
