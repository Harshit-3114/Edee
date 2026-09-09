export type Stream = 'UG' | 'PG';

export type CollegeType = 'private' | 'government' | 'deemed';

export interface Course {
  id: string;
  college_id: string;
  course_name: string;
  stream: Stream;
  duration_years: number | null;
  seats: number | null;
  /** Paise. Always divide by 100 for display - see lib/format.ts. */
  application_fee: number;
  active: boolean;
}

export interface College {
  id: string;
  name: string;
  location: string;
  city: string;
  state: string;
  type: CollegeType;
  active: boolean;
  courses: Course[];
}

export interface Student {
  id: string;
  firebase_uid: string;
  name: string;
  email: string;
  phone: string;
  stream: Stream;
  coaching_centre_id: string | null;
  created_at: string;
}

export interface ShortlistEntry {
  id: string;
  college_id: string;
  course_id: string;
  college_name: string;
  course_name: string;
  city: string;
  state: string;
  stream: Stream;
  application_fee: number;
  created_at: string;
}

export type ApplicationStatus =
  | 'payment_received'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface Application {
  id: string;
  college_id: string;
  course_id: string;
  college_name: string;
  course_name: string;
  city: string;
  status: ApplicationStatus;
  status_note: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface CollegeQuery {
  stream?: Stream;
  state?: string;
  type?: CollegeType;
  search?: string;
  limit?: number;
  offset?: number;
}

/* Portal-side shapes */

export interface CollegeApplicant {
  id: string;
  student_name: string;
  stream: Stream;
  course_name: string;
  status: ApplicationStatus;
  created_at: string;
}

export type CohortStage = 'signed_up' | 'shortlisted' | 'paid' | 'accepted';

export interface CohortStudent {
  id: string;
  name: string;
  phone: string;
  stream: Stream;
  stage: CohortStage;
  shortlist_count: number;
  application_count: number;
  joined_at: string;
}

export interface CoachingInvite {
  id: string;
  code: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: 'college' | 'coaching' | 'admin';
  org_name: string | null;
  active: boolean;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  student_name: string;
  razorpay_payment_id: string;
  amount: number;
  status: string;
  verified_at: string;
}

export interface AuditEvent {
  id: string;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

/* Detail views */

export interface CollegeApplicationDetail {
  id: string;
  student_name: string;
  student_email: string;
  student_phone: string;
  stream: Stream;
  course_id: string;
  course_name: string;
  status: ApplicationStatus;
  status_note: string | null;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface CohortStudentDetail extends CohortStudent {
  email: string;
  /** Shortlisted but unpaid. Visible to coaching, invisible to the college. */
  shortlist: ShortlistEntry[];
  applications: Application[];
}

export interface AdminCollegeDetail extends College {
  staff: PlatformUser[];
  application_count: number;
  fees_collected: number;
}

export interface AdminStudentRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  stream: Stream;
  coaching_centre_name: string | null;
  shortlist_count: number;
  application_count: number;
  created_at: string;
}

export interface CollegeCourseDetail extends Course {
  applicants: CollegeApplicant[];
  applications_total: number;
  seats_filled: number;
}
