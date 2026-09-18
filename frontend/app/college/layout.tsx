import PortalFrame from '@/components/auth/PortalFrame';
import { serverRole } from '@/lib/serverRole';

/**
 * Every page in this portal is gated on a Firebase token that only exists in
 * the browser, so there is nothing meaningful to prerender. Forcing dynamic
 * rendering also keeps the build from needing Firebase credentials.
 */
export const dynamic = 'force-dynamic';

export default async function CollegeLayout({ children }: { children: React.ReactNode }) {
  // Verified on the server from the session cookie, so the shell and its
  // content can render before any JavaScript runs.
  const verified = await serverRole();
  return (
    <PortalFrame role="college" serverRole={verified}>
      {children}
    </PortalFrame>
  );
}
