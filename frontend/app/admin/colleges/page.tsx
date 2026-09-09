'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Buildings } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import type { College, CollegeType } from '@/lib/types';

export default function AdminCollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [type, setType] = useState<CollegeType>('private');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<College[]>('/admin/colleges');
      setColleges(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load colleges.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();

    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = 'Enter the full college name.';
    if (!city.trim()) next.city = 'City is required.';
    if (!state.trim()) next.state = 'State is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await api.post('/admin/colleges', {
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        location: `${city.trim()}, ${state.trim()}`,
        type,
      });
      setName('');
      setCity('');
      setState('');
      setOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the college.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(college: College) {
    setBusyId(college.id);
    try {
      await api.patch(`/admin/colleges/${college.id}`, { active: !college.active });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the college.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Colleges"
        description="Deactivating a college hides it from student search. Existing applications are untouched."
        action={
          !open ? (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Add a college
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
          <h2 className="text-sm font-medium">Add a college</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="College name" error={errors.name} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Veermata Jijabai Technological Institute"
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
                  placeholder="Mumbai"
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

            <Field label="Type" required>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={type}
                  onChange={(event) => setType(event.target.value as CollegeType)}
                >
                  <option value="government">Government</option>
                  <option value="private">Private</option>
                  <option value="deemed">Deemed</option>
                </Select>
              )}
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button type="submit" loading={saving}>
              Add college
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading && <LoadingList rows={5} columns={5} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && colleges.length === 0 && (
        <EmptyState
          icon={<Buildings size={26} />}
          title="No colleges yet"
          body="Add the first college, then create a staff account attached to it."
        />
      )}

      {!loading && !error && colleges.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Colleges on the platform</caption>
            <thead>
              <tr>
                <Th>College</Th>
                <Th>Location</Th>
                <Th>Type</Th>
                <Th numeric>Courses</Th>
                <Th>Status</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((college) => (
                <Tr key={college.id}>
                  <Td>
                    <Link
                      href={`/admin/colleges/${college.id}`}
                      className="font-medium underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--text-primary)]"
                    >
                      {college.name}
                    </Link>
                  </Td>
                  <Td>
                    {college.city}, {college.state}
                  </Td>
                  <Td>{college.type}</Td>
                  <Td numeric>{college.courses?.length ?? 0}</Td>
                  <Td>
                    <Badge tone={college.active ? 'success' : 'neutral'}>
                      {college.active ? 'Listed' : 'Hidden'}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busyId === college.id}
                      onClick={() => void toggleActive(college)}
                    >
                      {college.active ? 'Hide' : 'List'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
