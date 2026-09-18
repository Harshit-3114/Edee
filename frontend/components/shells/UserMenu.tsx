'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UserCircle } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { PORTAL_LABEL, type Role } from '@/lib/portals';

/** Where each role's own details live. Admin's page is deliberately basic. */
export const PROFILE_PATH: Record<Role, string> = {
  student: '/student/profile',
  college: '/college/profile',
  coaching: '/coaching/profile',
  admin: '/admin/profile',
};

/**
 * The signed-in user's account button, shared by every page.
 *
 * Renders nothing at all when nobody is signed in — a logged-out visitor
 * should never see an account control. Sign-out deliberately lives outside
 * this menu: the portal shell already carries its own sign-out button.
 */
export default function UserMenu() {
  const { role, loading } = useRole();
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // A route change means the menu has done its job.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (loading || !role) return null;

  // Dev-token sessions have no Firebase user, so fall back to the role.
  const initial = (user?.email?.[0] ?? role[0]).toUpperCase();

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label="Your account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white ring-2 ring-transparent transition-shadow hover:ring-white/40"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-md)]"
        >
          <div className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3">
            <UserCircle
              size={32}
              weight="fill"
              aria-hidden="true"
              className="shrink-0 text-[var(--accent)]"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {user?.email ?? `${PORTAL_LABEL[role]} account`}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                {PORTAL_LABEL[role]}
              </p>
            </div>
          </div>

          <Link
            href={PROFILE_PATH[role]}
            role="menuitem"
            className="block px-4 py-3 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            Profile
          </Link>
        </div>
      )}
    </div>
  );
}
