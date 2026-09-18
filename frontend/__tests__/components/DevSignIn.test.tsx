import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
const apiGet = vi.fn();
const fetchMock = vi.fn();

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

const { default: DevSignIn } = await import('@/components/auth/DevSignIn');

const directory = {
  colleges: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Dir College', slug: 'dir-college' }],
  coaching_centres: [{ id: '22222222-2222-2222-2222-222222222222', name: 'Dir Centre' }],
};

function stubHealth(devMode: boolean) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'ok', dev_mode: devMode }),
  });
}

describe('DevSignIn', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('');
    apiGet.mockReset().mockImplementation((url: unknown) => {
      if (url === '/dev/directory') return Promise.resolve({ data: directory });
      return Promise.reject(new Error(`unexpected ${String(url)}`));
    });
    replace.mockReset();
    window.localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    stubHealth(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays hidden when the backend is not in dev mode', async () => {
    stubHealth(false);
    const { container } = render(<DevSignIn />);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // Let the check resolve and the component settle before asserting.
    await act(async () => {});
    expect(apiGet).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('signs in as a college from the directory', async () => {
    mockSearchParams = new URLSearchParams('portal=college');
    render(<DevSignIn />);
    await screen.findByRole('combobox', { name: /college/i });

    await act(async () => {
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: /college/i }),
        '11111111-1111-1111-1111-111111111111',
      );
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /sign in as college/i }));
    });

    expect(window.localStorage.getItem('edee_dev_token')).toBe(
      'dev:college:11111111-1111-1111-1111-111111111111',
    );
    expect(replace).toHaveBeenCalledWith('/college/dashboard');
  });

  it('signs in as a labelled student with no organisation needed', async () => {
    mockSearchParams = new URLSearchParams('portal=student');
    render(<DevSignIn />);
    await screen.findByRole('textbox', { name: /label/i });

    await act(async () => {
      await userEvent.type(screen.getByLabelText(/label/i), 'alice');
    });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /sign in as student/i }));
    });

    expect(window.localStorage.getItem('edee_dev_token')).toBe('dev:student:alice');
    expect(replace).toHaveBeenCalledWith('/student/dashboard');
  });
});
