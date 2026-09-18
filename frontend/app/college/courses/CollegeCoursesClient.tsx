'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { GraduationCap } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import CourseForm from '@/components/college/CourseForm';
import CourseTable from '@/components/college/CourseTable';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import type { Course } from '@/lib/types';

/**
 * The interactive half of this page.
 *
 * `initialCourses` is whatever the server already fetched with the session cookie:
 * present means render on the first paint with no spinner and no round trip,
 * null means fall back to fetching on mount exactly as this page did before.
 */
export default function CollegeCoursesClient({
  initialCourses,
}: {
  initialCourses: Course[] | null;
}) {
  const [courses, setCourses] = useState<Course[]>(initialCourses ?? []);
  const [loading, setLoading] = useState(initialCourses === null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // No college_id anywhere in this call. The backend reads it from the
      // token, which is why a staff member cannot reach another college.
      const { data } = await api.get<Course[]>('/college/courses');
      setCourses(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your courses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Only when the server could not supply it. Refetching data we were handed
  // a moment ago is the round trip this exists to remove.
  const served = useRef(initialCourses !== null);
  useEffect(() => {
    if (served.current) return;
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Courses"
        description="Seats and application fees shown to students come from this list. Closing a course hides it from search without deleting it."
      />

      <div className="mb-5">
        <CourseForm onCreated={() => void load()} />
      </div>

      {loading && <LoadingList rows={4} columns={5} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && courses.length === 0 && (
        <EmptyState
          icon={<GraduationCap size={26} />}
          title="No courses listed"
          body="Add your first course and students will be able to find and apply to it straight away."
        />
      )}

      {!loading && !error && courses.length > 0 && (
        <CourseTable courses={courses} onChanged={() => void load()} />
      )}
    </>
  );
}

export type InitialData = Course[];
