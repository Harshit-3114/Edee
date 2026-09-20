'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { PORTAL_LABEL, STAFF_ROLES, type Role } from '@/lib/portals';

interface Org {
  id: string;
  name: string;
}

/**
 * The only screen in the product that grants access.
 *
 * College and coaching accounts are issued as a single-use set-password link.
 * Nothing exists until the recipient opens it and chooses a password, so an
 * invite sent to the wrong address cannot become an account by itself. The
 * link is shown here as well as emailed, because outbound mail is best-effort
 * and an admin should never be stuck waiting on it.
 *
 * Admin accounts still go through Firebase, unchanged - there is no invite
 * path to platform staff on purpose.
 *
 * The role and its organisation are chosen together because the database
 * rejects a college account with no college attached.
 */
export default function UserRoleForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('college');
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const needsOrg = role === 'college' || role === 'coaching';
  // Everything but admin is provisioned by invite.
  const byInvite = needsOrg;

  useEffect(() => {
    if (!needsOrg) {
      setOrgs([]);
      setOrgId('');
      return;
    }

    let cancelled = false;
    setOrgsLoading(true);
    const path = role === 'college' ? '/admin/colleges' : '/admin/coaching-centres';

    api
      .get<Org[]>(path)
      .then(({ data }) => {
        if (!cancelled) setOrgs(data);
      })
      .catch(() => {
        if (!cancelled) setFormError('Could not load the list to attach this account to.');
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [role, needsOrg]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');
    setInviteUrl('');
    setCopied(false);

    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter the person’s full name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = 'Enter a valid work email.';
    if (needsOrg && !orgId) {
      next.org = `Choose the ${role === 'college' ? 'college' : 'centre'} this account belongs to.`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      if (byInvite) {
        const { data } = await api.post('/auth/invites', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          college_id: role === 'college' ? orgId : null,
          coaching_centre_id: role === 'coaching' ? orgId : null,
        });
        setInviteUrl(data.url);
      } else {
        await api.post('/admin/users', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          college_id: null,
          coaching_centre_id: null,
        });
      }
      setName('');
      setEmail('');
      setOrgId('');
      onCreated();
    } catch (err) {
      setFormError(
        apiErrorMessage(
          err,
          byInvite ? 'Could not create the invite.' : 'Could not create the account.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright. The link is on screen and
      // selectable, so there is still a way to hand it over.
      setCopied(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5"
      noValidate
    >
      <h2 className="text-sm font-medium">Create a staff account</h2>
      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
        {byInvite
          ? 'They get a one-time link to choose their own password. The account exists once they use it.'
          : 'The person signs in with this email.'}{' '}
        Students sign themselves up and are not created here.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              placeholder="Priya Nair"
            />
          )}
        </Field>

        <Field label="Work email" error={errors.email} required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              placeholder="priya@college.edu.in"
            />
          )}
        </Field>

        <Field label="Role" required>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {STAFF_ROLES.map((value) => (
                <option key={value} value={value}>
                  {PORTAL_LABEL[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {needsOrg && (
          <Field
            label={role === 'college' ? 'College' : 'Coaching centre'}
            error={errors.org}
            required
          >
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={orgId}
                disabled={orgsLoading}
                onChange={(event) => setOrgId(event.target.value)}
              >
                <option value="">
                  {orgsLoading ? 'Loading' : `Choose a ${role === 'college' ? 'college' : 'centre'}`}
                </option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>

      {formError && (
        <div className="mt-4">
          <ErrorState message={formError} />
        </div>
      )}

      {inviteUrl && (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface-sunken)] p-4">
          <p className="text-[13px] font-medium">Invite link</p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Emailed to them as well. It works once, and this is the only time it is
            shown — reissue if it gets lost.
          </p>
          <code className="mt-3 block break-all rounded border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-[12px]">
            {inviteUrl}
          </code>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={copyInvite}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <Button type="submit" loading={busy}>
          {byInvite ? 'Send invite' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}
