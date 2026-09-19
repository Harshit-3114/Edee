'use client';

import { Fragment, useCallback, useEffect, useState, useRef } from 'react';
import { ChalkboardTeacher } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate, formatFee, formatPhone } from '@/lib/format';

interface Centre {
  id: string;
  name: string;
  city: string;
  state: string;
  contact_email: string;
  contact_phone: string;
  student_count: number;
  /** Paise charged per submitted lead. */
  amount_per_lead: number;
  /** Paise of payments and waivers extended. */
  credit_paise: number;
  active: boolean;
  created_at: string;
}

/**
 * The interactive half of this page.
 *
 * `initialCentres` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function AdminCoachingClient({
  initialCentres,
}: {
  initialCentres: Centre[] | null;
}) {
  const [centres, setCentres] = useState<Centre[]>(initialCentres ?? []);
  const [loading, setLoading] = useState(initialCentres === null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rate, setRate] = useState('0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [termsId, setTermsId] = useState<string | null>(null);
  const [termsRate, setTermsRate] = useState('');
  const [termsCredit, setTermsCredit] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Centre[]>('/admin/coaching-centres');
      setCentres(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load coaching centres.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialCentres !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();

    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = 'Enter the centre name.';
    if (!city.trim()) next.city = 'City is required.';
    if (!state.trim()) next.state = 'State is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = 'Enter a valid email.';
    if (Number(rate) < 0) next.rate = 'The per-lead rate cannot be negative.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await api.post('/admin/coaching-centres', {
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        contact_email: email.trim().toLowerCase(),
        contact_phone: phone.replace(/\D/g, '').slice(-10),
        // Rupees in the field, paise on the wire - the same convention as
        // course fees everywhere else.
        amount_per_lead: Math.round(Number(rate || 0) * 100),
      });
      setName('');
      setCity('');
      setState('');
      setEmail('');
      setPhone('');
      setRate('0');
      setOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the centre.'));
    } finally {
      setSaving(false);
    }
  }

  function openTerms(centre: Centre) {
    setTermsId(centre.id);
    setTermsRate(String(Math.round(centre.amount_per_lead / 100)));
    setTermsCredit(String(Math.round(centre.credit_paise / 100)));
  }

  async function saveTerms(event: React.FormEvent) {
    event.preventDefault();
    if (!termsId) return;
    setBusyId(termsId);
    try {
      await api.patch(`/admin/coaching-centres/${termsId}`, {
        amount_per_lead: Math.round(Number(termsRate || 0) * 100),
        credit_paise: Math.round(Number(termsCredit || 0) * 100),
      });
      setTermsId(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the commercial terms.'));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(centre: Centre) {
    setBusyId(centre.id);
    try {
      await api.patch(`/admin/coaching-centres/${centre.id}`, { active: !centre.active });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the centre.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Coaching centres"
        description="Create a centre first, then create the staff account that signs in to it."
        action={
          !open ? (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Add a centre
            </Button>
          ) : undefined
        }
      />

      {open && (
        <form
          onSubmit={create}
          className="mb-5 rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5"
          noValidate
        >
          <h2 className="text-sm font-medium">Add a coaching centre</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Centre name" error={errors.name} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Pragati Career Academy"
                  />
                )}
              </Field>
            </div>

            <Field label="City" error={errors.city} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Pune"
                />
              )}
            </Field>

            <Field label="State" error={errors.state} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  placeholder="Maharashtra"
                />
              )}
            </Field>

            <Field label="Contact email" error={errors.email} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              )}
            </Field>

            <Field label="Contact phone">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                />
              )}
            </Field>

            <Field
              label="Per-lead rate"
              hint="Rupees charged per submitted lead. Zero means terms are not set yet."
              error={errors.rate}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={0}
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button type="submit" loading={saving}>
              Add centre
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading && <LoadingList rows={4} columns={5} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && centres.length === 0 && (
        <EmptyState
          icon={<ChalkboardTeacher size={26} />}
          title="No coaching centres"
          body="Add a centre, then create its staff account under Users and roles."
        />
      )}

      {!loading && !error && centres.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Coaching centres on the platform</caption>
            <thead>
              <tr>
                <Th>Centre</Th>
                <Th>Location</Th>
                <Th>Contact</Th>
                <Th numeric>Students</Th>
                <Th numeric>Per lead</Th>
                <Th numeric>Credit</Th>
                <Th>Added</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {centres.map((centre) => (
                <Fragment key={centre.id}>
                  <Tr>
                    <Td>
                      <span className="font-medium">{centre.name}</span>
                      {!centre.active && (
                        <span className="ml-2">
                          <Badge>Inactive</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      {centre.city}, {centre.state}
                    </Td>
                    <Td>
                      <span className="text-[13px]">{centre.contact_email}</span>
                      <br />
                      <span className="tabular text-[13px] text-[var(--text-secondary)]">
                        {formatPhone(centre.contact_phone)}
                      </span>
                    </Td>
                    <Td numeric>{centre.student_count}</Td>
                    <Td numeric>{formatFee(centre.amount_per_lead)}</Td>
                    <Td numeric>{formatFee(centre.credit_paise)}</Td>
                    <Td>{formatDate(centre.created_at)}</Td>
                    <Td>
                      <span className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            termsId === centre.id ? setTermsId(null) : openTerms(centre)
                          }
                        >
                          Terms
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busyId === centre.id}
                          onClick={() => void toggleActive(centre)}
                        >
                          {centre.active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </span>
                    </Td>
                  </Tr>
                  {termsId === centre.id && (
                    <Tr key={`${centre.id}-terms`}>
                      <Td colSpan={8}>
                        <form
                          onSubmit={saveTerms}
                          className="flex flex-wrap items-end gap-3 py-1"
                        >
                          <Field label="Per-lead rate (rupees)">
                            {(fieldProps) => (
                              <Input
                                {...fieldProps}
                                type="number"
                                min={0}
                                value={termsRate}
                                onChange={(event) => setTermsRate(event.target.value)}
                              />
                            )}
                          </Field>
                          <Field label="Credit extended (rupees)">
                            {(fieldProps) => (
                              <Input
                                {...fieldProps}
                                type="number"
                                min={0}
                                value={termsCredit}
                                onChange={(event) => setTermsCredit(event.target.value)}
                              />
                            )}
                          </Field>
                          <Button
                            type="submit"
                            size="sm"
                            loading={busyId === centre.id}
                          >
                            Save terms
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setTermsId(null)}
                          >
                            Cancel
                          </Button>
                        </form>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

export type InitialData = Centre[];
