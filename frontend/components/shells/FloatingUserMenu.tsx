'use client';

import UserMenu from './UserMenu';

/**
 * The account button for the handful of pages that render no header at all:
 * the public college landing page, signup, unauthorised, 404 and the error
 * boundary. UserMenu renders nothing when signed out, so this leaves those
 * pages exactly as they were for a logged-out visitor.
 */
export default function FloatingUserMenu() {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex justify-end">
      <div className="pointer-events-auto">
        <UserMenu />
      </div>
    </div>
  );
}
