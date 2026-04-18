export type AppRole = 'admin' | 'payment_reviewer' | 'content_reviewer' | 'user';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type SubmissionStatus = 'locked' | 'ready' | 'submitted';
export type ReviewStatus = 'not_started' | 'selected' | 'eliminated';
export type QualificationStage =
  | 'not_started'
  | 'round_1_qualified'
  | 'round_2_qualified'
  | 'round_3_qualified'
  | 'semifinal'
  | 'final'
  | 'winner'
  | 'eliminated';

export interface Submission {
  id: string;
  registration_id: string;
  round: QualificationStage;
  video_url: string;
  video_path: string;
  notes?: string;
  admin_notes?: string;
  score?: number;
  status: SubmissionStatus;
  created_at: string;
}

export interface DatabaseEvent {
  id: string;
  title: string;
  slug?: string | null;
  category: string;
  description: string;
  entry_fee: number;
  image_url: string | null;
  rules?: string[];
  max_team_size?: number;
  payment_account_name?: string | null;
  payment_account_number?: string | null;
  payment_ifsc?: string | null;
  payment_upi_id?: string | null;
  is_active?: boolean;
  participants_count?: number;
  sub_categories?: string[] | null;
  requires_team_details?: boolean;
  requires_video_submission?: boolean;
  verified_success_message?: string;
}



export interface CommitteeMember {
  id: string;
  name: string;
  role: string;
  image_url: string;
  display_order: number;
}

export interface GeneralRule {
  id: string;
  rule_text: string;
  display_order: number;
}

export interface HeroSlide {
  id: string;
  image_url: string;
  duration_seconds: number;
  display_order: number;
}

export interface SiteContent {
  id?: string;
  content_key: string;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  secondary_body?: string | null;
  image_url?: string | null;
  metadata?: Record<string, any>;
}

export interface Event {
  id: string;
  title: string;
  category: string;
  description: string;
  longDescription?: string;
  date?: string;
  time?: string;
  venue?: string;
  image?: string;
  rules?: string[];
  prizes?: string[];
  coordinators?: { name: string; contact: string }[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  created_at: string;
}
