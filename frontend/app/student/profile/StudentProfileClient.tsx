'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { isValidIndianMobile } from '@/lib/format';
import type { Student, Stream } from '@/lib/types';

/**
 * The interactive half of this page.
 *
 * `initialStudent` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function StudentProfileClient({
  initialStudent,
}: {
  initialStudent: Student | null;
}) {
  const [student, setStudent] = useState<Student | null>(initialStudent ?? null);
  const [loading, setLoading] = useState(initialStudent === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Student>('/students/me');
      setStudent(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialStudent !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  function update<K extends keyof Student>(key: K, value: Student[K]) {
    setStudent((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!student) return;

    const next: Record<string, string> = {};
    if (student.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!isValidIndianMobile(student.phone)) next.phone = 'Enter a 10-digit mobile number.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setError('');
    try {
      await api.patch('/students/me', {
        name: student.name.trim(),
        phone: student.phone.replace(/\D/g, '').slice(-10),
        stream: student.stream,
      });
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save your changes.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Your profile"
        description="Colleges see this on every application. Keep the phone number current so they can reach you."
      />

      {loading && <LoadingList rows={4} columns={2} />}

      {!loading && error && !student && (
        <ErrorState message={error} onRetry={() => void load()} />
      )}

      {!loading && student && (
        <form
          onSubmit={submit}
          className="flex max-w-md flex-col gap-5 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5"
          noValidate
        >
          <Field label="Full name" error={errors.name} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={student.name}
                onChange={(event) => update('name', event.target.value)}
                autoComplete="name"
              />
            )}
          </Field>

          <Field
            label="Email address"
            hint="Set by how you signed in. Contact support to change it."
          >
            {(fieldProps) => (
              <Input {...fieldProps} value={student.email} readOnly disabled />
            )}
          </Field>

          <Field label="Mobile number" error={errors.phone} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={student.phone}
                onChange={(event) =>
                  update('phone', event.target.value.replace(/\D/g, ''))
                }
                autoComplete="tel-national"
              />
            )}
          </Field>

          <Field label="Applying for">
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={student.stream}
                onChange={(event) => update('stream', event.target.value as Stream)}
              >
                <option value="UG">Undergraduate</option>
                <option value="PG">Postgraduate</option>
              </Select>
            )}
          </Field>

          {student.coaching_centre_name && (
            <Field
              label="Referred by"
              hint="Set when you signed up. Only the platform team can change it."
            >
              {(fieldProps) => (
                <Input {...fieldProps} value={student.coaching_centre_name ?? ''} readOnly disabled />
              )}
            </Field>
          )}

          {error && <ErrorState message={error} />}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
            {saved && (
              <p role="status" className="text-[13px] text-[var(--accent-text)]">
                Saved
              </p>
            )}
          </div>
        </form>
      )}
    </>
  );
}

export type InitialData = Student;
