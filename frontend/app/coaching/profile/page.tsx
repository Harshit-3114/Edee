'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';

interface CentreProfile {
  name: string;
  city: string;
  state: string;
  contact_email: string;
  contact_phone: string;
}

export default function CoachingProfilePage() {
  const [profile, setProfile] = useState<CentreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CentreProfile>('/coaching/profile');
      setProfile(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your centre profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update(key: keyof CentreProfile, value: string) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError('');
    try {
      await api.patch('/coaching/profile', {
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone,
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
        title="Centre profile"
        description="Contact details the platform team uses to reach you."
      />

      {loading && <LoadingList rows={4} columns={2} />}

      {!loading && error && !profile && (
        <ErrorState message={error} onRetry={() => void load()} />
      )}

      {!loading && profile && (
        <form
          onSubmit={submit}
          className="flex max-w-md flex-col gap-5 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5"
          noValidate
        >
          <Field label="Centre name" hint="Contact the platform team to change this.">
            {(fieldProps) => <Input {...fieldProps} value={profile.name} readOnly disabled />}
          </Field>

          <Field label="City">
            {(fieldProps) => <Input {...fieldProps} value={profile.city} readOnly disabled />}
          </Field>

          <Field label="Contact email" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                value={profile.contact_email}
                onChange={(event) => update('contact_email', event.target.value)}
              />
            )}
          </Field>

          <Field label="Contact phone" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="tel"
                inputMode="numeric"
                value={profile.contact_phone}
                onChange={(event) => update('contact_phone', event.target.value)}
              />
            )}
          </Field>

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
