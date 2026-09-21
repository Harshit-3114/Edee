'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Select, Textarea } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { NEXT_STATUS, isTerminal } from '@/lib/applications';
import { APPLICATION_STATUS_LABEL } from '@/lib/format';
import type { ApplicationStatus } from '@/lib/types';

interface Props {
  applicationId: string;
  status: ApplicationStatus;
  onChanged: () => void;
}

export default function StatusForm({ applicationId, status, onChanged }: Props) {
  const [next, setNext] = useState<ApplicationStatus | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const options = NEXT_STATUS[status];

  if (isTerminal(status)) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        This application is {APPLICATION_STATUS_LABEL[status].toLowerCase()}. There is
        nothing further to change from here.
      </p>
    );
  }

  // Accepting or rejecting cannot be undone, so it gets a second step.
  const isFinal = next === 'accepted' || next === 'rejected';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!next) return;

    if (isFinal && !confirming) {
      setConfirming(true);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api.patch(`/college/applications/${applicationId}`, {
        status: next,
        status_note: note.trim() || null,
      });
      setNext('');
      setNote('');
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the application.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="Move to">
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={next}
            onChange={(event) => {
              setNext(event.target.value as ApplicationStatus | '');
              setConfirming(false);
            }}
          >
            <option value="">Choose a status</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {APPLICATION_STATUS_LABEL[option]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Note for the applicant"
        hint="Optional. The student sees this on their dashboard."
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            placeholder="Documents pending verification"
          />
        )}
      </Field>

      {error && <ErrorState message={error} />}

      {confirming && isFinal && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-subtle)] px-3.5 py-2.5 text-[13px] leading-relaxed"
        >
          Marking this {APPLICATION_STATUS_LABEL[next].toLowerCase()} is final. The
          student is notified and the application cannot be reopened.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={busy} disabled={!next}>
          {confirming && isFinal ? 'Yes, confirm' : 'Update status'}
        </Button>
        {confirming && (
          <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
