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
 * Whether the dev bypass replaces the real sign-in forms. True when the
 * backend runs in dev mode (or Firebase was never configured): phone OTP
 * and Google would only print "not configured" errors there.
 */
export function useDevBypass(): boolean | null {
  const [dev, setDev] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value =
        isDevModeForced() || !isFirebaseConfigured() || (await fetchBackendDevMode());
      if (!cancelled) setDev(value);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return dev;
}

/**
 * Developer quick sign-in. Rendered INSTEAD of the phone/Google forms when
 * the backend runs in dev mode: it mints a local dev: token for the portal
 * role picked above, no Firebase involved. Hidden everywhere else — in
 * production this component renders nothing at all.
 */
export default function DevSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [orgId, setOrgId] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The role comes from the shared portal picker above (?portal=). There is
  // deliberately no second picker here: one choice, one button.
  const picked = params.get('portal');
  const role: Role = isRole(picked) ? picked : 'student';

  const devBypass = useDevBypass();

  const needsOrg = role === 'college' || role === 'coaching';
  const orgOptions =
    role === 'college'
      ? (directory?.colleges ?? []).map((c) => ({ id: c.id, name: `${c.name} (${c.slug})` }))
      : (directory?.coaching_centres ?? []).map((c) => ({ id: c.id, name: c.name }));

  useEffect(() => {
    if (!devBypass) return;
    let cancelled = false;
    (async () => {
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
  }, [devBypass]);

  if (devBypass !== true) {
    return null;
  }

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
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
  );
}
