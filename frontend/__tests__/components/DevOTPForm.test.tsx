import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiPost = vi.fn();

vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => apiPost(...args) },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

const { default: DevOTPForm } = await import('@/components/auth/DevOTPForm');

function setup(onSuccess = vi.fn()) {
  window.localStorage.clear();
  apiPost.mockReset().mockImplementation((url: unknown, body: {
    role: string;
    tag: string | null;
    phone: string | null;
  }) => {
    if (url !== '/dev/mock-user') {
      return Promise.reject(new Error(`unexpected ${String(url)}`));
    }
    return Promise.resolve({ data: { token: `dev:student:${body.phone}` } });
  });
  const onError = vi.fn();
  render(<DevOTPForm onSuccess={onSuccess} onError={onError} />);
  return { onSuccess, onError };
}

describe('DevOTPForm', () => {
  it('asks for a mobile number first', () => {
    setup();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code/i })).toBeInTheDocument();
  });

  it('rejects anything that is not 10 digits', async () => {
    const { onSuccess } = setup();
    await userEvent.type(screen.getByLabelText(/mobile number/i), '12345');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    expect(screen.getByText(/10-digit/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('provisions a mock student on any 4 digits', async () => {
    const { onSuccess } = setup();
    await userEvent.type(screen.getByLabelText(/mobile number/i), '1234567890');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/verification code/i), '0000');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));

    expect(apiPost).toHaveBeenCalledWith('/dev/mock-user', {
      role: 'student',
      tag: '1234567890',
      phone: '1234567890',
    });
    expect(window.localStorage.getItem('edee_dev_token')).toBe('dev:student:1234567890');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('refuses codes that are not 4 digits without calling the backend', async () => {
    const { onSuccess } = setup();
    await userEvent.type(screen.getByLabelText(/mobile number/i), '1234567890');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));
    await screen.findByLabelText(/verification code/i);

    await userEvent.type(screen.getByLabelText(/verification code/i), '12');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(screen.getByText(/enter any 4 digits/i)).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('edee_dev_token')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
