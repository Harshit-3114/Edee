import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ShortlistEntry } from '@/lib/types';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock('@/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const { useShortlist } = await import('@/hooks/useShortlist');

const entry: ShortlistEntry = {
  id: 'sl-1',
  college_id: 'col-1',
  course_id: 'crs-1',
  college_name: 'Fergusson College',
  course_name: 'B.Sc Statistics',
  city: 'Pune',
  state: 'Maharashtra',
  stream: 'UG',
  application_fee: 90000,
  closing_date: null,
  created_at: '2026-06-01T10:00:00Z',
};

describe('useShortlist', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset().mockResolvedValue({});
    del.mockReset().mockResolvedValue({});
  });

  it('loads the shortlist and totals the fees', async () => {
    get.mockResolvedValue({ data: [entry, { ...entry, id: 'sl-2', course_id: 'crs-2', application_fee: 125000 }] });

    const { result } = renderHook(() => useShortlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.total).toBe(215000);
  });

  it('knows which courses are already on the list', async () => {
    get.mockResolvedValue({ data: [entry] });

    const { result } = renderHook(() => useShortlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.has('crs-1')).toBe(true);
    expect(result.current.has('crs-9')).toBe(false);
  });

  it('adds a course that is not on the list yet', async () => {
    get.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useShortlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggle('col-1', 'crs-1');
    });

    expect(post).toHaveBeenCalledWith('/shortlists/', {
      college_id: 'col-1',
      course_id: 'crs-1',
    });
  });

  it('removes a course that is already on the list', async () => {
    get.mockResolvedValue({ data: [entry] });

    const { result } = renderHook(() => useShortlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggle('col-1', 'crs-1');
    });

    // Toggling something present must delete it, not add a duplicate.
    expect(del).toHaveBeenCalledWith('/shortlists/sl-1');
    expect(post).not.toHaveBeenCalled();
  });

  it('surfaces a load failure instead of showing an empty list', async () => {
    get.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useShortlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Could not load your shortlist.');
  });
});
