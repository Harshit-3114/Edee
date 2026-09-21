import type { Metadata } from 'next';
import FloatingUserMenu from '@/components/shells/FloatingUserMenu';
import SignupClient from './SignupClient';

export const metadata: Metadata = { title: 'Create your account' };

export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <>
      <FloatingUserMenu />
      <SignupClient />
    </>
  );
}
