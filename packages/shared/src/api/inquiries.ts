import type { InquiryStatus, ListingStatus } from '../enums';
import type { UserReference } from './listings';

/** Inquiry and analytics shapes for the dashboard (SPEC §20, §23). Dates are ISO 8601. */

export interface InquiryListingReference {
  id: string;
  /** Serbian title. */
  title: string | null;
  /** Public page, when the listing has been published. */
  slug: string | null;
  status: ListingStatus;
}

export interface InquirySummary {
  id: string;
  listing: InquiryListingReference;
  visitorName: string;
  /** The start of the message. */
  preview: string;
  status: InquiryStatus;
  /** False for the listing creator's read-only view when an agent handles the inquiry. */
  canManage: boolean;
  createdAt: string;
}

export interface InquiryDetail extends InquirySummary {
  /** Sent by a signed-in private seller or agent (their account's name and email). */
  fromRegisteredUser: boolean;
  visitorEmail: string;
  visitorPhone: string | null;
  /** Only the recipient may write back to the visitor; admins read and set the status. */
  canReply: boolean;
  message: string;
  /** Who received and manages the inquiry: the listing's creator. */
  recipient: UserReference;
  updatedAt: string;
}

/**
 * An inquiry the signed-in user sent, for their own history. Its status is the recipient's
 * business and is not shown (decision, Phase 9).
 */
export interface SentInquiry {
  id: string;
  listing: InquiryListingReference;
  /** Who received it: the listing's advertiser. */
  recipientName: string;
  message: string;
  createdAt: string;
}

/** New inquiries the user manages (all new inquiries for Admins), for the navigation. */
export interface InquiryCounts {
  new: number;
}

export interface DailyCount {
  /** YYYY-MM-DD, Serbian time. */
  day: string;
  value: number;
}

export interface ListingAnalytics {
  totalViews: number;
  inquiryCount: number;
  /** Views per day for the last `VIEWS_CHART_DAYS` days, oldest first. */
  viewsByDay: DailyCount[];
}

export interface PlatformAnalytics {
  listings: {
    /** Every listing except deleted drafts. */
    total: number;
    published: number;
    pendingReview: number;
    sold: number;
    rented: number;
  };
  inquiries: { total: number; new: number };
  views: { total: number; last30Days: number };
}
