import PortalFrame from '@/components/auth/PortalFrame';

/**
 * Every page in this portal is gated on a Firebase token that only exists in
 * the browser, so there is nothing meaningful to prerender. Forcing dynamic
 * rendering also keeps the build from needing Firebase credentials.
 */
export const dynamic = 'force-dynamic';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <PortalFrame role="student">{children}</PortalFrame>;
}
