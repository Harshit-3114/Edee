'use client';

import { useCallback, useEffect, useState } from 'react';
import { Buildings } from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import BackLink from '@/components/ui/BackLink';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input, Select, Textarea } from '@/components/ui/Input';
import LinkButton from '@/components/ui/LinkButton';
import { DetailItem, DetailList, Panel } from '@/components/ui/DetailList';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate, formatFee } from '@/lib/format';
import { PORTAL_LABEL } from '@/lib/portals';
import type { AdminCollegeDetail, CollegeType } from '@/lib/types';

export default function CollegeDetailClient({ id }: { id: string }) {
  const [college, setCollege] = useState<AdminCollegeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminCollegeDetail>(`/admin/colleges/${id}`);
      setCollege(data);
      setError('');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) setMissing(true);
      else setError(apiErrorMessage(err, 'Could not load this college.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof AdminCollegeDetail>(
    key: K,
    value: AdminCollegeDetail[K],
  ) {
    setCollege((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!college) return;

    const next: Record<string, string> = {};
    if (college.name.trim().length < 3) next.name = 'Enter the full college name.';
    if (!college.city.trim()) next.city = 'City is required.';
    if (!college.state.trim()) next.state = 'State is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setError('');
    try {
      await api.patch(`/admin/colleges/${college.id}`, {
        name: college.name.trim(),
        location: college.location.trim(),
        city: college.city.trim(),
        state: college.state.trim(),
        type: college.type,
        active: college.active,
        landing_hero_image_url: college.landing_hero_image_url?.trim() || null,
        landing_description: college.landing_description?.trim() || null,
        landing_gallery_urls: college.landing_gallery_urls ?? null,
      });
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the college.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading the college</span>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-6 h-28 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  if (missing) {
    return (
      <>
        <BackLink href="/admin/colleges" label="All colleges" />
        <EmptyState
          icon={<Buildings size={26} />}
          title="College not found"
          body="This college may have been removed, or the link may be out of date."
          action={<LinkButton href="/admin/colleges">Back to colleges</LinkButton>}
        />
      </>
    );
  }

  if (error && !college) {
    return (
      <>
        <BackLink href="/admin/colleges" label="All colleges" />
        <ErrorState message={error} onRetry={() => void load()} />
      </>
    );
  }

  if (!college) return null;

  const activeCourses = college.courses?.filter((course) => course.active) ?? [];

  return (
    <>
      <BackLink href="/admin/colleges" label="All colleges" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{college.name}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {college.city}, {college.state}
          </p>
        </div>
        <Badge tone={college.active ? 'success' : 'neutral'}>
          {college.active ? 'Listed' : 'Hidden'}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        <StatRow>
          <StatTile
            label="Courses"
            value={String(college.courses?.length ?? 0)}
            note={`${activeCourses.length} open`}
          />
          <StatTile
            label="Applications"
            value={college.application_count.toLocaleString('en-IN')}
          />
          <StatTile label="Fees collected" value={formatFee(college.fees_collected)} />
          <StatTile label="Staff accounts" value={String(college.staff?.length ?? 0)} />
        </StatRow>

        <Panel title="Listing details">
          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <Field label="College name" error={errors.name} required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={college.name}
                  onChange={(event) => update('name', event.target.value)}
                />
              )}
            </Field>

            <Field label="Address">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={college.location}
                  onChange={(event) => update('location', event.target.value)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City" error={errors.city} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={college.city}
                    onChange={(event) => update('city', event.target.value)}
                  />
                )}
              </Field>

              <Field label="State" error={errors.state} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={college.state}
                    onChange={(event) => update('state', event.target.value)}
                  />
                )}
              </Field>

              <Field label="Type" required>
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={college.type}
                    onChange={(event) => update('type', event.target.value as CollegeType)}
                  >
                    <option value="government">Government</option>
                    <option value="private">Private</option>
                    <option value="deemed">Deemed</option>
                  </Select>
                )}
              </Field>

              <Field
                label="Visibility"
                hint="Hiding a college removes it from student search. Existing applications are untouched."
              >
                {(fieldProps) => (
                  <Select
                    {...fieldProps}
                    value={college.active ? 'listed' : 'hidden'}
                    onChange={(event) => update('active', event.target.value === 'listed')}
                  >
                    <option value="listed">Listed</option>
                    <option value="hidden">Hidden</option>
                  </Select>
                )}
              </Field>
            </div>

            <Field
              label="Landing page hero image"
              hint="Public banner URL. The landing page needs no login to view."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="url"
                  value={college.landing_hero_image_url ?? ''}
                  onChange={(event) => update('landing_hero_image_url', event.target.value)}
                />
              )}
            </Field>

            <Field label="Landing page description">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={college.landing_description ?? ''}
                  onChange={(event) => update('landing_description', event.target.value)}
                />
              )}
            </Field>

            <Field label="Landing page gallery" hint="One image URL per line.">
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={(college.landing_gallery_urls ?? []).join('\n')}
                  onChange={(event) =>
                    update(
                      'landing_gallery_urls',
                      event.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0),
                    )
                  }
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
        </Panel>

        <Panel title="Courses">
          {!college.courses || college.courses.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              No courses listed. College staff add these from their own portal.
            </p>
          ) : (
            <TableWrap>
              <Table>
                <caption className="sr-only">Courses at {college.name}</caption>
                <thead>
                  <tr>
                    <Th>Course</Th>
                    <Th>Stream</Th>
                    <Th numeric>Seats</Th>
                    <Th numeric>Fee</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {college.courses.map((course) => (
                    <Tr key={course.id}>
                      <Td>
                        <span className="font-medium">{course.course_name}</span>
                      </Td>
                      <Td>{course.stream}</Td>
                      <Td numeric>{course.seats ?? '-'}</Td>
                      <Td numeric>{formatFee(course.application_fee)}</Td>
                      <Td>
                        <Badge tone={course.active ? 'success' : 'neutral'}>
                          {course.active ? 'Open' : 'Closed'}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>

        <Panel
          title="Staff"
          action={
            <LinkButton href="/admin/users" variant="ghost" size="sm">
              Manage accounts
            </LinkButton>
          }
        >
          {!college.staff || college.staff.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nobody can sign in for this college yet. Create an account under Users and
              roles and attach it here.
            </p>
          ) : (
            <DetailList>
              {college.staff.map((member) => (
                <DetailItem key={member.id} label={member.name}>
                  {member.email}
                  <span className="mt-1 block text-[13px] text-[var(--text-muted)]">
                    {PORTAL_LABEL[member.role]} · added {formatDate(member.created_at)}
                    {!member.active && ' · revoked'}
                  </span>
                </DetailItem>
              ))}
            </DetailList>
          )}
        </Panel>
      </div>
    </>
  );
}
