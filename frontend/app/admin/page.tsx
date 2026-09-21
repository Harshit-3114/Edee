import { redirect } from 'next/navigation';
import { PORTAL_HOME } from '@/lib/portals';

export default function AdminIndex() {
  redirect(PORTAL_HOME.admin);
}
