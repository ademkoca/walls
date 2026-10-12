import type {
  Locale,
  PhoneVerificationStatus,
  PropertyType,
  ReviewStatus,
  Role,
  TransactionType,
} from '../enums';
import type { ProfileField } from '../user/profile';
import type { PublicPhoneContact } from '../user/phone';
import type { PriceView, UserReference } from './listings';

/** Profile, agent-application and public-profile shapes. Dates are ISO 8601 strings. */

/** One version of a user's editable profile, as shown in forms and reviews. */
export interface ProfileView {
  displayName: string;
  bio: string | null;
  agencyName: string | null;
  phone: string | null;
  isPhonePublic: boolean;
  isEmailPublic: boolean;
  avatarUrl: string | null;
}

/** An agent's profile change request (SPEC §4): the complete proposed version. */
export interface ProfileChangeRequestView {
  id: string;
  status: ReviewStatus;
  proposed: ProfileView;
  /** A new, already verified email address waiting for approval. */
  newEmail: string | null;
  changes: ProfileField[];
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

/** GET /me/profile: the signed-in user's own profile. */
export interface MyProfile {
  role: Role;
  email: string;
  slug: string;
  /** Null for roles without a public profile page (Admins). */
  publicPath: string | null;
  phoneVerificationStatus: PhoneVerificationStatus;
  /** True for agents: changes wait for Admin approval. */
  changesRequireApproval: boolean;
  live: ProfileView;
  /** The pending request, or the latest reviewed one (to show a rejection). */
  changeRequest: ProfileChangeRequestView | null;
  /** An email address waiting for its owner to click the verification link. */
  pendingEmail: string | null;
}

export interface ProfileChangeRequestSummary {
  id: string;
  user: UserReference & { email: string };
  changes: ProfileField[];
  status: ReviewStatus;
  updatedAt: string;
}

export interface ProfileChangeRequestDetail extends ProfileChangeRequestView {
  user: UserReference & { email: string; slug: string };
  live: ProfileView;
  reviewedBy: UserReference | null;
  canReview: boolean;
}

export interface AgentApplicationFileView {
  id: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}

export interface AgentApplicationSummary {
  id: string;
  fullName: string;
  email: string;
  agencyName: string | null;
  status: ReviewStatus;
  fileCount: number;
  createdAt: string;
}

export interface AgentApplicationDetail extends AgentApplicationSummary {
  phone: string;
  locale: Locale;
  files: AgentApplicationFileView[];
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: UserReference | null;
  /** The agent account created on approval. */
  resultingUser: UserReference | null;
  /** True when an account with this email exists, so approval is impossible. */
  emailInUse: boolean;
  canReview: boolean;
}

/** Items waiting for Admins, for the dashboard navigation. */
export interface ReviewQueueCounts {
  listings: number;
  listingRevisions: number;
  agentApplications: number;
  profileChanges: number;
}

/** A published listing as shown in public lists (profile pages, later search). */
export interface PublicListingCard {
  id: string;
  slug: string;
  title: { sr: string; en: string | null };
  propertyType: PropertyType;
  transactionType: TransactionType;
  price: PriceView;
  city: string | null;
  municipality: string | null;
  neighborhood: string | null;
  coverImageUrl: string | null;
  floorArea: number | null;
  plotArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  publishedAt: string;
}

/** A public seller or agent profile (SPEC §19). Never includes private data. */
export interface PublicProfile {
  slug: string;
  role: Role;
  displayName: string;
  bio: string | null;
  agencyName: string | null;
  avatarUrl: string | null;
  /** With its verification status, which must always be shown next to the number. */
  phone: PublicPhoneContact | null;
  email: string | null;
  /** True for agents: their application was approved by an Admin. */
  approvedAgent: boolean;
  memberSince: string;
}

export interface PublicProfilePage {
  profile: PublicProfile;
  listings: PublicListingCard[];
}

export interface PublicAgentSummary {
  slug: string;
  displayName: string;
  agencyName: string | null;
  avatarUrl: string | null;
  listingCount: number;
}
