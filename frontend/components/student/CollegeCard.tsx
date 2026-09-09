'use client';

import { MapPin } from '@phosphor-icons/react';
import Badge from '@/components/ui/Badge';
import { formatFee } from '@/lib/format';
import type { College } from '@/lib/types';
import ShortlistButton from './ShortlistButton';

interface Props {
  college: College;
  isShortlisted: (courseId: string) => boolean;
  isPending: (courseId: string) => boolean;
  onToggle: (collegeId: string, courseId: string) => void;
}

const TYPE_LABEL: Record<College['type'], string> = {
  government: 'Government',
  private: 'Private',
  deemed: 'Deemed',
};

export default function CollegeCard({
  college,
  isShortlisted,
  isPending,
  onToggle,
}: Props) {
  const courses = college.courses.filter((course) => course.active);

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">{college.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
            <MapPin size={14} aria-hidden="true" />
            {college.city}, {college.state}
          </p>
        </div>
        <Badge>{TYPE_LABEL[college.type]}</Badge>
      </header>

      {courses.length === 0 ? (
        <p className="mt-5 text-[13px] text-[var(--text-muted)]">
          No courses are open for applications right now.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{course.course_name}</p>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  {course.stream === 'UG' ? 'Undergraduate' : 'Postgraduate'}
                  {course.duration_years ? ` · ${course.duration_years} years` : ''}
                  {course.seats ? ` · ${course.seats} seats` : ''}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="tabular text-sm font-medium whitespace-nowrap">
                  {formatFee(course.application_fee)}
                </span>
                <ShortlistButton
                  courseName={`${course.course_name} at ${college.name}`}
                  shortlisted={isShortlisted(course.id)}
                  pending={isPending(course.id)}
                  onToggle={() => onToggle(college.id, course.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
