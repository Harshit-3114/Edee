'use client';

import { useRole } from '@/hooks/useRole';
import { useIdleLogout } from '@/hooks/useIdleLogout';

/**
 * Renders nothing. Mounted once in the root layout so the idle clock covers
 * every route, including the pages that render no header of their own.
 */
export default function SessionTimeout() {
  const { role, loading } = useRole();
  useIdleLogout(!loading && role !== null);
  return null;
}
