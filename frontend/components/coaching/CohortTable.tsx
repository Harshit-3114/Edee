import Link from 'next/link';
import Badge, { type Tone } from '@/components/ui/Badge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/Table';
import { COHORT_STAGE_LABEL, formatDate, formatPhone } from '@/lib/format';
import type { CohortStage, CohortStudent } from '@/lib/types';

const STAGE_TONE: Record<CohortStage, Tone> = {
  signed_up: 'neutral',
  shortlisted: 'info',
  paid: 'warning',
  accepted: 'success',
};

/**
 * Read-only by design. There is no action column here and there should never
 * be one: a coaching centre observes its cohort, it does not act for them.
 */
export default function CohortTable({ students }: { students: CohortStudent[] }) {
  return (
    <TableWrap>
      <Table>
        <caption className="sr-only">Students linked to your centre</caption>
        <thead>
          <tr>
            <Th>Student</Th>
            <Th>Phone</Th>
            <Th>Stream</Th>
            <Th numeric>Shortlisted</Th>
            <Th numeric>Applied</Th>
            <Th>Stage</Th>
            <Th>Joined</Th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <Tr key={student.id}>
              <Td>
                <Link
                  href={`/coaching/students/${student.id}`}
                  className="font-medium underline decoration-[var(--line-strong)] underline-offset-4 transition-colors hover:decoration-[var(--text-primary)]"
                >
                  {student.name}
                </Link>
              </Td>
              <Td>
                <span className="tabular">{formatPhone(student.phone)}</span>
              </Td>
              <Td>{student.stream}</Td>
              <Td numeric>{student.shortlist_count}</Td>
              <Td numeric>{student.application_count}</Td>
              <Td>
                <Badge tone={STAGE_TONE[student.stage]}>
                  {COHORT_STAGE_LABEL[student.stage]}
                </Badge>
              </Td>
              <Td>{formatDate(student.joined_at)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
