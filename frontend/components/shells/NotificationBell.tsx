'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from '@phosphor-icons/react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate } from '@/lib/format';

/** Header bell with a working dropdown: unread badge, latest items, read-all. */
export default function NotificationBell({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const { items, unread, markRead, markAllRead, reload } = useNotifications(enabled);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void reload();
    function onPointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, reload]);

  function openItem(id: string, link: string | null) {
    void markRead(id);
    setOpen(false);
    if (link) router.push(link);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-label={`${unread} unread`}
            className="tabular absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[11px] font-semibold text-white"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
            <p className="text-sm font-medium">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[13px] font-medium text-[var(--accent-text)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
              Nothing yet. Status changes and payments land here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item.id, item.link)}
                    className={`flex w-full flex-col gap-0.5 border-b border-[var(--line)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)] ${
                      item.read_at ? '' : 'bg-[var(--accent-subtle)]'
                    }`}
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {item.title}
                    </span>
                    {item.body && (
                      <span className="text-[13px] leading-snug text-[var(--text-secondary)]">
                        {item.body}
                      </span>
                    )}
                    <span className="tabular text-xs text-[var(--text-muted)]">
                      {formatDate(item.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
