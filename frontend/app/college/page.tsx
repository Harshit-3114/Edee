import { redirect } from 'next/navigation';
import { PORTAL_HOME } from '@/lib/portals';

export default function CollegeIndex() {
  redirect(PORTAL_HOME.college);
}
