'use client';

import { useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import api from '@/lib/api';
import { formatFee } from '@/lib/format';
import type { Course } from '@/lib/types';

export default function CourseTable({
  courses,
  onChanged,
}: {
  courses: Course[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(course: Course) {
    setBusyId(course.id);
    try {
      await api.patch(`/college/courses/${course.id}`, { active: !course.active });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TableWrap>
      <Table>
        <caption className="sr-only">Courses offered by your college</caption>
        <thead>
          <tr>
            <Th>Course</Th>
            <Th>Stream</Th>
            <Th numeric>Seats</Th>
            <Th numeric>Fee</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <Tr key={course.id}>
              <Td>
                <Link
                  href={`/college/courses/${course.id}`}
                  className="font-medium underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--text-primary)]"
                >
                  {course.course_name}
                </Link>
                {course.duration_years && (
                  <span className="ml-2 text-[13px] text-[var(--text-muted)]">
                    {course.duration_years} yr
                  </span>
                )}
              </Td>
              <Td>{course.stream}</Td>
              <Td numeric>{course.seats ?? '-'}</Td>
              <Td numeric>{formatFee(course.application_fee)}</Td>
              <Td>
                <Badge tone={course.active ? 'success' : 'neutral'}>
                  {course.active ? 'Open' : 'Closed'}
                </Badge>
              </Td>
              <Td>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busyId === course.id}
                  onClick={() => void toggleActive(course)}
                >
                  {course.active ? 'Close' : 'Reopen'}
                </Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
