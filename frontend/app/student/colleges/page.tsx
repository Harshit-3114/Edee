import { serverGet } from '@/lib/serverApi';
import StudentCollegesClient from './StudentCollegesClient';
import type { College, ShortlistEntry } from '@/lib/types';

/**
 * The unfiltered first page plus the student's shortlist, fetched together on
 * the server. Filtering and searching are the client half's job.
 */
export default async function Page() {
  const [initialColleges, initialShortlist] = await Promise.all([
    serverGet<College[]>('/colleges/?limit=12&offset=0'),
    serverGet<ShortlistEntry[]>('/shortlists/'),
  ]);

  return (
    <StudentCollegesClient
      initialColleges={initialColleges}
      initialShortlist={initialShortlist}
    />
  );
}
