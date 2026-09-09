'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';

export default function InviteForm({ onCreated }: { onCreated: () => void }) {
  const [maxUses, setMaxUses] = useState('100');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (Number(maxUses) < 1) {
      setError('A code has to be usable at least once.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/coaching/invites', {
        max_uses: Number(maxUses),
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      });
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the code.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5"
      noValidate
    >
      <h2 className="text-sm font-medium">Issue a code</h2>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        Students enter this when they sign up, which links them to your centre.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Maximum uses" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={1}
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
            />
          )}
        </Field>

        <Field label="Expires on" hint="Leave blank for no expiry.">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
            />
          )}
        </Field>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      <div className="mt-5">
        <Button type="submit" loading={busy}>
          Create code
        </Button>
      </div>
    </form>
  );
}
