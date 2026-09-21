'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { GraduationCap, Tray } from '@phosphor-icons/react';
import ApplicantTable from '@/components/college/ApplicantTable';
import Badge from '@/components/ui/Badge';
import BackLink from '@/components/ui/BackLink';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import LinkButton from '@/components/ui/LinkButton';
import { Panel } from '@/components/ui/DetailList';
import StatTile, { StatRow } from '@/components/ui/StatTile';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatFee } from '@/lib/format';
import type { CollegeCourseDetail } from '@/lib/types';

/** An ISO timestamp trims to the YYYY-MM-DD a date input expects. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

/**
 * `initialCourse` is the record the server already fetched with the session cookie.
 * Null means it could not - no session, or the record is gone - and this loads
 * it on mount, showing its own not-found or error state as it always did.
 */
export default function CourseDetailClient({
  id,
  initialCourse,
}: {
  id: string;
  initialCourse?: CollegeCourseDetail | null;
}) {
  const [course, setCourse] = useState<CollegeCourseDetail | null>(initialCourse ?? null);
  const [loading, setLoading] = useState(!initialCourse);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  const [seats, setSeats] = useState('');
  const [fee, setFee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [intake, setIntake] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CollegeCourseDetail>(`/college/courses/${id}`);
      setCourse(data);
      setSeats(String(data.seats ?? ''));
      // Fees are paise on the wire, rupees in the field a person types into.
      setFee(String(Math.round(data.application_fee / 100)));
      setStartDate(toDateInput(data.application_start_date));
      setClosingDate(toDateInput(data.closing_date));
      setIntake(data.intake_info ?? '');
      setError('');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) setMissing(true);
      else setError(apiErrorMessage(err, 'Could not load this course.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Only when the server could not supply it.
  const served = useRef(Boolean(initialCourse));
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!course) return;

    const next: Record<string, string> = {};
    if (Number(seats) < 1) next.seats = 'Seats must be at least 1.';
    if (Number(fee) < 1) next.fee = 'The application fee must be at least 1 rupee.';
    if (startDate && closingDate && startDate > closingDate) {
      next.window = 'Applications cannot open after they close.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setError('');
    try {
      await api.patch(`/college/courses/${course.id}`, {
        seats: Number(seats),
        application_fee: Math.round(Number(fee) * 100),
        application_start_date: startDate || null,
        intake_info: intake.trim() || null,
        closing_date: closingDate || null,
      });
      setSaved(true);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the course.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!course) return;
    setSaving(true);
    try {
      await api.patch(`/college/courses/${course.id}`, { active: !course.active });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the course.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading the course</span>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-6 h-28 w-full" />
        <Skeleton className="mt-4 h-56 w-full" />
      </div>
    );
  }

  if (missing) {
    return (
      <>
        <BackLink href="/college/courses" label="All courses" />
        <EmptyState
          icon={<GraduationCap size={26} />}
          title="Course not found"
          body="This course may have been removed, or the link may point at a course that is not yours."
          action={<LinkButton href="/college/courses">Back to courses</LinkButton>}
        />
      </>
    );
  }

  if (error && !course) {
    return (
      <>
        <BackLink href="/college/courses" label="All courses" />
        <ErrorState message={error} onRetry={() => void load()} />
      </>
    );
  }

  if (!course) return null;

  return (
    <>
      <BackLink href="/college/courses" label="All courses" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{course.course_name}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {course.stream === 'UG' ? 'Undergraduate' : 'Postgraduate'}
            {course.duration_years ? ` · ${course.duration_years} years` : ''}
          </p>
        </div>
        <Badge tone={course.active ? 'success' : 'neutral'}>
          {course.active ? 'Open' : 'Closed'}
        </Badge>
      </div>

      <div className="flex flex-col gap-4">
        <StatRow>
          <StatTile
            label="Applications"
            value={String(course.applications_total)}
            note={`${course.applicants.length} shown`}
          />
          <StatTile
            label="Seats filled"
            value={`${course.seats_filled} of ${course.seats ?? '-'}`}
          />
          <StatTile label="Application fee" value={formatFee(course.application_fee)} />
          <StatTile
            label="Fees collected"
            value={formatFee(course.application_fee * course.applications_total)}
          />
        </StatRow>

        <Panel
          title="Course settings"
          action={
            <Button variant="ghost" size="sm" loading={saving} onClick={() => void toggleActive()}>
              {course.active ? 'Close applications' : 'Reopen applications'}
            </Button>
          }
        >
          <form onSubmit={save} className="flex flex-col gap-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Seats" error={errors.seats} required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="number"
                    min={1}
                    value={seats}
                    onChange={(event) => {
                      setSeats(event.target.value);
                      setSaved(false);
                    }}
                  />
                )}
              </Field>

              <Field
                label="Application fee"
                hint="In rupees. Changing this does not affect anyone who has already paid."
                error={errors.fee}
                required
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="number"
                    min={1}
                    value={fee}
                    onChange={(event) => {
                      setFee(event.target.value);
                      setSaved(false);
                    }}
                  />
                )}
              </Field>

              <Field
                label="Applications open"
                hint="Blank means already open."
                error={errors.window}
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setSaved(false);
                    }}
                  />
                )}
              </Field>

              <Field label="Application deadline">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="date"
                    value={closingDate}
                    onChange={(event) => {
                      setClosingDate(event.target.value);
                      setSaved(false);
                    }}
                  />
                )}
              </Field>

              <Field label="Intake" hint="Free text, shown to students.">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={intake}
                    maxLength={200}
                    onChange={(event) => {
                      setIntake(event.target.value);
                      setSaved(false);
                    }}
                    placeholder="Fall 2027"
                  />
                )}
              </Field>
            </div>

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

        <Panel title="Applicants">
          {course.applicants.length === 0 ? (
            <EmptyState
              icon={<Tray size={26} />}
              title="No applicants yet"
              body="Applicants appear here as soon as a student pays the fee for this course."
            />
          ) : (
            <ApplicantTable applicants={course.applicants} onChanged={() => void load()} />
          )}
        </Panel>
      </div>
    </>
  );
}

export type InitialData = CollegeCourseDetail;
