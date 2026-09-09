'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import type { Stream } from '@/lib/types';

export default function CourseForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stream, setStream] = useState<Stream>('UG');
  const [duration, setDuration] = useState('4');
  const [seats, setSeats] = useState('60');
  const [fee, setFee] = useState('1500');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setStream('UG');
    setDuration('4');
    setSeats('60');
    setFee('1500');
    setErrors({});
    setFormError('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');

    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = 'Give the course a full name.';
    if (Number(seats) < 1) next.seats = 'Seats must be at least 1.';
    if (Number(fee) < 1) next.fee = 'The application fee must be at least 1 rupee.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await api.post('/college/courses', {
        course_name: name.trim(),
        stream,
        duration_years: Number(duration) || null,
        seats: Number(seats),
        // Students are quoted in rupees; the API stores paise.
        application_fee: Math.round(Number(fee) * 100),
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not add the course.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add a course
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5"
      noValidate
    >
      <h2 className="text-sm font-medium">Add a course</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Course name" error={errors.name} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="B.Tech Computer Science"
              />
            )}
          </Field>
        </div>

        <Field label="Stream" required>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={stream}
              onChange={(event) => setStream(event.target.value as Stream)}
            >
              <option value="UG">Undergraduate</option>
              <option value="PG">Postgraduate</option>
            </Select>
          )}
        </Field>

        <Field label="Duration in years">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={1}
              max={7}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            />
          )}
        </Field>

        <Field label="Seats" error={errors.seats} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={1}
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Application fee"
          hint="In rupees. This is what a student pays to apply."
          error={errors.fee}
          required
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              min={1}
              value={fee}
              onChange={(event) => setFee(event.target.value)}
            />
          )}
        </Field>
      </div>

      {formError && (
        <div className="mt-4">
          <ErrorState message={formError} />
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <Button type="submit" loading={busy}>
          Add course
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
