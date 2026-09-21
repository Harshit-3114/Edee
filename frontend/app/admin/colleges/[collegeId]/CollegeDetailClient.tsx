'use client';

import { Fragment, useCallback, useEffect, useState, useRef } from 'react';
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
import { apiFileUrl, formatDate, formatFee } from '@/lib/format';
import { PORTAL_LABEL } from '@/lib/portals';
import type { AdminCollegeDetail, CollegeFaq, CollegeType, Stream } from '@/lib/types';

/**
 * FAQs as the admin edits them: one `Question | Answer` per line, the same
 * one-per-line pattern as the gallery field.
 */
function faqsToText(faqs?: CollegeFaq[] | null): string {
  return (faqs ?? []).map((f) => `${f.question} | ${f.answer}`).join('\n');
}

function parseFaqText(text: string): { faqs: CollegeFaq[]; error: string | null } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const faqs: CollegeFaq[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const sep = lines[i].indexOf('|');
    if (sep < 0) {
      return { faqs: [], error: `FAQ line ${i + 1} needs a " | " between question and answer.` };
    }
    const question = lines[i].slice(0, sep).trim();
    const answer = lines[i].slice(sep + 1).trim();
    if (!question || !answer) {
      return { faqs: [], error: `FAQ line ${i + 1} needs both a question and an answer.` };
    }
    if (question.length > 300 || answer.length > 2000) {
      return { faqs: [], error: `FAQ line ${i + 1} is too long.` };
    }
    faqs.push({ question, answer });
  }
  if (faqs.length > 20) {
    return { faqs: [], error: 'Keep at most 20 FAQs.' };
  }
  return { faqs, error: null };
}

/**
 * `initialCollege` is the record the server already fetched with the session cookie.
 * Null means it could not - no session, or the record is gone - and this loads
 * it on mount, showing its own not-found or error state as it always did.
 */
export default function CollegeDetailClient({
  id,
  initialCollege,
}: {
  id: string;
  initialCollege?: AdminCollegeDetail | null;
}) {
  const [college, setCollege] = useState<AdminCollegeDetail | null>(initialCollege ?? null);
  const [loading, setLoading] = useState(!initialCollege);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [newCourse, setNewCourse] = useState({
    name: '',
    stream: 'UG' as Stream,
    duration: '3',
    seats: '60',
    fee: '1500',
    start: '',
    closing: '',
    intake: '',
  });
  // FAQs are edited as raw text and parsed on save, so a half-typed line is
  // never silently dropped the way parse-on-change would.
  const [faqText, setFaqText] = useState(() => faqsToText(initialCollege?.faqs));
  const faqInitFor = useRef<string | null>(initialCollege?.id ?? null);
  useEffect(() => {
    if (college && faqInitFor.current !== college.id) {
      faqInitFor.current = college.id;
      setFaqText(faqsToText(college.faqs));
    }
  }, [college]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    seats: '',
    fee: '',
    start: '',
    closing: '',
    intake: '',
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Only when the server could not supply it.
  const served = useRef(Boolean(initialCollege));
  useEffect(() => {
    if (served.current) return;
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
    const parsedFaqs = parseFaqText(faqText);
    if (parsedFaqs.error) next.faqs = parsedFaqs.error;
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
        application_phases: college.application_phases?.trim() || null,
        video_url: college.video_url?.trim() || null,
        overview: college.overview?.trim() || null,
        faqs: parsedFaqs.faqs,
      });
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the college.'));
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: React.FormEvent) {
    event.preventDefault();
    if (!college || !logoFile) return;
    setLogoBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', logoFile);
      const { data } = await api.post<{ logo_url: string }>(
        `/admin/colleges/${college.id}/logo`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      update('logo_url', data.logo_url);
      setLogoFile(null);
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not upload the logo.'));
    } finally {
      setLogoBusy(false);
    }
  }

  function startEdit(courseId: string) {
    const course = college?.courses?.find((c) => c.id === courseId);
    if (!course) return;
    setEditFields({
      seats: String(course.seats ?? ''),
      fee: String(Math.round(course.application_fee / 100)),
      start: course.application_start_date?.slice(0, 10) ?? '',
      closing: course.closing_date?.slice(0, 10) ?? '',
      intake: course.intake_info ?? '',
    });
    setEditingId(courseId);
    setCourseError('');
  }

  async function saveCourse(event: React.FormEvent, courseId: string) {
    event.preventDefault();
    if (editFields.start && editFields.closing && editFields.start > editFields.closing) {
      setCourseError('Applications cannot open after they close.');
      return;
    }
    setCourseBusy(true);
    setCourseError('');
    try {
      await api.patch(`/admin/colleges/${id}/courses/${courseId}`, {
        seats: Number(editFields.seats),
        application_fee: Math.round(Number(editFields.fee) * 100),
        application_start_date: editFields.start || null,
        intake_info: editFields.intake.trim() || null,
        closing_date: editFields.closing || null,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setCourseError(apiErrorMessage(err, 'Could not save the course.'));
    } finally {
      setCourseBusy(false);
    }
  }

  async function addCourse(event: React.FormEvent) {
    event.preventDefault();
    if (newCourse.name.trim().length < 3) {
      setCourseError('Give the course a full name.');
      return;
    }
    if (newCourse.start && newCourse.closing && newCourse.start > newCourse.closing) {
      setCourseError('Applications cannot open after they close.');
      return;
    }
    setCourseBusy(true);
    setCourseError('');
    try {
      await api.post(`/admin/colleges/${id}/courses`, {
        course_name: newCourse.name.trim(),
        stream: newCourse.stream,
        duration_years: Number(newCourse.duration) || null,
        seats: Number(newCourse.seats),
        application_fee: Math.round(Number(newCourse.fee) * 100),
        application_start_date: newCourse.start || null,
        intake_info: newCourse.intake.trim() || null,
        closing_date: newCourse.closing || null,
      });
      setNewCourse({
        name: '',
        stream: 'UG',
        duration: '3',
        seats: '60',
        fee: '1500',
        start: '',
        closing: '',
        intake: '',
      });
      setShowAddCourse(false);
      await load();
    } catch (err) {
      setCourseError(apiErrorMessage(err, 'Could not add the course.'));
    } finally {
      setCourseBusy(false);
    }
  }

  async function deleteCourse(courseId: string) {
    setCourseBusy(true);
    setCourseError('');
    try {
      await api.delete(`/admin/colleges/${id}/courses/${courseId}`);
      setDeletingId(null);
      await load();
    } catch (err) {
      setCourseError(apiErrorMessage(err, 'Could not delete the course.'));
      setDeletingId(null);
    } finally {
      setCourseBusy(false);
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

            <Field
              label="Application phases"
              hint="Free text, shown on the public landing page. e.g. Phase 1: Jun–Jul; Phase 2: Aug."
            >
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={college.application_phases ?? ''}
                  onChange={(event) => update('application_phases', event.target.value)}
                />
              )}
            </Field>

            <Field
              label="Campus video URL"
              hint="YouTube link, embedded on the public landing page."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="url"
                  value={college.video_url ?? ''}
                  onChange={(event) => update('video_url', event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              )}
            </Field>

            <Field
              label="Overview"
              hint="Long-form description, shown above the short text on the public landing page."
            >
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={college.overview ?? ''}
                  onChange={(event) => update('overview', event.target.value)}
                />
              )}
            </Field>

            <Field
              label="FAQs"
              hint='One per line as "Question | Answer". Shown on the public landing page.'
              error={errors.faqs}
            >
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  value={faqText}
                  onChange={(event) => setFaqText(event.target.value)}
                  rows={4}
                  placeholder="What streams are offered? | UG and PG programs…"
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

        <Panel
          title="College logo"
          action={
            apiFileUrl(college.logo_url) ? (
              // unoptimized: same-origin API file, no remote-pattern config needed.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={apiFileUrl(college.logo_url) as string}
                alt={`${college.name} logo`}
                className="h-12 w-auto object-contain"
              />
            ) : undefined
          }
        >
          <form onSubmit={uploadLogo} className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              aria-label="College logo file"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            />
            <Button type="submit" loading={logoBusy} disabled={!logoFile}>
              Upload logo
            </Button>
            <span className="text-[13px] text-[var(--text-secondary)]">
              PNG, JPG or WebP under 2 MB. Shown on the public landing page.
            </span>
          </form>
        </Panel>

        <Panel
          title="Courses"
          action={
            !showAddCourse ? (
              <Button variant="secondary" size="sm" onClick={() => setShowAddCourse(true)}>
                Add a course
              </Button>
            ) : undefined
          }
        >
          {courseError && (
            <div className="mb-4">
              <ErrorState message={courseError} />
            </div>
          )}

          {showAddCourse && (
            <form
              onSubmit={addCourse}
              className="mb-5 rounded-lg border border-[var(--line)] p-4"
              noValidate
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Course name" required>
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        value={newCourse.name}
                        onChange={(event) =>
                          setNewCourse({ ...newCourse, name: event.target.value })
                        }
                        placeholder="B.Tech Computer Science"
                      />
                    )}
                  </Field>
                </div>
                <Field label="Stream" required>
                  {(fieldProps) => (
                    <Select
                      {...fieldProps}
                      value={newCourse.stream}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, stream: event.target.value as Stream })
                      }
                    >
                      <option value="UG">Undergraduate</option>
                      <option value="PG">Postgraduate</option>
                    </Select>
                  )}
                </Field>
                <Field label="Duration in years">
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="number"
                      min={1}
                      max={7}
                      value={newCourse.duration}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, duration: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Seats" required>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="number"
                      min={1}
                      value={newCourse.seats}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, seats: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Application fee (rupees)" required>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="number"
                      min={1}
                      value={newCourse.fee}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, fee: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Applications open">
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="date"
                      value={newCourse.start}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, start: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Application deadline">
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="date"
                      value={newCourse.closing}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, closing: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Intake">
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      value={newCourse.intake}
                      maxLength={200}
                      onChange={(event) =>
                        setNewCourse({ ...newCourse, intake: event.target.value })
                      }
                      placeholder="Fall 2027"
                    />
                  )}
                </Field>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button type="submit" loading={courseBusy}>
                  Add course
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAddCourse(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {!college.courses || college.courses.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              No courses listed. Add the first one above.
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
                    <Th>Window</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {college.courses.map((course) => (
                    <Fragment key={course.id}>
                      <Tr>
                        <Td>
                          <span className="font-medium">{course.course_name}</span>
                        </Td>
                        <Td>{course.stream}</Td>
                        <Td numeric>{course.seats ?? '-'}</Td>
                        <Td numeric>{formatFee(course.application_fee)}</Td>
                        <Td>
                          {course.application_start_date
                            ? formatDate(course.application_start_date)
                            : 'Open'}
                          {' → '}
                          {course.closing_date ? formatDate(course.closing_date) : '—'}
                        </Td>
                        <Td>
                          <Badge tone={course.active ? 'success' : 'neutral'}>
                            {course.active ? 'Open' : 'Closed'}
                          </Badge>
                        </Td>
                        <Td>
                          <span className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editingId === course.id
                                  ? setEditingId(null)
                                  : startEdit(course.id)
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(course.id)}
                            >
                              Delete
                            </Button>
                          </span>
                        </Td>
                      </Tr>
                      {editingId === course.id && (
                        <Tr key={`${course.id}-edit`}>
                          <Td colSpan={7}>
                            <form
                              onSubmit={(event) => void saveCourse(event, course.id)}
                              className="flex flex-wrap items-end gap-3 py-1"
                            >
                              <Field label="Seats">
                                {(fieldProps) => (
                                  <Input
                                    {...fieldProps}
                                    type="number"
                                    min={1}
                                    value={editFields.seats}
                                    onChange={(event) =>
                                      setEditFields({ ...editFields, seats: event.target.value })
                                    }
                                  />
                                )}
                              </Field>
                              <Field label="Fee (rupees)">
                                {(fieldProps) => (
                                  <Input
                                    {...fieldProps}
                                    type="number"
                                    min={1}
                                    value={editFields.fee}
                                    onChange={(event) =>
                                      setEditFields({ ...editFields, fee: event.target.value })
                                    }
                                  />
                                )}
                              </Field>
                              <Field label="Opens">
                                {(fieldProps) => (
                                  <Input
                                    {...fieldProps}
                                    type="date"
                                    value={editFields.start}
                                    onChange={(event) =>
                                      setEditFields({ ...editFields, start: event.target.value })
                                    }
                                  />
                                )}
                              </Field>
                              <Field label="Deadline">
                                {(fieldProps) => (
                                  <Input
                                    {...fieldProps}
                                    type="date"
                                    value={editFields.closing}
                                    onChange={(event) =>
                                      setEditFields({ ...editFields, closing: event.target.value })
                                    }
                                  />
                                )}
                              </Field>
                              <Field label="Intake">
                                {(fieldProps) => (
                                  <Input
                                    {...fieldProps}
                                    value={editFields.intake}
                                    maxLength={200}
                                    onChange={(event) =>
                                      setEditFields({ ...editFields, intake: event.target.value })
                                    }
                                  />
                                )}
                              </Field>
                              <Button type="submit" size="sm" loading={courseBusy}>
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </form>
                          </Td>
                        </Tr>
                      )}
                      {deletingId === course.id && (
                        <Tr key={`${course.id}-delete`}>
                          <Td colSpan={7}>
                            <p className="text-[13px]">
                              Delete {course.course_name} permanently? Only possible
                              when nothing references it - otherwise deactivate it
                              from the college portal instead.
                            </p>
                            <span className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                loading={courseBusy}
                                onClick={() => void deleteCourse(course.id)}
                              >
                                Delete permanently
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(null)}
                              >
                                Keep it
                              </Button>
                            </span>
                          </Td>
                        </Tr>
                      )}
                    </Fragment>
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

export type InitialData = AdminCollegeDetail;
