'use client';

import { useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import api from '@/lib/api';
import { NEXT_STATUS } from '@/lib/applications';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  formatDate,
} from '@/lib/format';
import type { ApplicationStatus, CollegeApplicant } from '@/lib/types';

export default function ApplicantTable({
  applicants,
  onChanged,
}: {
  applicants: CollegeApplicant[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, ApplicationStatus>>({});

  async function apply(applicant: CollegeApplicant) {
    const status = draft[applicant.id];
    if (!status) return;

    setBusyId(applicant.id);
    try {
      await api.patch(`/college/applications/${applicant.id}`, { status });
      setDraft((prev) => {
        const next = { ...prev };
        delete next[applicant.id];
        return next;
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TableWrap>
      <Table>
        <caption className="sr-only">Applications received by your college</caption>
        <thead>
          <tr>
            <Th>Applicant</Th>
            <Th>Course</Th>
            <Th>Applied</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Change status</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {applicants.map((applicant) => {
            const options = NEXT_STATUS[applicant.status];
            return (
              <Tr key={applicant.id}>
                <Td>
                  <Link
                    href={`/college/applications/${applicant.id}`}
                    className="font-medium underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--text-primary)]"
                  >
                    {applicant.student_name}
                  </Link>
                  <span className="ml-2 text-[13px] text-[var(--text-muted)]">
                    {applicant.stream}
                  </span>
                </Td>
                <Td>{applicant.course_name}</Td>
                <Td>{formatDate(applicant.created_at)}</Td>
                <Td>
                  <Badge tone={APPLICATION_STATUS_TONE[applicant.status]}>
                    {APPLICATION_STATUS_LABEL[applicant.status]}
                  </Badge>
                </Td>
                <Td>
                  {options.length === 0 ? (
                    <span className="text-[13px] text-[var(--text-muted)]">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label htmlFor={`status-${applicant.id}`} className="sr-only">
                        New status for {applicant.student_name}
                      </label>
                      <Select
                        id={`status-${applicant.id}`}
                        value={draft[applicant.id] ?? ''}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            [applicant.id]: event.target.value as ApplicationStatus,
                          }))
                        }
                        className="h-8 w-auto text-[13px]"
                      >
                        <option value="">Move to</option>
                        {options.map((status) => (
                          <option key={status} value={status}>
                            {APPLICATION_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!draft[applicant.id]}
                        loading={busyId === applicant.id}
                        onClick={() => void apply(applicant)}
                      >
                        Save
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
