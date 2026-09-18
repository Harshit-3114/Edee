import { serverGet } from '@/lib/serverApi';
import CollegeApplicationsClient, { type InitialData } from './CollegeApplicationsClient';

/**
 * The unfiltered list, fetched here on the server with the session cookie.
 * Filters are applied by the client half, which refetches as they change.
 */
export default async function Page() {
  const initialApplicants = await serverGet<InitialData>('/college/applications');

  return <CollegeApplicationsClient initialApplicants={initialApplicants} />;
}
