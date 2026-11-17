export type OfferType = 'sell' | 'lend' | 'donate' | 'exchange';
export type BookCondition = 'New' | 'Like New' | 'Good' | 'Fair';
export type ListingStatus = 'available' | 'reserved' | 'completed' | 'deactivated';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
export type UserRole = 'student' | 'team_admin' | 'super_admin' | 'admin';
export type ThemePreference = 'light' | 'dark' | 'system';

export type TeamPermission =
  | 'manage_books'
  | 'manage_requests'
  | 'investigate_discrepancies'
  | 'verify_users'
  | 'view_reports';

export interface Campus {
  id: string;
  name: string;
  domain: string;
  location: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  collegeId: string;
  branch: string;
  year: string;
  semester: number;
  campusId?: string;
  role: UserRole;
  permissions?: TeamPermission[];
  verified: boolean;
  isSuspended: boolean;
  themePreference?: ThemePreference;
  bio: string;
  createdAt: string;
}

export interface BookOwnerSummary {
  id: string;
  name: string;
  branch: string;
  year: string;
  semester?: number;
  verified: boolean;
  bio?: string;
}

export interface BookListing {
  id: string;
  ownerId: string;
  owner?: BookOwnerSummary;
  campusId?: string;
  campusName?: string;
  title: string;
  author: string;
  subject: string;
  course: string;
  isbn: string;
  edition: string;
  branch: string;
  semester: number;
  condition: BookCondition;
  offerType: OfferType;
  price: number;
  deposit: number;
  loanDurationDays: number;
  quantity: number;
  availableQuantity: number;
  viewsCount: number;
  requestCount: number;
  description: string;
  images: string[];
  status: ListingStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface TransactionSummary {
  id: string;
  status: 'active' | 'completed' | 'cancelled';
  agreedPrice: number;
  startDate: string;
  dueDate?: string;
  completedAt?: string;
}

export interface BookRequest {
  id: string;
  listingId: string;
  listing?: {
    id: string;
    title: string;
    author: string;
    subject: string;
    offerType: OfferType;
    price: number;
    status: ListingStatus;
    images: string[];
    loanDurationDays?: number;
    deposit?: number;
  };
  ownerId: string;
  owner?: BookOwnerSummary;
  requesterId: string;
  requester?: BookOwnerSummary;
  offerType: OfferType;
  initialMessage: string;
  pickupLocation: string;
  status: RequestStatus;
  transaction?: TransactionSummary;
  createdAt: string;
  updatedAt: string;
}

export interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type:
    | 'new_request'
    | 'new_message'
    | 'status_change'
    | 'listing_unavailable'
    | 'verification'
    | 'report_update';
  title: string;
  message: string;
  relatedRequestId?: string;
  relatedListingId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface StudentPublicProfile {
  id: string;
  name: string;
  branch: string;
  year: string;
  semester: number;
  verified: boolean;
  bio: string;
  campusName: string;
  createdAt: string;
  completedTransactions: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface ProfileReview {
  id: string;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerBranch: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  suspendedUsers: number;
  totalListings: number;
  activeListings: number;
  totalRequests: number;
  completedTransactions: number;
  openReports: number;
  openDiscrepancies?: number;
  teamAdminsCount?: number;
}

export interface DiscrepancyItem {
  id: string;
  issueId: string;
  type:
    | 'quantity_anomaly'
    | 'duplicate_listing'
    | 'suspicious_request'
    | 'availability_mismatch'
    | 'unauthorized_modification'
    | 'repeated_failed_login';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  relatedModel: 'BookListing' | 'BookRequest' | 'User' | 'Transaction';
  relatedRecordId: string;
  relatedUser?: {
    id: string;
    name: string;
    collegeId: string;
  } | null;
  assignedAdminId?: string | null;
  assignedAdminName: string;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  investigationNotes: Array<{
    adminId: string;
    adminName: string;
    note: string;
    createdAt: string;
  }>;
  resolutionSummary: string;
  autoDetected: boolean;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogItem {
  id: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  reason: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  restorable: boolean;
  restoredAt?: string | null;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  collegeId: string;
  role: UserRole;
  permissions: TeamPermission[];
  isSuspended: boolean;
  createdAt: string;
}

export interface PlatformSettings {
  siteName: string;
  campusName: string;
  campusDomain: string;
  autoVerifyCampusEmail: boolean;
  maxActiveRequestsPerStudent: number;
  failedLoginAlertThreshold: number;
  quantityJumpAlertThreshold: number;
  maintenanceBanner: string;
}

export interface BackupSnapshotSummary {
  id: string;
  label: string;
  createdByName: string;
  counts: {
    users: number;
    books: number;
    requests: number;
    transactions: number;
    discrepancies: number;
    auditLogs: number;
  };
  createdAt: string;
}
