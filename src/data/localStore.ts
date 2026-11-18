import type {
  AdminStats,
  AppNotification,
  AuditLogItem,
  BackupSnapshotSummary,
  BookListing,
  BookOwnerSummary,
  BookRequest,
  Campus,
  DiscrepancyItem,
  OfferType,
  PlatformSettings,
  ProfileReview,
  RequestMessage,
  StudentPublicProfile,
  TeamMember,
  TeamPermission,
  User,
} from '../types';

const DATA_KEY = 'bookback_demo_data_v1';
const SESSION_KEY = 'bookback_demo_user';
const STORE_EVENT = 'bookback-demo-data-change';

interface DemoUser extends User {
  permissions: TeamPermission[];
  isSuspended: boolean;
  suspensionReason: string;
  failedLoginAttempts: number;
}

interface DemoReport {
  id: string;
  listingId?: string;
  reportedUserId?: string;
  reason: string;
  details: string;
  status: string;
  adminNote: string;
  reporterName: string;
  listingTitle?: string;
  createdAt: string;
}

interface StoredNotification extends AppNotification {
  userId: string;
}

interface StoredReview {
  transactionId: string;
  reviewerId: string;
  targetUserId: string;
  review: ProfileReview;
}

interface DemoDatabase {
  users: DemoUser[];
  books: BookListing[];
  requests: BookRequest[];
  messages: RequestMessage[];
  notifications: StoredNotification[];
  reports: DemoReport[];
  discrepancies: DiscrepancyItem[];
  auditLogs: AuditLogItem[];
  settings: PlatformSettings;
  backups: BackupSnapshotSummary[];
  backupBooks: Record<string, BookListing[]>;
  reviews: StoredReview[];
}

export interface AdminListingRow extends BookListing {
  ownerName: string;
  ownerCollegeId: string;
}

export interface AdminRequestRow {
  id: string;
  listingId?: string;
  bookTitle: string;
  offerType: string;
  ownerName: string;
  ownerCollegeId: string;
  requesterName: string;
  requesterCollegeId: string;
  pickupLocation: string;
  status: string;
  createdAt: string;
}

export interface AdminReportRow extends DemoReport {}

export interface AdminAnalytics {
  byBranch: Array<{ label: string; count: number }>;
  byOfferType: Array<{ label: string; count: number }>;
  byDiscrepancyType: Array<{ label: string; count: number }>;
  topBooks: Array<{
    id: string;
    title: string;
    author: string;
    branch: string;
    offerType: string;
    requestCount: number;
    viewsCount: number;
  }>;
}

export interface AdminWorkspace {
  stats: AdminStats;
  recentDiscrepancies: DiscrepancyItem[];
  recentLogs: AuditLogItem[];
  users: DemoUser[];
  listings: AdminListingRow[];
  requests: AdminRequestRow[];
  discrepancies: DiscrepancyItem[];
  reports: AdminReportRow[];
  logs: AuditLogItem[];
  team: TeamMember[];
  analytics: AdminAnalytics;
  settings: PlatformSettings;
  backups: BackupSnapshotSummary[];
}

const CAMPUS: Campus = {
  id: 'campus-mits',
  name: 'MITS Gwalior',
  domain: 'mitsgwalior.in',
  location: 'Gwalior, Madhya Pradesh',
};

const NOW = Date.now();
const dateDaysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const dateDaysFromNow = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: 'BookBack',
  campusName: CAMPUS.name,
  campusDomain: CAMPUS.domain,
  autoVerifyCampusEmail: true,
  maxActiveRequestsPerStudent: 5,
  failedLoginAlertThreshold: 5,
  quantityJumpAlertThreshold: 10,
  maintenanceBanner: '',
};

const DEFAULT_PERMISSIONS: TeamPermission[] = [
  'manage_books',
  'manage_requests',
  'investigate_discrepancies',
  'verify_users',
  'view_reports',
];

function makeUser(
  id: string,
  name: string,
  email: string,
  collegeId: string,
  branch: string,
  year: string,
  semester: number,
  role: User['role'] = 'student',
  permissions?: TeamPermission[],
): DemoUser {
  return {
    id,
    name,
    email,
    collegeId,
    branch,
    year,
    semester,
    campusId: CAMPUS.id,
    role,
    permissions: permissions || [],
    verified: role !== 'student' || email.endsWith(`@${CAMPUS.domain}`),
    isSuspended: false,
    suspensionReason: '',
    failedLoginAttempts: 0,
    themePreference: 'system',
    bio: '',
    createdAt: dateDaysAgo(90),
  };
}

function makeBook(
  id: string,
  owner: DemoUser,
  title: string,
  author: string,
  subject: string,
  branch: string,
  semester: number,
  offerType: OfferType,
  price: number,
  image: string,
  daysAgo: number,
  description: string,
  condition: BookListing['condition'] = 'Like New',
): BookListing {
  const ownerSummary: BookOwnerSummary = {
    id: owner.id,
    name: owner.name,
    branch: owner.branch,
    year: owner.year,
    semester: owner.semester,
    verified: owner.verified,
    bio: owner.bio,
  };
  return {
    id,
    ownerId: owner.id,
    owner: ownerSummary,
    campusId: CAMPUS.id,
    campusName: CAMPUS.name,
    title,
    author,
    subject,
    course: '',
    isbn: '',
    edition: '',
    branch,
    semester,
    condition,
    offerType,
    price,
    deposit: offerType === 'lend' ? 200 : 0,
    loanDurationDays: 30,
    quantity: 1,
    availableQuantity: 1,
    viewsCount: 22 + Math.floor(Math.random() * 45),
    requestCount: 1 + Math.floor(Math.random() * 7),
    description,
    images: [image],
    status: 'available',
    createdAt: dateDaysAgo(daysAgo),
  };
}

function makeInitialDatabase(): DemoDatabase {
  const users = [
    makeUser(
      'user-aarav',
      'Aarav Verma',
      'aarav.verma@mitsgwalior.in',
      '0901CS231014',
      'CSE',
      '3rd Year',
      6,
    ),
    makeUser(
      'user-priya',
      'Priya Nair',
      'priya.nair@mitsgwalior.in',
      '0901CS251042',
      'CSE',
      '1st Year',
      2,
    ),
    makeUser(
      'user-rohan',
      'Rohan Deshmukh',
      'rohan.d@mitsgwalior.in',
      '0901EC241019',
      'ECE',
      '2nd Year',
      4,
    ),
    makeUser(
      'user-meera',
      'Meera Kapoor',
      'meera.kapoor@mitsgwalior.in',
      '0901IT241027',
      'IT',
      '2nd Year',
      4,
    ),
    makeUser(
      'user-super-admin',
      'Campus Owner',
      'admin@mitsgwalior.in',
      'SUPER001',
      'CSE',
      '4th Year',
      8,
      'super_admin',
      DEFAULT_PERMISSIONS,
    ),
    makeUser(
      'user-team-admin',
      'Team Admin',
      'team.admin@mitsgwalior.in',
      'TEAM001',
      'CSE',
      '4th Year',
      8,
      'team_admin',
      ['manage_books', 'manage_requests', 'investigate_discrepancies'],
    ),
  ];
  users[0].bio = 'Final-year prep and core CS textbooks. Prefer midday handovers near the Central Library.';
  users[1].bio = 'Looking for engineering maths and data structures books.';
  users[2].bio = 'Electronics student sharing circuit analysis and signal texts.';
  users[3].bio = 'Happy to share reliable textbooks with fellow campus students.';

  const byId = (id: string) => users.find((user) => user.id === id)!;
  const books = [
    makeBook(
      'book-algorithms',
      byId('user-aarav'),
      'Introduction to Algorithms (CLRS)',
      'Thomas H. Cormen, Charles E. Leiserson',
      'Data Structures & Algorithms',
      'CSE',
      4,
      'sell',
      480,
      '/assets/images/book_cover_algorithms_1794567285119.jpg',
      1,
      'Clean hardcover edition with zero pen markings or torn pages. Used during Algorithms coursework.',
    ),
    makeBook(
      'book-circuits',
      byId('user-rohan'),
      'Fundamentals of Electric Circuits',
      'Charles K. Alexander, Matthew N. O. Sadiku',
      'Network Analysis & Circuits',
      'ECE',
      3,
      'lend',
      0,
      '/assets/images/book_cover_circuits_1794567285219.jpg',
      2,
      'Available to borrow for the mid-semester and end-semester cycle. Light pencil notes on chapter four.',
      'Good',
    ),
    makeBook(
      'book-calculus',
      byId('user-priya'),
      'Advanced Engineering Mathematics',
      'Erwin Kreyszig',
      'Mathematics & Calculus',
      'CSE',
      1,
      'donate',
      0,
      '/assets/images/book_cover_calculus_1794567285441.jpg',
      4,
      'Donating my first-year engineering mathematics textbook. Formula sheets intact and binding is sturdy.',
    ),
    makeBook(
      'book-economics',
      byId('user-meera'),
      'Principles of Economics',
      'N. Gregory Mankiw',
      'Economics & Management',
      'IT',
      5,
      'exchange',
      0,
      '/assets/images/book_cover_economics_1794567286864.jpg',
      5,
      'Open to exchanging for a sixth-semester Compiler Design or Computer Networks reference book.',
      'Good',
    ),
    makeBook(
      'book-discrete',
      byId('user-aarav'),
      'Discrete Mathematics and Its Applications',
      'Kenneth H. Rosen',
      'Discrete Mathematics',
      'CSE',
      3,
      'sell',
      320,
      '/assets/images/book_cover_calculus_1794567285441.jpg',
      8,
      'Well-kept copy with clean pages and clear chapter summaries.',
      'Good',
    ),
    makeBook(
      'book-data-structures',
      byId('user-priya'),
      'Data Structures Using C',
      'Reema Thareja',
      'Computer Science',
      'CSE',
      2,
      'sell',
      250,
      '/assets/images/book_cover_algorithms_1794567285119.jpg',
      10,
      'A handy reference for first-year programming labs and semester revision.',
      'Fair',
    ),
  ];

  const requests: BookRequest[] = [
    {
      id: 'request-incoming',
      listingId: 'book-algorithms',
      ownerId: 'user-aarav',
      requesterId: 'user-priya',
      offerType: 'sell',
      initialMessage: 'Hi Aarav, is the book still available? I can meet near the library.',
      pickupLocation: 'Central Library Reading Hall',
      status: 'pending',
      createdAt: dateDaysAgo(1),
      updatedAt: dateDaysAgo(1),
    },
    {
      id: 'request-outgoing',
      listingId: 'book-circuits',
      ownerId: 'user-rohan',
      requesterId: 'user-aarav',
      offerType: 'lend',
      initialMessage: 'Could I borrow this for the next four weeks?',
      pickupLocation: 'ECE Department Lobby',
      status: 'accepted',
      transaction: {
        id: 'transaction-active',
        status: 'active',
        agreedPrice: 0,
        startDate: dateDaysAgo(2),
        dueDate: dateDaysFromNow(28),
      },
      createdAt: dateDaysAgo(3),
      updatedAt: dateDaysAgo(2),
    },
    {
      id: 'request-completed',
      listingId: 'book-calculus',
      ownerId: 'user-priya',
      requesterId: 'user-rohan',
      offerType: 'donate',
      initialMessage: 'I would be grateful for this book if it is still available.',
      pickupLocation: 'Main Library Entrance',
      status: 'completed',
      transaction: {
        id: 'transaction-completed',
        status: 'completed',
        agreedPrice: 0,
        startDate: dateDaysAgo(20),
        completedAt: dateDaysAgo(14),
      },
      createdAt: dateDaysAgo(21),
      updatedAt: dateDaysAgo(14),
    },
  ];

  const discrepancies: DiscrepancyItem[] = [
    {
      id: 'discrepancy-quantity',
      issueId: 'BB-2026-001',
      type: 'quantity_anomaly',
      severity: 'medium',
      description: 'Listing quantity changed significantly in a short period; verify the inventory update.',
      relatedModel: 'BookListing',
      relatedRecordId: 'book-algorithms',
      relatedUser: { id: 'user-aarav', name: 'Aarav Verma', collegeId: '0901CS231014' },
      assignedAdminId: 'user-team-admin',
      assignedAdminName: 'Team Admin',
      status: 'investigating',
      investigationNotes: [],
      resolutionSummary: '',
      autoDetected: true,
      createdAt: dateDaysAgo(2),
      updatedAt: dateDaysAgo(1),
    },
    {
      id: 'discrepancy-duplicate',
      issueId: 'BB-2026-002',
      type: 'duplicate_listing',
      severity: 'low',
      description: 'Two similar textbook listings were flagged for a manual review.',
      relatedModel: 'BookListing',
      relatedRecordId: 'book-discrete',
      assignedAdminName: 'Unassigned',
      status: 'open',
      investigationNotes: [],
      resolutionSummary: '',
      autoDetected: true,
      createdAt: dateDaysAgo(5),
      updatedAt: dateDaysAgo(5),
    },
  ];

  const auditLogs: AuditLogItem[] = [
    {
      id: 'audit-seed',
      actorId: 'user-super-admin',
      actorName: 'Campus Owner',
      actorRole: 'super_admin',
      action: 'Initialized demo campus workspace',
      targetType: 'Platform',
      targetId: CAMPUS.id,
      details: 'Demo marketplace data prepared for local use.',
      reason: 'Initial local demo data',
      restorable: false,
      createdAt: dateDaysAgo(5),
    },
  ];

  const notifications: StoredNotification[] = [
    {
      id: 'notification-request',
      userId: 'user-aarav',
      type: 'new_request',
      title: 'New book request',
      message: 'Priya Nair requested Introduction to Algorithms (CLRS).',
      relatedRequestId: 'request-incoming',
      relatedListingId: 'book-algorithms',
      isRead: false,
      createdAt: dateDaysAgo(1),
    },
    {
      id: 'notification-accepted',
      userId: 'user-aarav',
      type: 'status_change',
      title: 'Request accepted',
      message: 'Rohan Deshmukh accepted your request for Fundamentals of Electric Circuits.',
      relatedRequestId: 'request-outgoing',
      relatedListingId: 'book-circuits',
      isRead: true,
      createdAt: dateDaysAgo(2),
    },
  ];

  const messages: RequestMessage[] = [
    {
      id: 'message-outgoing-1',
      requestId: 'request-outgoing',
      senderId: 'user-aarav',
      senderName: 'Aarav Verma',
      body: 'Could I borrow this for the next four weeks?',
      createdAt: dateDaysAgo(3),
    },
    {
      id: 'message-outgoing-2',
      requestId: 'request-outgoing',
      senderId: 'user-rohan',
      senderName: 'Rohan Deshmukh',
      body: 'Sure, I have accepted the request. Let us meet at the ECE lobby.',
      createdAt: dateDaysAgo(2),
    },
  ];

  const reviews: StoredReview[] = [
    {
      transactionId: 'transaction-completed',
      reviewerId: 'user-rohan',
      targetUserId: 'user-priya',
      review: {
        id: 'review-seed',
        rating: 5,
        comment: 'Very friendly and the book was exactly as described.',
        reviewerName: 'Rohan Deshmukh',
        reviewerBranch: 'ECE',
        createdAt: dateDaysAgo(13),
      },
    },
  ];

  return {
    users,
    books,
    requests,
    messages,
    notifications,
    reports: [
      {
        id: 'report-seed',
        listingId: 'book-circuits',
        reportedUserId: 'user-rohan',
        reason: 'Wrong Book Info',
        details: 'Please confirm the edition shown in the listing.',
        status: 'open',
        adminNote: '',
        reporterName: 'Priya Nair',
        listingTitle: 'Fundamentals of Electric Circuits',
        createdAt: dateDaysAgo(3),
      },
    ],
    discrepancies,
    auditLogs,
    settings: { ...DEFAULT_SETTINGS },
    backups: [],
    backupBooks: {},
    reviews,
  };
}

let memoryDatabase: DemoDatabase | null = null;

function readDatabase(): DemoDatabase {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDatabase;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.books)) {
        memoryDatabase = parsed;
        return parsed;
      }
    }
  } catch (error) {
    console.error('Could not read saved BookBack demo data:', error);
    throw new Error('Saved demo data could not be loaded. Clear BookBack demo data to reset it.');
  }
  if (!memoryDatabase) memoryDatabase = makeInitialDatabase();
  saveDatabase(memoryDatabase);
  return memoryDatabase;
}

function saveDatabase(database: DemoDatabase): void {
  memoryDatabase = database;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(database));
  } catch (error) {
    console.error('Could not save BookBack demo data:', error);
    throw new Error('Browser storage is full or unavailable. Remove some saved image data and retry.');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(STORE_EVENT));
  }
}

function updateDatabase<T>(updater: (database: DemoDatabase) => T): T {
  const database = readDatabase();
  const result = updater(database);
  saveDatabase(database);
  return result;
}

function newId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${randomPart}`;
}

function getUser(database: DemoDatabase, id: string): DemoUser | undefined {
  return database.users.find((user) => user.id === id);
}

function ownerSummary(user?: DemoUser): BookOwnerSummary | undefined {
  if (!user) return undefined;
  return {
    id: user.id,
    name: user.name,
    branch: user.branch,
    year: user.year,
    semester: user.semester,
    verified: user.verified,
    bio: user.bio,
  };
}

function hydrateBook(database: DemoDatabase, book: BookListing): BookListing {
  const owner = getUser(database, book.ownerId);
  return {
    ...book,
    owner: ownerSummary(owner),
    campusName: database.settings.campusName,
  };
}

function hydrateRequest(database: DemoDatabase, request: BookRequest): BookRequest {
  const listing = database.books.find((book) => book.id === request.listingId);
  const owner = getUser(database, request.ownerId);
  const requester = getUser(database, request.requesterId);
  return {
    ...request,
    listing: listing
      ? {
          id: listing.id,
          title: listing.title,
          author: listing.author,
          subject: listing.subject,
          offerType: listing.offerType,
          price: listing.price,
          status: listing.status,
          images: listing.images,
          loanDurationDays: listing.loanDurationDays,
          deposit: listing.deposit,
        }
      : undefined,
    owner: ownerSummary(owner),
    requester: ownerSummary(requester),
  };
}

function addNotification(
  database: DemoDatabase,
  userId: string,
  notification: Omit<StoredNotification, 'id' | 'userId' | 'createdAt' | 'isRead'>,
): void {
  database.notifications.unshift({
    ...notification,
    id: newId('notification'),
    userId,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

function appendAudit(
  database: DemoDatabase,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string,
  reason: string,
  previousValue?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null,
  restorable = false,
): AuditLogItem {
  const actor = getUser(database, actorId);
  const log: AuditLogItem = {
    id: newId('audit'),
    actorId,
    actorName: actor?.name || 'Demo Administrator',
    actorRole: actor?.role || 'super_admin',
    action,
    targetType,
    targetId,
    details,
    reason,
    previousValue,
    newValue,
    restorable,
    createdAt: new Date().toISOString(),
  };
  database.auditLogs.unshift(log);
  return log;
}

export function subscribeToLocalChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onChange = () => callback();
  window.addEventListener(STORE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(STORE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function getCurrentUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setCurrentUserId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Could not save the demo sign-in state:', error);
    throw new Error('Browser storage is unavailable; sign-in could not be saved.');
  }
}

export function getDemoUser(id: string): User | null {
  const user = getUser(readDatabase(), id);
  if (!user || user.isSuspended) return null;
  return user;
}

function createDemoUser(payload: {
  name: string;
  email: string;
  collegeId: string;
  branch: string;
  year: string;
  semester: number;
  campusId?: string;
}): DemoUser {
  const database = readDatabase();
  const user = makeUser(
    newId('user'),
    payload.name.trim(),
    payload.email.trim().toLowerCase(),
    payload.collegeId.trim().toUpperCase(),
    payload.branch,
    payload.year,
    payload.semester,
  );
  user.campusId = payload.campusId || CAMPUS.id;
  user.bio = 'New BookBack campus member.';
  database.users.push(user);
  saveDatabase(database);
  return user;
}

export function registerDemoUser(payload: {
  name: string;
  email: string;
  collegeId: string;
  branch: string;
  year: string;
  semester: number;
  campusId?: string;
  password: string;
}): User {
  if (payload.password.length < 8) throw new Error('Password must be at least 8 characters.');
  const database = readDatabase();
  const normalizedEmail = payload.email.trim().toLowerCase();
  const normalizedId = payload.collegeId.trim().toUpperCase();
  if (database.users.some((user) => user.email === normalizedEmail || user.collegeId === normalizedId)) {
    throw new Error('An account with that email or college ID already exists.');
  }
  return createDemoUser(payload);
}

export function loginDemoUser(identifier: string, password: string): User {
  if (!identifier.trim() || !password) throw new Error('Enter your account and password to continue.');
  const database = readDatabase();
  const normalizedIdentifier = identifier.trim().toLowerCase();
  let user = database.users.find(
    (candidate) =>
      candidate.email.toLowerCase() === normalizedIdentifier ||
      candidate.collegeId.toLowerCase() === normalizedIdentifier,
  );
  if (!user) {
    const email = normalizedIdentifier.includes('@')
      ? normalizedIdentifier
      : `${normalizedIdentifier.replace(/[^a-z0-9]+/g, '.')}@demo.${CAMPUS.domain}`;
    const displayName = email
      .split('@')[0]
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    user = makeUser(
      newId('user'),
      displayName || 'Demo Student',
      email,
      normalizedIdentifier.toUpperCase(),
      'CSE',
      '2nd Year',
      4,
    );
    user.bio = 'BookBack demo account.';
    database.users.push(user);
    saveDatabase(database);
  }
  if (user.isSuspended) throw new Error('This demo account is currently suspended.');
  return user;
}

export function getCampuses(): Campus[] {
  const database = readDatabase();
  return [{ ...CAMPUS, name: database.settings.campusName, domain: database.settings.campusDomain }];
}

export function getPlatformInfo(): { campusName: string; maintenanceBanner: string } {
  const settings = readDatabase().settings;
  return { campusName: settings.campusName, maintenanceBanner: settings.maintenanceBanner };
}

export function getSetupStatus(): { needsSetup: boolean; campusName: string; campusDomain: string } {
  const database = readDatabase();
  return {
    needsSetup: !database.users.some((user) => user.role === 'super_admin'),
    campusName: database.settings.campusName,
    campusDomain: database.settings.campusDomain,
  };
}

export function initializeDemoSetup(payload: Record<string, unknown>): User {
  return updateDatabase((database) => {
    if (database.users.some((user) => user.role === 'super_admin')) {
      throw new Error('Demo administration has already been initialized.');
    }
    const superAdmin = payload.superAdmin as
      | { name?: string; email?: string; collegeId?: string }
      | undefined;
    if (!superAdmin?.name || !superAdmin.email || !superAdmin.collegeId) {
      throw new Error('Complete the Main Owner details to initialize the demo.');
    }
    database.settings.campusName = String(payload.campusName || CAMPUS.name);
    database.settings.campusDomain = String(payload.campusDomain || CAMPUS.domain);
    const admin = makeUser(
      newId('user'),
      superAdmin.name,
      superAdmin.email,
      superAdmin.collegeId,
      'CSE',
      '4th Year',
      8,
      'super_admin',
      DEFAULT_PERMISSIONS,
    );
    database.users.push(admin);
    for (const key of ['teamAdmin1', 'teamAdmin2']) {
      const team = payload[key] as
        | {
            name?: string;
            email?: string;
            collegeId?: string;
            permissions?: TeamPermission[];
          }
        | undefined;
      if (team?.name && team.email && team.collegeId) {
        database.users.push(
          makeUser(
            newId('user'),
            team.name,
            team.email,
            team.collegeId,
            'CSE',
            '4th Year',
            8,
            'team_admin',
            team.permissions || DEFAULT_PERMISSIONS,
          ),
        );
      }
    }
    return admin;
  });
}

export function getBooks(filters: {
  query?: string;
  ownerId?: string;
  branch?: string;
  semester?: string | number;
  offerType?: string;
  condition?: string;
  status?: string;
  sort?: string;
  limit?: number;
} = {}): BookListing[] {
  const database = readDatabase();
  const search = filters.query?.trim().toLowerCase();
  let books = database.books.filter((book) => {
    if (filters.ownerId && book.ownerId !== filters.ownerId) return false;
    if (filters.status && filters.status !== 'all' && book.status !== filters.status) return false;
    if (!filters.ownerId && !filters.status && book.status !== 'available') return false;
    if (filters.branch && filters.branch !== 'all' && book.branch !== filters.branch) return false;
    if (filters.semester && filters.semester !== 'all' && book.semester !== Number(filters.semester)) return false;
    if (filters.offerType && filters.offerType !== 'all' && book.offerType !== filters.offerType) return false;
    if (filters.condition && filters.condition !== 'all' && book.condition !== filters.condition) return false;
    if (
      search &&
      ![book.title, book.author, book.subject, book.course, book.isbn].some((value) =>
        value.toLowerCase().includes(search),
      )
    ) {
      return false;
    }
    return true;
  });

  switch (filters.sort) {
    case 'popular':
      books = books.sort((a, b) => b.requestCount - a.requestCount || b.viewsCount - a.viewsCount);
      break;
    case 'price_asc':
      books = books.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      books = books.sort((a, b) => b.price - a.price);
      break;
    case 'semester_asc':
      books = books.sort((a, b) => a.semester - b.semester);
      break;
    default:
      books = books.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  if (filters.limit) books = books.slice(0, filters.limit);
  return books.map((book) => hydrateBook(database, book));
}

export function getBook(id: string, viewerId?: string): {
  book: BookListing;
  existingRequest: { id: string; status: string } | null;
} {
  const database = readDatabase();
  const book = database.books.find((item) => item.id === id);
  if (!book) throw new Error('Book listing not found.');
  book.viewsCount += 1;
  const existing = viewerId
    ? database.requests.find(
        (request) =>
          request.listingId === id &&
          request.requesterId === viewerId &&
          ['pending', 'accepted'].includes(request.status),
      )
    : undefined;
  saveDatabase(database);
  return {
    book: hydrateBook(database, book),
    existingRequest: existing ? { id: existing.id, status: existing.status } : null,
  };
}

export function saveBook(
  payload: Omit<Partial<BookListing>, 'id'> & Pick<BookListing, 'title' | 'author' | 'subject'>,
  ownerId: string,
  bookId?: string,
): BookListing {
  const database = readDatabase();
  const existing = bookId ? database.books.find((book) => book.id === bookId) : undefined;
  if (bookId && (!existing || (existing.ownerId !== ownerId && !getUser(database, ownerId)?.role.includes('admin')))) {
    throw new Error('This listing is unavailable for editing.');
  }
  const now = new Date().toISOString();
  const next: BookListing = {
    id: existing?.id || newId('book'),
    ownerId: existing?.ownerId || ownerId,
    owner: ownerSummary(getUser(database, existing?.ownerId || ownerId)),
    campusId: CAMPUS.id,
    campusName: database.settings.campusName,
    title: payload.title,
    author: payload.author,
    subject: payload.subject,
    course: payload.course || '',
    isbn: payload.isbn || '',
    edition: payload.edition || '',
    branch: payload.branch || getUser(database, ownerId)?.branch || 'CSE',
    semester: payload.semester || 4,
    condition: payload.condition || 'Like New',
    offerType: payload.offerType || 'sell',
    price: payload.offerType === 'sell' ? Number(payload.price) || 0 : 0,
    deposit: payload.offerType === 'lend' ? Number(payload.deposit) || 0 : 0,
    loanDurationDays: Number(payload.loanDurationDays) || 30,
    quantity: Math.max(1, Number(payload.quantity) || 1),
    availableQuantity: payload.availableQuantity ?? Math.max(1, Number(payload.quantity) || 1),
    viewsCount: existing?.viewsCount || 0,
    requestCount: existing?.requestCount || 0,
    description: payload.description || '',
    images: payload.images?.length ? payload.images : ['/assets/images/book_cover_algorithms_1794567285119.jpg'],
    status: payload.status || 'available',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (existing) Object.assign(existing, next);
  else database.books.unshift(next);
  saveDatabase(database);
  return hydrateBook(database, next);
}

export function updateBookStatus(bookId: string, status: BookListing['status']): void {
  updateDatabase((database) => {
    const book = database.books.find((item) => item.id === bookId);
    if (!book) throw new Error('Book listing not found.');
    book.status = status;
    book.updatedAt = new Date().toISOString();
  });
}

export function deleteBook(bookId: string, ownerId: string): void {
  updateDatabase((database) => {
    const book = database.books.find((item) => item.id === bookId);
    if (!book || (book.ownerId !== ownerId && !getUser(database, ownerId)?.role.includes('admin'))) {
      throw new Error('This listing is unavailable for removal.');
    }
    book.status = 'deactivated';
    book.availableQuantity = 0;
  });
}

export function getRequests(userId: string, direction: 'all' | 'incoming' | 'outgoing' = 'all'): BookRequest[] {
  const database = readDatabase();
  return database.requests
    .filter((request) => {
      if (request.ownerId !== userId && request.requesterId !== userId) return false;
      if (direction === 'incoming') return request.ownerId === userId;
      if (direction === 'outgoing') return request.requesterId === userId;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((request) => hydrateRequest(database, request));
}

export function getRequestDetails(requestId: string, userId: string): {
  request: BookRequest;
  messages: RequestMessage[];
  hasReviewed: boolean;
} {
  const database = readDatabase();
  const request = database.requests.find((item) => item.id === requestId);
  if (!request || (request.ownerId !== userId && request.requesterId !== userId)) {
    throw new Error('Request conversation not found.');
  }
  const transactionId = request.transaction?.id;
  return {
    request: hydrateRequest(database, request),
    messages: database.messages
      .filter((message) => message.requestId === requestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    hasReviewed: Boolean(
      transactionId && database.reviews.some((review) => review.transactionId === transactionId && review.reviewerId === userId),
    ),
  };
}

export function createBookRequest(
  listingId: string,
  requesterId: string,
  message: string,
  pickupLocation: string,
): BookRequest {
  return updateDatabase((database) => {
    const book = database.books.find((item) => item.id === listingId && item.status === 'available');
    const requester = getUser(database, requesterId);
    if (!book || !requester) throw new Error('This listing is no longer available.');
    if (book.ownerId === requesterId) throw new Error('You cannot request your own listing.');
    const duplicate = database.requests.find(
      (request) =>
        request.listingId === listingId &&
        request.requesterId === requesterId &&
        ['pending', 'accepted'].includes(request.status),
    );
    if (duplicate) throw new Error('You already have an active request for this book.');

    const request: BookRequest = {
      id: newId('request'),
      listingId,
      ownerId: book.ownerId,
      requesterId,
      offerType: book.offerType,
      initialMessage: message,
      pickupLocation,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    database.requests.unshift(request);
    book.requestCount += 1;
    database.messages.push({
      id: newId('message'),
      requestId: request.id,
      senderId: requester.id,
      senderName: requester.name,
      body: message,
      createdAt: request.createdAt,
    });
    addNotification(database, book.ownerId, {
      type: 'new_request',
      title: 'New book request',
      message: `${requester.name} requested ${book.title}.`,
      relatedRequestId: request.id,
      relatedListingId: book.id,
    });
    return hydrateRequest(database, request);
  });
}

export function submitReport(
  reporterId: string,
  listingId: string,
  reportedUserId: string,
  reason: string,
  details: string,
): void {
  updateDatabase((database) => {
    const listing = database.books.find((book) => book.id === listingId);
    const reporter = getUser(database, reporterId);
    if (!listing || !reporter) throw new Error('Report could not be saved.');
    database.reports.unshift({
      id: newId('report'),
      listingId,
      reportedUserId,
      reason,
      details,
      status: 'open',
      adminNote: '',
      reporterName: reporter.name,
      listingTitle: listing.title,
      createdAt: new Date().toISOString(),
    });
  });
}

export function sendRequestMessage(requestId: string, senderId: string, body: string): RequestMessage {
  return updateDatabase((database) => {
    const request = database.requests.find((item) => item.id === requestId);
    const sender = getUser(database, senderId);
    if (!request || !sender || (request.ownerId !== senderId && request.requesterId !== senderId)) {
      throw new Error('Request conversation not found.');
    }
    const message: RequestMessage = {
      id: newId('message'),
      requestId,
      senderId,
      senderName: sender.name,
      body,
      createdAt: new Date().toISOString(),
    };
    database.messages.push(message);
    const recipientId = senderId === request.ownerId ? request.requesterId : request.ownerId;
    addNotification(database, recipientId, {
      type: 'new_message',
      title: 'New request message',
      message: `${sender.name} sent a message about ${database.books.find((book) => book.id === request.listingId)?.title || 'a book listing'}.`,
      relatedRequestId: request.id,
      relatedListingId: request.listingId,
    });
    return message;
  });
}

export function updateRequestStatus(requestId: string, userId: string, status: BookRequest['status']): void {
  updateDatabase((database) => {
    const request = database.requests.find((item) => item.id === requestId);
    if (!request || (request.ownerId !== userId && request.requesterId !== userId)) {
      throw new Error('Request not found.');
    }
    request.status = status;
    request.updatedAt = new Date().toISOString();
    if (status === 'accepted' && !request.transaction) {
      request.transaction = {
        id: newId('transaction'),
        status: 'active',
        agreedPrice: database.books.find((book) => book.id === request.listingId)?.price || 0,
        startDate: new Date().toISOString(),
        dueDate: dateDaysFromNow(30),
      };
    }
    if (status === 'cancelled' || status === 'rejected') {
      if (request.transaction) request.transaction.status = 'cancelled';
    }
    const actor = getUser(database, userId);
    const targetId = userId === request.ownerId ? request.requesterId : request.ownerId;
    addNotification(database, targetId, {
      type: 'status_change',
      title: 'Request status updated',
      message: `${actor?.name || 'A student'} ${status} your book request.`,
      relatedRequestId: request.id,
      relatedListingId: request.listingId,
    });
  });
}

export function completeTransaction(transactionId: string, userId: string): void {
  updateDatabase((database) => {
    const request = database.requests.find((item) => item.transaction?.id === transactionId);
    if (!request || (request.ownerId !== userId && request.requesterId !== userId) || !request.transaction) {
      throw new Error('Active handover not found.');
    }
    request.status = 'completed';
    request.transaction.status = 'completed';
    request.transaction.completedAt = new Date().toISOString();
    request.updatedAt = new Date().toISOString();
    const targetId = userId === request.ownerId ? request.requesterId : request.ownerId;
    addNotification(database, targetId, {
      type: 'status_change',
      title: 'Handover completed',
      message: 'A campus handover has been marked complete.',
      relatedRequestId: request.id,
      relatedListingId: request.listingId,
    });
  });
}

export function submitTransactionReview(
  transactionId: string,
  reviewerId: string,
  rating: number,
  comment: string,
): void {
  updateDatabase((database) => {
    const request = database.requests.find((item) => item.transaction?.id === transactionId);
    if (!request || request.status !== 'completed') throw new Error('Complete a handover before reviewing it.');
    if (database.reviews.some((review) => review.transactionId === transactionId && review.reviewerId === reviewerId)) {
      throw new Error('You have already reviewed this handover.');
    }
    const targetUserId = reviewerId === request.ownerId ? request.requesterId : request.ownerId;
    const reviewer = getUser(database, reviewerId);
    database.reviews.push({
      transactionId,
      reviewerId,
      targetUserId,
      review: {
        id: newId('review'),
        rating,
        comment,
        reviewerName: reviewer?.name || 'Campus Student',
        reviewerBranch: reviewer?.branch || 'CSE',
        createdAt: new Date().toISOString(),
      },
    });
  });
}

export function getNotifications(userId: string): AppNotification[] {
  return readDatabase()
    .notifications.filter((notification) => notification.userId === userId)
    .map(({ userId: _userId, ...notification }) => notification);
}

export function getUnreadCount(userId: string): number {
  return readDatabase().notifications.filter((notification) => notification.userId === userId && !notification.isRead).length;
}

export function markNotificationRead(userId: string, notificationId?: string): void {
  updateDatabase((database) => {
    for (const notification of database.notifications) {
      if (notification.userId === userId && (!notificationId || notification.id === notificationId)) {
        notification.isRead = true;
      }
    }
  });
}

export function getProfileData(userId: string): {
  profile: StudentPublicProfile;
  listings: BookListing[];
  reviews: ProfileReview[];
} {
  const database = readDatabase();
  const user = getUser(database, userId);
  if (!user) throw new Error('Student profile not found.');
  const reviews = database.reviews
    .filter((entry) => entry.targetUserId === userId)
    .map((entry) => entry.review);
  const averageRating = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : null;
  const completedTransactions = database.requests.filter(
    (request) =>
      request.status === 'completed' && (request.ownerId === userId || request.requesterId === userId),
  ).length;
  return {
    profile: {
      id: user.id,
      name: user.name,
      branch: user.branch,
      year: user.year,
      semester: user.semester,
      verified: user.verified,
      bio: user.bio,
      campusName: database.settings.campusName,
      createdAt: user.createdAt,
      completedTransactions,
      averageRating,
      reviewCount: reviews.length,
    },
    listings: database.books
      .filter((book) => book.ownerId === userId && book.status === 'available')
      .map((book) => hydrateBook(database, book)),
    reviews,
  };
}

export function updateProfile(userId: string, changes: Partial<User>): User {
  return updateDatabase((database) => {
    const user = getUser(database, userId);
    if (!user) throw new Error('Profile not found.');
    Object.assign(user, changes);
    const summary = ownerSummary(user);
    for (const book of database.books) {
      if (book.ownerId === userId) book.owner = summary;
    }
    return user;
  });
}

export function updateThemePreference(userId: string, themePreference: User['themePreference']): void {
  updateProfile(userId, { themePreference });
}

export function getAdminWorkspace(): AdminWorkspace {
  const database = readDatabase();
  const users = database.users;
  const listings: AdminListingRow[] = database.books.map((book) => {
    const owner = getUser(database, book.ownerId);
    return {
      ...hydrateBook(database, book),
      ownerName: owner?.name || 'Campus Student',
      ownerCollegeId: owner?.collegeId || '',
    };
  });
  const requests: AdminRequestRow[] = database.requests.map((request) => {
    const populated = hydrateRequest(database, request);
    const owner = getUser(database, request.ownerId);
    const requester = getUser(database, request.requesterId);
    return {
      id: request.id,
      listingId: request.listingId,
      bookTitle: populated.listing?.title || 'Book Listing',
      offerType: request.offerType,
      ownerName: owner?.name || 'Campus Student',
      ownerCollegeId: owner?.collegeId || '',
      requesterName: requester?.name || 'Campus Student',
      requesterCollegeId: requester?.collegeId || '',
      pickupLocation: request.pickupLocation,
      status: request.status,
      createdAt: request.createdAt,
    };
  });
  const activeBooks = database.books.filter((book) => book.status === 'available');
  const stats: AdminStats = {
    totalUsers: users.length,
    verifiedUsers: users.filter((user) => user.verified).length,
    suspendedUsers: users.filter((user) => user.isSuspended).length,
    totalListings: database.books.length,
    activeListings: activeBooks.length,
    totalRequests: database.requests.length,
    completedTransactions: database.requests.filter((request) => request.status === 'completed').length,
    openReports: database.reports.filter((report) => report.status === 'open').length,
    openDiscrepancies: database.discrepancies.filter((item) => ['open', 'investigating'].includes(item.status)).length,
    teamAdminsCount: users.filter((user) => user.role === 'team_admin').length,
  };
  const byBranch = [...new Set(activeBooks.map((book) => book.branch))].map((label) => ({
    label,
    count: activeBooks.filter((book) => book.branch === label).length,
  }));
  const offerTypes: OfferType[] = ['sell', 'lend', 'donate', 'exchange'];
  const analytics: AdminAnalytics = {
    byBranch,
    byOfferType: offerTypes.map((label) => ({
      label,
      count: activeBooks.filter((book) => book.offerType === label).length,
    })),
    byDiscrepancyType: [...new Set(database.discrepancies.map((item) => item.type))].map((label) => ({
      label,
      count: database.discrepancies.filter((item) => item.type === label).length,
    })),
    topBooks: [...database.books]
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 5)
      .map(({ id, title, author, branch, offerType, requestCount, viewsCount }) => ({
        id,
        title,
        author,
        branch,
        offerType,
        requestCount,
        viewsCount,
      })),
  };
  return {
    stats,
    recentDiscrepancies: database.discrepancies.slice(0, 5),
    recentLogs: database.auditLogs.slice(0, 5),
    users,
    listings,
    requests,
    discrepancies: database.discrepancies,
    reports: database.reports,
    logs: database.auditLogs,
    team: users
      .filter((user) => user.role === 'team_admin')
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        collegeId: user.collegeId,
        role: user.role,
        permissions: user.permissions || [],
        isSuspended: user.isSuspended,
        createdAt: user.createdAt,
      })),
    analytics,
    settings: database.settings,
    backups: database.backups,
  };
}

export function updateAdminUser(
  actorId: string,
  userId: string,
  changes: { verified?: boolean; isSuspended?: boolean; suspensionReason?: string; reason: string },
): void {
  updateDatabase((database) => {
    const user = getUser(database, userId);
    if (!user) throw new Error('User not found.');
    const previous = { verified: user.verified, isSuspended: user.isSuspended };
    if (changes.verified !== undefined) user.verified = changes.verified;
    if (changes.isSuspended !== undefined) user.isSuspended = changes.isSuspended;
    appendAudit(database, actorId, 'Updated student account', 'User', userId, user.name, changes.reason, previous, {
      verified: user.verified,
      isSuspended: user.isSuspended,
    });
  });
}

export function updateAdminListing(
  actorId: string,
  bookId: string,
  changes: Partial<BookListing> & { reason: string },
  remove = false,
): void {
  updateDatabase((database) => {
    const book = database.books.find((item) => item.id === bookId);
    if (!book) throw new Error('Book listing not found.');
    const previous = { ...book };
    if (remove) {
      database.books = database.books.filter((item) => item.id !== bookId);
    } else {
      const { reason, ...updates } = changes;
      Object.assign(book, updates, { updatedAt: new Date().toISOString() });
      void reason;
    }
    appendAudit(
      database,
      actorId,
      remove ? 'Deleted book listing' : 'Corrected book listing',
      'BookListing',
      bookId,
      book.title,
      changes.reason,
      previous,
      remove ? null : { ...book },
      true,
    );
  });
}

export function updateAdminRequest(
  actorId: string,
  requestId: string,
  changes: { status: BookRequest['status']; pickupLocation: string; reason: string },
): void {
  updateDatabase((database) => {
    const request = database.requests.find((item) => item.id === requestId);
    if (!request) throw new Error('Request not found.');
    const previous = { status: request.status, pickupLocation: request.pickupLocation };
    request.status = changes.status;
    request.pickupLocation = changes.pickupLocation;
    request.updatedAt = new Date().toISOString();
    appendAudit(database, actorId, 'Corrected borrowing request', 'BookRequest', requestId, request.id, changes.reason, previous, {
      status: request.status,
      pickupLocation: request.pickupLocation,
    });
  });
}

export function runLocalDiscrepancyScan(): { message: string; createdOrUpdated: number } {
  const database = readDatabase();
  const duplicateGroups = new Map<string, BookListing[]>();
  for (const book of database.books.filter((item) => item.status === 'available')) {
    const key = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`;
    duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), book]);
  }
  let createdOrUpdated = 0;
  for (const group of duplicateGroups.values()) {
    if (group.length > 1) createdOrUpdated += 1;
  }
  appendAudit(
    database,
    'user-super-admin',
    'Ran local consistency scan',
    'Platform',
    'catalog',
    `${createdOrUpdated} potential issue(s) flagged.`,
    'Manual demo scan',
  );
  saveDatabase(database);
  return { message: 'Local consistency scan complete.', createdOrUpdated };
}

export function updateAdminDiscrepancy(
  actorId: string,
  discrepancyId: string,
  changes: Partial<DiscrepancyItem> & { reason: string },
): void {
  updateDatabase((database) => {
    const discrepancy = database.discrepancies.find((item) => item.id === discrepancyId);
    if (!discrepancy) throw new Error('Discrepancy not found.');
    const { reason, ...updates } = changes;
    const previous = { ...discrepancy };
    Object.assign(discrepancy, updates, { updatedAt: new Date().toISOString() });
    appendAudit(database, actorId, 'Updated discrepancy review', 'Discrepancy', discrepancyId, discrepancy.issueId, reason, previous, {
      ...discrepancy,
    });
  });
}

export function addDiscrepancyNote(actorId: string, discrepancyId: string, note: string): void {
  updateDatabase((database) => {
    const discrepancy = database.discrepancies.find((item) => item.id === discrepancyId);
    if (!discrepancy) throw new Error('Discrepancy not found.');
    const actor = getUser(database, actorId);
    discrepancy.investigationNotes.push({
      adminId: actorId,
      adminName: actor?.name || 'Demo Administrator',
      note,
      createdAt: new Date().toISOString(),
    });
    discrepancy.updatedAt = new Date().toISOString();
  });
}

export function createDemoTeamAdmin(
  actorId: string,
  input: {
    name: string;
    email: string;
    collegeId: string;
    permissions: TeamPermission[];
    reason: string;
  },
): void {
  updateDatabase((database) => {
    const email = input.email.trim().toLowerCase();
    const collegeId = input.collegeId.trim().toUpperCase();
    if (database.users.some((user) => user.email === email || user.collegeId === collegeId)) {
      throw new Error('A demo account with that email or staff ID already exists.');
    }
    const newUser = makeUser(
      newId('user'),
      input.name,
      email,
      collegeId,
      'CSE',
      '4th Year',
      8,
      'team_admin',
      input.permissions,
    );
    database.users.push(newUser);
    appendAudit(database, actorId, 'Created team admin', 'User', newUser.id, newUser.name, input.reason);
  });
}

export function updateDemoTeamAdmin(
  actorId: string,
  userId: string,
  changes: { permissions: TeamPermission[]; isSuspended: boolean; reason: string },
): void {
  updateDatabase((database) => {
    const user = getUser(database, userId);
    if (!user || user.role !== 'team_admin') throw new Error('Team admin not found.');
    const previous = { permissions: user.permissions, isSuspended: user.isSuspended };
    user.permissions = changes.permissions;
    user.isSuspended = changes.isSuspended;
    appendAudit(database, actorId, 'Updated team admin', 'User', user.id, user.name, changes.reason, previous, {
      permissions: user.permissions,
      isSuspended: user.isSuspended,
    });
  });
}

export function updatePlatformSettings(
  actorId: string,
  changes: PlatformSettings,
  reason: string,
): void {
  updateDatabase((database) => {
    const previous = { ...database.settings };
    database.settings = { ...changes };
    appendAudit(database, actorId, 'Updated platform settings', 'PlatformSettings', 'settings', changes.siteName, reason, previous, {
      ...changes,
    });
  });
}

export function createLocalBackup(actorId: string, label?: string): BackupSnapshotSummary {
  return updateDatabase((database) => {
    const snapshot: BackupSnapshotSummary = {
      id: newId('backup'),
      label: label?.trim() || `Local snapshot ${new Date().toLocaleString()}`,
      createdByName: getUser(database, actorId)?.name || 'Demo Administrator',
      counts: {
        users: database.users.length,
        books: database.books.length,
        requests: database.requests.length,
        transactions: database.requests.filter((request) => request.transaction).length,
        discrepancies: database.discrepancies.length,
        auditLogs: database.auditLogs.length,
      },
      createdAt: new Date().toISOString(),
    };
    database.backups.unshift(snapshot);
    database.backupBooks[snapshot.id] = database.books.map((book) => ({ ...book }));
    return snapshot;
  });
}

export function restoreLocalBackup(actorId: string, backupId: string, reason: string): void {
  updateDatabase((database) => {
    const snapshot = database.backups.find((backup) => backup.id === backupId);
    const books = database.backupBooks[backupId];
    if (!snapshot || !books) throw new Error('Backup snapshot not found.');
    database.books = books.map((book) => ({ ...book }));
    appendAudit(database, actorId, 'Restored local backup', 'Backup', backupId, snapshot.label, reason);
  });
}

export function downloadLocalBackup(backupId: string): string {
  const database = readDatabase();
  const backup = database.backups.find((item) => item.id === backupId);
  const books = database.backupBooks[backupId];
  if (!backup || !books) throw new Error('Backup snapshot not found.');
  return JSON.stringify({ backup, books }, null, 2);
}

export function restoreAuditRecord(actorId: string, logId: string, reason: string): void {
  updateDatabase((database) => {
    const log = database.auditLogs.find((item) => item.id === logId);
    if (!log || !log.restorable || !log.previousValue) throw new Error('This activity record cannot be restored.');
    if (log.targetType === 'BookListing') {
      const previous = log.previousValue as Partial<BookListing>;
      const currentIndex = database.books.findIndex((book) => book.id === log.targetId);
      if (currentIndex >= 0) database.books[currentIndex] = { ...database.books[currentIndex], ...previous };
      else if (previous.id && previous.title) database.books.push(previous as BookListing);
    }
    log.restorable = false;
    log.restoredAt = new Date().toISOString();
    appendAudit(database, actorId, 'Restored previous record state', log.targetType, log.targetId, log.details, reason);
  });
}

export function updateAdminReport(actorId: string, reportId: string, status: string, adminNote: string): void {
  updateDatabase((database) => {
    const report = database.reports.find((item) => item.id === reportId);
    if (!report) throw new Error('Student report not found.');
    report.status = status;
    report.adminNote = adminNote;
    appendAudit(database, actorId, 'Updated student report', 'Report', reportId, report.reason, adminNote);
  });
}

export function downloadAdminExport(type: 'books' | 'requests' | 'discrepancies' | 'audit'): string {
  const database = readDatabase();
  const rows = (
    type === 'books'
      ? database.books
      : type === 'requests'
        ? database.requests
        : type === 'discrepancies'
          ? database.discrepancies
          : database.auditLogs
  ).map((row) => JSON.parse(JSON.stringify(row)) as Record<string, unknown>);
  if (!rows.length) return 'No records available.\n';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return `${headers.map(escape).join(',')}\r\n${rows
    .map((row) => headers.map((header) => escape(row[header])).join(','))
    .join('\r\n')}\r\n`;
}

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a valid image file.');
  if (file.size > 4 * 1024 * 1024) throw new Error('Image must be smaller than 4 MB.');

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the image.')));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('The selected file is not a readable image.'));
    element.src = source;
  });
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the image for local storage.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}
