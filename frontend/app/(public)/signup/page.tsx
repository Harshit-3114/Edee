import type { Metadata } from 'next';
import SignupClient from './SignupClient';

export const metadata: Metadata = { title: 'Complete your profile' };

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return <SignupClient />;
}
