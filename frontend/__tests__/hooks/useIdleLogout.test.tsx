import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const replace = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false, signOut }) }));

const { useIdleLogout, IDLE_LIMIT_MS, ACTIVITY_KEY } = await import('@/hooks/useIdleLogout');

function Probe({ enabled = true }: { enabled?: boolean }) {
  useIdleLogout(enabled);
  return null;
}

/** Advance fake timers far enough for the 30s checker to run. */
async function idleFor(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-18T10:00:00Z'));
    window.localStorage.clear();
    replace.mockClear();
    signOut.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stamps the clock when a fresh session starts', () => {
    render(<Probe />);
    expect(window.localStorage.getItem(ACTIVITY_KEY)).toBe(String(Date.now()));
  });

  it('leaves a session alone one minute short of the limit', async () => {
    render(<Probe />);
    await idleFor(IDLE_LIMIT_MS - 60_000);
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('signs out and explains why once the limit passes', async () => {
    render(<Probe />);
    await idleFor(IDLE_LIMIT_MS + 30_000);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login?timeout=1');
    expect(window.localStorage.getItem(ACTIVITY_KEY)).toBeNull();
  });

  it('restarts the clock on interaction', async () => {
    render(<Probe />);
    await idleFor(IDLE_LIMIT_MS - 60_000);

    await act(async () => {
      window.dispatchEvent(new Event('keydown'));
    });
    await idleFor(120_000);

    // Without the keypress this would be past the limit.
    expect(signOut).not.toHaveBeenCalled();
  });

  it('expires immediately when a tab reopens onto a stale stamp', async () => {
    window.localStorage.setItem(ACTIVITY_KEY, String(Date.now() - IDLE_LIMIT_MS - 1000));
    await act(async () => {
      render(<Probe />);
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login?timeout=1');
  });

  it('honours a stamp another tab refreshed rather than its own mount time', async () => {
    render(<Probe />);
    await idleFor(IDLE_LIMIT_MS - 60_000);

    // A second tab saw activity and restamped the shared clock.
    window.localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    await idleFor(120_000);

    expect(signOut).not.toHaveBeenCalled();
  });

  it('does nothing for a signed-out visitor', async () => {
    render(<Probe enabled={false} />);
    await idleFor(IDLE_LIMIT_MS + 60_000);
    expect(window.localStorage.getItem(ACTIVITY_KEY)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out once, not on every subsequent check', async () => {
    render(<Probe />);
    await idleFor(IDLE_LIMIT_MS + 300_000);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
