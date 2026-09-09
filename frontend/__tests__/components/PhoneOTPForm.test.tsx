import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInWithPhoneNumber = vi.fn();
const confirm = vi.fn();

vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: class {
    clear() {}
  },
  signInWithPhoneNumber: (...args: unknown[]) => signInWithPhoneNumber(...args),
}));

const { default: PhoneOTPForm } = await import('@/components/auth/PhoneOTPForm');

describe('PhoneOTPForm', () => {
  beforeEach(() => {
    signInWithPhoneNumber.mockReset().mockResolvedValue({ confirm });
    confirm.mockReset();
  });

  it('refuses a number that is not a valid Indian mobile', async () => {
    render(<PhoneOTPForm onSuccess={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/mobile number/i), '1234567890');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/10-digit/i);
    expect(signInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it('sends the number in E.164 form and moves to the code step', async () => {
    render(<PhoneOTPForm onSuccess={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(signInWithPhoneNumber).toHaveBeenCalledWith(
      expect.anything(),
      '+919876543210',
      expect.anything(),
    );
    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it('hands the signed-in user up once the code checks out', async () => {
    const user = { uid: 'uid-1' };
    confirm.mockResolvedValue({ user });
    const onSuccess = vi.fn();
    render(<PhoneOTPForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    await userEvent.type(await screen.findByLabelText(/verification code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    expect(confirm).toHaveBeenCalledWith('123456');
    expect(onSuccess).toHaveBeenCalledWith(user);
  });

  it('explains a wrong code in plain language', async () => {
    confirm.mockRejectedValue({ code: 'auth/invalid-verification-code' });
    render(<PhoneOTPForm onSuccess={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    await userEvent.type(await screen.findByLabelText(/verification code/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/i);
  });

  it('holds the resend button shut until the cooldown passes', async () => {
    render(<PhoneOTPForm onSuccess={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/mobile number/i), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByRole('button', { name: /resend in/i })).toBeDisabled();
  });
});
