'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '@/lib/api';
import type { Notification } from '@/lib/types';

/**
 * A background tab has nobody reading it, so it polls nothing: the interval is
 * torn down when the page is hidden and a fresh load runs the moment it comes
 * back. Three minutes rather than one - this feeds a badge count, and a tab
 * left open all day was costing sixty requests an hour to keep a number warm.
 */
const POLL_MS = 180_000;

/** The header bell's data: latest notifications plus the unread badge count. */
export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{
        notifications: Notification[];
        unread_count: number;
      }>('/notifications/', { params: { limit: 8 } });
      setItems(data.notifications);
      setUnread(data.unread_count);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load notifications.'));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      void load();
      timer = setInterval(() => void load(), POLL_MS);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') start();
      else stop();
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, load]);

  const markRead = useCallback(
    async (id: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
      try {
        await api.patch(`/notifications/${id}/read`);
      } catch {
        void load();
      }
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, read_at: new Date().toISOString() })),
    );
    setUnread(0);
    try {
      await api.post('/notifications/read-all');
    } catch {
      void load();
    }
  }, [load]);

  return { items, unread, error, reload: load, markRead, markAllRead };
}
