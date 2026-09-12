'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut as fbSignOut } from 'firebase/auth';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import api from '@/lib/api';
import {
  fetchBackendDevMode,
  isDevModeForced,
  setDevToken,
} from '@/lib/devSession';
import { isFirebaseConfigured, tryGetFirebaseAuth } from '@/lib/firebase';
import { PORTAL_HOME, PORTAL_LABEL, isRole, type Role } from '@/lib/portals';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Directory {
  colleges: { id: string; name: string; slug: string }[];
  coaching_centres: { id: string; name: string }[];
}

/**
 * Developer quick sign-in. Shown only when the backend runs in dev mode (or
 * the frontend forces it): it mints a local dev: token for the picked role,
 * no Firebase involved. Hidden everywhere else — in production this
 * component renders nothing at all.
 */
export default function DevSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [visible, setVisible] = useState<boolean | null>(null);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [role, setRole] = useState<Role>('student');
  const [label, setLabel] = useState('');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const picked = params.get('portal');
    if (isRole(picked)) setRole(picked);
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dev =
        isDevModeForced() || !isFirebaseConfigured() || (await fetchBackendDevMode());
      if (cancelled) return;
      setVisible(dev);
      if (!dev) return;
      // Organisation picker for staff roles. Fails silently on purpose: a
      // typed UUID or college slug below always works without it.
      try {
        const { data } = await api.get<Directory>('/dev/directory');
        if (!cancelled) setDirectory(data);
      } catch {
        /* manual entry remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const needsOrg = role === 'college' || role === 'coaching';
  const orgOptions =
    role === 'college'
      ? (directory?.colleges ?? []).map((c) => ({ id: c.id, name: `${c.name} (${c.slug})` }))
      : (directory?.coaching_centres ?? []).map((c) => ({ id: c.id, name: c.name }));

  async function resolveOrg(input: string): Promise<string | null> {
    const value = input.trim();
    if (!value) return null;
    if (UUID_RE.test(value)) return value;
    if (role !== 'college') return null;
    // Accept a college slug as well as a UUID; the lookup is public.
    try {
      const { data } = await api.get<{ id: string }>(
        `/colleges/by-slug/${encodeURIComponent(value.toLowerCase())}`,
      );
      return data.id;
    } catch {
      return null;
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      let scope = '';
      if (needsOrg) {
        const resolved = await resolveOrg(orgId);
        if (!resolved) {
          setError(
            role === 'college'
              ? 'Pick a college above, or enter its ID or slug.'
              : 'Pick a centre above, or enter its ID.',
          );
          return;
        }
        scope = resolved;
      }

      const tag = label.trim();
      const token =
        needsOrg || !tag ? `dev:${role}${scope ? `:${scope}` : ''}` : `dev:${role}:${tag}`;

      // A real Firebase session must not shadow the dev identity (the API
      // prefers it), so leave it first. Best effort: dev continues regardless.
      try {
        const auth = tryGetFirebaseAuth();
        if (auth?.currentUser) await fbSignOut(auth);
      } catch {
        /* dev continues regardless */
      }

      const claims = setDevToken(token);
      if (!claims) {
        setError('Could not build a dev token.');
        return;
      }
      router.replace(PORTAL_HOME[claims.role]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Developer sign-in"
      className="rounded-lg border border-dashed border-[var(--line-strong)] p-4"
    >
      <h2 className="text-sm font-medium">Developer quick sign-in</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        The backend is in dev mode: pick a role and any values work, no Firebase
        needed. Never enabled in production.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
        <div role="group" aria-label="Dev role" className="grid grid-cols-2 gap-2">
          {(['student', 'college', 'coaching', 'admin'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === role}
              onClick={() => {
                setRole(option);
                setError('');
              }}
              className={[
                'rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors duration-150',
                option === role
                  ? 'border-[var(--accent-line)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--line)] bg-[var(--surface-raised)] hover:bg-[var(--surface-hover)]',
              ].join(' ')}
            >
              {PORTAL_LABEL[option]}
            </button>
          ))}
        </div>

        {needsOrg &&
          (orgOptions.length > 0 ? (
            <Field label={role === 'college' ? 'College' : 'Coaching centre'} required>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={orgId}
                  onChange={(event) => setOrgId(event.target.value)}
                >
                  <option value="">Choose one</option>
                  {orgOptions.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <Field
              label={role === 'college' ? 'College ID or slug' : 'Coaching centre ID'}
              required
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={orgId}
                  onChange={(event) => setOrgId(event.target.value)}
                  autoComplete="off"
                  placeholder={role === 'college' ? 'fergusson-college' : 'Centre UUID'}
                />
              )}
            </Field>
          ))}

        {!needsOrg && (
          <Field
            label="Label (optional)"
            hint="Makes you a different person: dev:student:alice vs dev:student:bob."
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                autoComplete="off"
                placeholder="alice"
              />
            )}
          </Field>
        )}

        {error && <ErrorState message={error} />}

        <Button type="submit" loading={busy}>
          Sign in as {PORTAL_LABEL[role]}
        </Button>
      </form>
    </section>
  );
}
