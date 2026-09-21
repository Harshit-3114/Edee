import { redirect } from 'next/navigation';
import { PORTAL_HOME } from '@/lib/portals';

export default function CoachingIndex() {
  redirect(PORTAL_HOME.coaching);
}
