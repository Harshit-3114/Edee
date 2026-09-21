'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudArrowUp, DownloadSimple, FileCsv } from '@phosphor-icons/react';
import PageHeader from '@/components/shells/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { EmptyState, ErrorState, LoadingList } from '@/components/ui/States';
import api, { apiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

export interface UploadRow {
  id: string;
  filename: string;
  status: string;
  records_total: number;
  records_created: number;
  records_duplicate: number;
  records_error: number;
  created_at: string;
}

export interface UploadedStudent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  stream: string | null;
  status: 'uploaded' | 'signed_up';
  /** Raw "College :: Course; …" text from the upload, resolved on signup. */
  interests: string | null;
  uploaded_via: string | null;
  created_at: string;
}

interface UploadSummary {
  total: number;
  created: number;
  duplicates: number;
  error_count: number;
  errors: { row: number; reason: string }[];
}

/**
 * The interactive half of this page.
 *
 * `initialUploads` / `initialStudents` are whatever the server already fetched
 * with the session cookie: present means render on the first paint with no
 * spinner and no round trip, null means fall back to fetching on mount.
 */
export default function UploadsClient({
  initialUploads,
  initialStudents,
}: {
  initialUploads: UploadRow[] | null;
  initialStudents: UploadedStudent[] | null;
}) {
  const [uploads, setUploads] = useState<UploadRow[]>(initialUploads ?? []);
  const [uploadsLoading, setUploadsLoading] = useState(initialUploads === null);
  const [students, setStudents] = useState<UploadedStudent[]>(initialStudents ?? []);
  const [studentsLoading, setStudentsLoading] = useState(initialStudents === null);
  const [error, setError] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const loadUploads = useCallback(async () => {
    setUploadsLoading(true);
    try {
      const { data } = await api.get<UploadRow[]>('/coaching/uploads');
      setUploads(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load upload history.'));
    } finally {
      setUploadsLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async (query?: string) => {
    setStudentsLoading(true);
    try {
      const { data } = await api.get<UploadedStudent[]>('/coaching/uploaded-students', {
        params: { limit: 50, ...(query ? { search: query } : {}) },
      });
      setStudents(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load submitted students.'));
    } finally {
      setStudentsLoading(false);
      setSearching(false);
    }
  }, []);

  const uploadsServed = useRef(initialUploads !== null);
  const studentsServed = useRef(initialStudents !== null);
  useEffect(() => {
    if (uploadsServed.current) return;
    void loadUploads();
  }, [loadUploads]);
  useEffect(() => {
    if (studentsServed.current) return;
    void loadStudents();
  }, [loadStudents]);

  async function downloadTemplate() {
    setDownloading(true);
    try {
      const { data } = await api.get<Blob>('/coaching/uploads/template', {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'student-upload-template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not download the template.'));
    } finally {
      setDownloading(false);
    }
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setSummary(null);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<UploadSummary>('/coaching/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSummary(data);
      setFile(null);
      await Promise.all([loadUploads(), loadStudents()]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not upload that file.'));
    } finally {
      setUploading(false);
    }
  }

  function runSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    void loadStudents(search.trim() || undefined);
  }

  return (
    <>
      <PageHeader
        title="Upload students"
        description="Send student data in bulk. Every file appends to your cumulative database - re-sending a file never duplicates it."
        action={
          <Button
            variant="secondary"
            size="sm"
            loading={downloading}
            onClick={() => void downloadTemplate()}
          >
            {!downloading && <DownloadSimple size={15} />}
            Download template
          </Button>
        }
      />

      {error && (
        <div className="mb-5">
          <ErrorState message={error} onRetry={() => { void loadUploads(); void loadStudents(); }} />
        </div>
      )}

      <form
        onSubmit={upload}
        className="mb-8 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-5"
      >
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CloudArrowUp size={17} aria-hidden="true" />
          Send a completed file
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Excel or CSV with name, email, phone and stream columns, plus an
          optional shortlisted column shaped like
          “Fergusson College :: B.Sc Statistics; Christ University :: BBA”.
          Those become real shortlists when the lead registers. At most 1,000
          rows and 2 MB per file. Email decides duplicates: a lead already
          submitted, or already registered on the platform, is counted rather
          than added again.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept=".csv,.xlsx,.xlsm,text/csv"
            aria-label="Spreadsheet file to upload"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button type="submit" loading={uploading} disabled={!file}>
            Upload {file ? `(${file.name})` : ''}
          </Button>
        </div>

        {summary && (
          <div role="status" className="mt-4 rounded-lg bg-[var(--surface-sunken)] px-4 py-3 text-[13px]">
            <p>
              <span className="font-medium">{summary.created} added</span>,{' '}
              {summary.duplicates} duplicates, {summary.error_count} errors
              {' '}out of {summary.total} rows.
            </p>
            {summary.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-[var(--text-secondary)]">
                {summary.errors.map((item) => (
                  <li key={item.row}>
                    Row {item.row}: {item.reason}
                  </li>
                ))}
                {summary.error_count > summary.errors.length && (
                  <li>…and {summary.error_count - summary.errors.length} more.</li>
                )}
              </ul>
            )}
          </div>
        )}
      </form>

      <h2 className="mb-3 text-base font-medium tracking-tight">Upload history</h2>
      {uploadsLoading && <LoadingList rows={3} columns={4} />}
      {!uploadsLoading && uploads.length === 0 && (
        <EmptyState
          icon={<FileCsv size={26} />}
          title="No uploads yet"
          body="Download the template, fill it in, and send your first file above."
        />
      )}
      {!uploadsLoading && uploads.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Files this centre has uploaded</caption>
            <thead>
              <tr>
                <Th>File</Th>
                <Th>Sent</Th>
                <Th numeric>Rows</Th>
                <Th numeric>Added</Th>
                <Th numeric>Duplicates</Th>
                <Th numeric>Errors</Th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span className="font-medium">{row.filename}</span>
                  </Td>
                  <Td>{formatDate(row.created_at)}</Td>
                  <Td numeric>{row.records_total}</Td>
                  <Td numeric>{row.records_created}</Td>
                  <Td numeric>{row.records_duplicate}</Td>
                  <Td numeric>{row.records_error}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight">Submitted students</h2>
        <form onSubmit={runSearch} className="flex items-center gap-2">
          <Field label="Search submitted students">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or email"
              />
            )}
          </Field>
          <Button type="submit" variant="secondary" size="sm" loading={searching}>
            Search
          </Button>
        </form>
      </div>
      {studentsLoading && <LoadingList rows={4} columns={5} />}
      {!studentsLoading && students.length === 0 && (
        <EmptyState
          title="Nothing here"
          body="Submitted leads appear here across every login - upload a file to start the list."
        />
      )}
      {!studentsLoading && students.length > 0 && (
        <TableWrap>
          <Table>
            <caption className="sr-only">Students this centre has submitted</caption>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Stream</Th>
                <Th>Status</Th>
                <Th>Shortlisted</Th>
                <Th>From file</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <Tr key={student.id}>
                  <Td>
                    <span className="font-medium">{student.name}</span>
                  </Td>
                  <Td>{student.email}</Td>
                  <Td>{student.stream ?? '-'}</Td>
                  <Td>
                    <Badge tone={student.status === 'signed_up' ? 'success' : 'neutral'}>
                      {student.status === 'signed_up' ? 'Signed up' : 'Submitted'}
                    </Badge>
                  </Td>
                  <Td>{student.interests ?? '-'}</Td>
                  <Td>{student.uploaded_via ?? '-'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}

export type InitialData = UploadRow[];
