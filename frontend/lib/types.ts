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
  /** ISO timestamp, or null when applications are already open. */
  application_start_date: string | null;
  /** Free text, e.g. "Fall 2027". Null when the college sets none. */
  intake_info: string | null;
  /** ISO timestamp, or null when applications stay open indefinitely. */
  closing_date: string | null;
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
  /** Present on detail views; the list view omits landing content. */
  slug?: string;
  landing_hero_image_url?: string | null;
  landing_description?: string | null;
  landing_gallery_urls?: string[] | null;
  /** Free-text admission rounds, edited in the admin portal. */
  application_phases?: string | null;
  /** Backend-served path (e.g. /uploads/logos/…) or absolute URL. */
  logo_url?: string | null;
  /** YouTube link, embedded on the landing page. Edited in the admin portal. */
  video_url?: string | null;
  /** Long-form overview, edited in the admin portal. */
  overview?: string | null;
  /** Ordered Q&A list, edited in the admin portal. */
  faqs?: CollegeFaq[] | null;
}

/** One frequently-asked question on a college landing page. */
export interface CollegeFaq {
  question: string;
  answer: string;
}

/** What GET /colleges/by-slug/:slug returns. Always complete. */
export interface CollegeLanding {
  id: string;
  name: string;
  slug: string;
  location: string;
  city: string;
  state: string;
  type: CollegeType;
  landing_hero_image_url: string | null;
  landing_description: string | null;
  landing_gallery_urls: string[] | null;
  /** Free-text admission rounds, edited in the admin portal. */
  application_phases: string | null;
  /** Backend-served path (e.g. /uploads/logos/…) or absolute URL. */
  logo_url: string | null;
  /** YouTube embed URL for the campus video. Null when the college sets none. */
  video_url: string | null;
  /** Long-form overview, shown above the short landing description. */
  overview: string | null;
  /** Ordered Q&A list. Empty array when the college sets none. */
  faqs: CollegeFaq[] | null;
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
  /** Referring centre name when signed up with an invite code. Read-only. */
  coaching_centre_name?: string | null;
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
  /** ISO timestamp, or null when applications are already open. */
  application_start_date: string | null;
  /** Free text, e.g. "Fall 2027". Null when the college sets none. */
  intake_info: string | null;
  /** ISO timestamp, or null when applications stay open indefinitely. */
  closing_date: string | null;
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
  /** ISO timestamp of the course deadline, or null when open indefinitely. */
  closing_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderResponse {
  order_id: string;
  /** Paise actually charged: gross minus scholarship. */
  amount: number;
  /** Gross quoted fees in paise. */
  total_amount: number;
  /** Scholarship applied in paise. */
  discount_amount: number;
  currency: string;
  key_id: string;
}

export interface OrderQuote {
  item_count: number;
  total_amount: number;
  discount_amount: number;
  amount: number;
}

export interface ScholarshipSlab {
  min_forms: number;
  discount_paise: number;
}

export interface ScholarshipPolicy {
  slabs: ScholarshipSlab[];
  per_form_beyond_paise: number;
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

export type ServiceStatusValue = 'operational' | 'degraded' | 'down';

export interface ServiceStatus {
  name: string;
  label: string;
  status: ServiceStatusValue;
  latency_ms: number | null;
  detail: string;
}

export interface SystemStatus {
  overall: ServiceStatusValue;
  checked_at: string;
  services: ServiceStatus[];
}

export interface AuditEvent {
  id: string;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  role: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
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
