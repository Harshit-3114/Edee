'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
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
  landing_hero_image_url: string | null;
  landing_description: string | null;
  landing_gallery_urls: string[] | null;
}

/**
 * The interactive half of this page.
 *
 * `initialProfile` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function CollegeProfileClient({
  initialProfile,
}: {
  initialProfile: CollegeProfile | null;
}) {
  const [profile, setProfile] = useState<CollegeProfile | null>(initialProfile ?? null);
  const [loading, setLoading] = useState(initialProfile === null);
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

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialProfile !== null);
  useEffect(() => {
    if (served.current) return;
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
        landing_hero_image_url: profile.landing_hero_image_url || null,
        landing_description: profile.landing_description || null,
        landing_gallery_urls: profile.landing_gallery_urls,
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
          className="flex max-w-3xl flex-col gap-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-5 md:p-8"
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

          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>

          <Field
            label="Landing page hero image"
            hint="A public URL for the banner on your landing page."
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="url"
                value={profile.landing_hero_image_url ?? ''}
                onChange={(event) => {
                  setProfile({ ...profile, landing_hero_image_url: event.target.value });
                  setSubmitted(false);
                }}
                placeholder="https://…"
              />
            )}
          </Field>

          <Field label="Landing page description">
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={profile.landing_description ?? ''}
                onChange={(event) => {
                  setProfile({ ...profile, landing_description: event.target.value });
                  setSubmitted(false);
                }}
              />
            )}
          </Field>

          <Field
            label="Landing page gallery"
            hint="One image URL per line. Shown to every visitor."
          >
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                value={(profile.landing_gallery_urls ?? []).join('\n')}
                onChange={(event) => {
                  const urls = event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0);
                  setProfile({ ...profile, landing_gallery_urls: urls });
                  setSubmitted(false);
                }}
                placeholder={'https://…\nhttps://…'}
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

export type InitialData = CollegeProfile;
