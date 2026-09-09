'use client';

import { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/shells/PageHeader';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';

interface CollegeProfile {
  name: string;
  location: string;
  city: string;
  state: string;
  type: string;
}

export default function CollegeProfilePage() {
  const [profile, setProfile] = useState<CollegeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CollegeProfile>('/college/profile');
      setProfile(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your college profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError('');
    try {
      await api.patch('/college/profile', {
        location: profile.location,
        city: profile.city,
        state: profile.state,
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit your changes.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="College profile"
        description="Changes here go to the platform team for approval before students see them. Your name and type are set by the platform."
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
          <Field label="College name" hint="Contact the platform team to change this.">
            {(fieldProps) => <Input {...fieldProps} value={profile.name} readOnly disabled />}
          </Field>

          <Field label="Address">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={profile.location}
                onChange={(event) => {
                  setProfile({ ...profile, location: event.target.value });
                  setSubmitted(false);
                }}
              />
            )}
          </Field>

          <Field label="City" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={profile.city}
                onChange={(event) => {
                  setProfile({ ...profile, city: event.target.value });
                  setSubmitted(false);
                }}
              />
            )}
          </Field>

          <Field label="State" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={profile.state}
                onChange={(event) => {
                  setProfile({ ...profile, state: event.target.value });
                  setSubmitted(false);
                }}
              />
            )}
          </Field>

          {error && <ErrorState message={error} />}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              Submit for approval
            </Button>
            {submitted && (
              <p role="status" className="text-[13px] text-[var(--accent-text)]">
                Sent for approval
              </p>
            )}
          </div>
        </form>
      )}
    </>
  );
}
