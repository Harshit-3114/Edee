'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Badge from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate, formatPhone } from '@/lib/format';
import type { AdminStudentRow, Stream } from '@/lib/types';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [stream, setStream] = useState<Stream | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AdminStudentRow[]>('/admin/students', {
        params: { search: search || undefined, stream: stream || undefined },
      });
      setStudents(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load students.'));
    } finally {
      setLoading(false);
    }
  }, [search, stream]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <>
      <PageHeader
        title="Students"
        description="Lookup for support. Search by name, email, or phone when someone writes in about an application."
      />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="student-search" className="sr-only">
            Search students
          </label>
          <Input
            id="student-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, or phone"
          />
        </div>

        <label htmlFor="student-stream" className="sr-only">
          Filter by stream
        </label>
        <Select
          id="student-stream"
          value={stream}
          onChange={(event) => setStream(event.target.value as Stream | '')}
          className="w-auto"
        >
          <option value="">All streams</option>
          <option value="UG">Undergraduate</option>
          <option value="PG">Postgraduate</option>
        </Select>
      </div>

      {loading && <LoadingList rows={6} columns={6} />}

      {!loading && error && <ErrorState message={error} onRetry={() => void load()} />}

      {!loading && !error && students.length === 0 && (
        <EmptyState
          icon={<Users size={26} />}
          title={search || stream ? 'No students match' : 'No students yet'}
          body={
            search || stream
              ? 'Check the spelling, or search by phone number instead.'
              : 'Students appear here as soon as they complete signup.'
          }
        />
      )}

      {!loading && !error && students.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Students on the platform</caption>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Contact</Th>
                <Th>Stream</Th>
                <Th>Coaching</Th>
                <Th numeric>Shortlisted</Th>
                <Th numeric>Applied</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <Tr key={student.id}>
                  <Td>
                    <span className="font-medium">{student.name}</span>
                  </Td>
                  <Td>
                    <span className="text-[13px]">{student.email}</span>
                    <br />
                    <span className="tabular text-[13px] text-[var(--text-secondary)]">
                      {formatPhone(student.phone)}
                    </span>
                  </Td>
                  <Td>{student.stream}</Td>
                  <Td>
                    {student.coaching_centre_name ? (
                      <Badge tone="neutral">{student.coaching_centre_name}</Badge>
                    ) : (
                      <span className="text-[13px] text-[var(--text-muted)]">Direct</span>
                    )}
                  </Td>
                  <Td numeric>{student.shortlist_count}</Td>
                  <Td numeric>{student.application_count}</Td>
                  <Td>{formatDate(student.created_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
