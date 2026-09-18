'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { apiErrorMessage } from '@/lib/api';
import type { Notification } from '@/lib/types';

const POLL_MS = 60_000;

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
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
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
