'use client';

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import CourseForm from '@/components/college/CourseForm';
import CourseTable from '@/components/college/CourseTable';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import type { Course } from '@/lib/types';

export default function CollegeCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
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
