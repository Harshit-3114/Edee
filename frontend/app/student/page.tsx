import { redirect } from 'next/navigation';
import { PORTAL_HOME } from '@/lib/portals';

export default function StudentIndex() {
  redirect(PORTAL_HOME.student);
}
