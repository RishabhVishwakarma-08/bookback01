import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardList,
  Database,
  Download,
  FileCheck,
  LayoutDashboard,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  addDiscrepancyNote,
  createDemoTeamAdmin,
  createLocalBackup,
  downloadAdminExport,
  downloadLocalBackup,
  getAdminWorkspace,
  restoreAuditRecord,
  restoreLocalBackup,
  runLocalDiscrepancyScan,
  updateAdminDiscrepancy,
  updateAdminListing,
  updateAdminReport,
  updateAdminRequest,
  updateAdminUser,
  updateDemoTeamAdmin,
  updatePlatformSettings,
} from '../data/localStore';
import type {
  AdminStats,
  AuditLogItem,
  BackupSnapshotSummary,
  BookListing,
  BookRequest,
  DiscrepancyItem,
  PlatformSettings,
  TeamMember,
  TeamPermission,
} from '../types';

interface AdminPageProps {
  onNavigate: (path: string) => void;
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'books'
  | 'requests'
  | 'discrepancies'
  | 'audit'
  | 'team'
  | 'analytics'
  | 'settings';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  collegeId: string;
  branch: string;
  year: string;
  role: string;
  permissions: TeamPermission[];
  verified: boolean;
  isSuspended: boolean;
  suspensionReason: string;
  failedLoginAttempts: number;
}

interface AdminListingRow {
  id: string;
  title: string;
  author: string;
  subject: string;
  branch: string;
  semester: number;
  offerType: string;
  price: number;
  quantity: number;
  availableQuantity: number;
  viewsCount: number;
  requestCount: number;
  status: string;
  ownerName: string;
  ownerCollegeId: string;
}

interface AdminRequestRow {
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

interface AdminReportRow {
  id: string;
  reason: string;
  details: string;
  status: string;
  adminNote: string;
  reporterName: string;
  listingTitle?: string;
  createdAt: string;
}

interface AnalyticsData {
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

const ALL_PERMISSIONS: Array<{ key: TeamPermission; label: string }> = [
  { key: 'manage_books', label: 'Manage & correct books' },
  { key: 'manage_requests', label: 'Manage borrowing requests' },
  { key: 'investigate_discrepancies', label: 'Investigate discrepancies' },
  { key: 'verify_users', label: 'Verify / suspend students' },
  { key: 'view_reports', label: 'View analytics & export CSV' },
];

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { user, logout, loading: authLoading, isAdmin, isSuperAdmin, hasPermission } = useAuth();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Core data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentDiscrepancies, setRecentDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [listings, setListings] = useState<AdminListingRow[]>([]);
  const [requests, setRequests] = useState<AdminRequestRow[]>([]);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [backups, setBackups] = useState<BackupSnapshotSummary[]>([]);

  // Modals & forms
  const [reasonModal, setReasonModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: (reason: string) => Promise<void>;
  } | null>(null);
  const [modalReason, setModalReason] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const [editingBook, setEditingBook] = useState<AdminListingRow | null>(null);
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    subject: '',
    price: 0,
    quantity: 1,
    availableQuantity: 1,
    status: 'available',
    reason: '',
  });

  const [editingRequest, setEditingRequest] = useState<AdminRequestRow | null>(null);
  const [requestForm, setRequestForm] = useState({
    status: 'pending',
    pickupLocation: '',
    reason: '',
  });

  const [inspectingDiscrepancy, setInspectingDiscrepancy] = useState<DiscrepancyItem | null>(null);
  const [discrepancyForm, setDiscrepancyForm] = useState({
    status: 'investigating' as DiscrepancyItem['status'],
    assignedAdminId: '',
    resolutionSummary: '',
    reason: '',
    note: '',
  });

  const [newTeamForm, setNewTeamForm] = useState({
    name: '',
    email: '',
    collegeId: '',
    password: '',
    permissions: ['manage_books', 'manage_requests', 'investigate_discrepancies'] as TeamPermission[],
    reason: '',
  });

  const [editingTeamMember, setEditingTeamMember] = useState<TeamMember | null>(null);
  const [teamEditPerms, setTeamEditPerms] = useState<TeamPermission[]>([]);
  const [teamEditSuspended, setTeamEditSuspended] = useState(false);
  const [teamEditReason, setTeamEditReason] = useState('');

  const [settingsReason, setSettingsReason] = useState('');
  const [backupLabel, setBackupLabel] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      onNavigate('/');
    }
  }, [authLoading, user, isAdmin, onNavigate]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4000);
  };

  const loadAll = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const workspace = getAdminWorkspace();
      setStats(workspace.stats);
      setRecentDiscrepancies(workspace.recentDiscrepancies);
      setRecentLogs(workspace.recentLogs);
      setUsers(workspace.users);
      setListings(workspace.listings);
      setRequests(workspace.requests);
      setDiscrepancies(workspace.discrepancies);
      setReports(workspace.reports);
      setAuditLogs(workspace.logs);
      setTeam(workspace.team);
      setAnalytics(workspace.analytics);
      setSettings(workspace.settings);
      setBackups(workspace.backups);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, isSuperAdmin, hasPermission]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openReasonPrompt = (
    title: string,
    description: string,
    confirmLabel: string,
    onConfirm: (reason: string) => Promise<void>,
    danger = false,
  ) => {
    setModalReason('');
    setReasonModal({ title, description, confirmLabel, onConfirm, danger });
  };

  const handleConfirmReasonModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonModal) return;
    if (modalReason.trim().length < 5) {
      setError('Please enter a mandatory administrative reason (at least 5 characters).');
      return;
    }
    setModalSubmitting(true);
    setError('');
    try {
      await reasonModal.onConfirm(modalReason.trim());
      setReasonModal(null);
      setModalReason('');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleBookEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    setError('');
    try {
      updateAdminListing(user!.id, editingBook.id, {
        title: bookForm.title,
        author: bookForm.author,
        subject: bookForm.subject,
        price: Number(bookForm.price),
        quantity: Number(bookForm.quantity),
        availableQuantity: Number(bookForm.availableQuantity),
        status: bookForm.status as BookListing['status'],
        reason: bookForm.reason,
      });
      setEditingBook(null);
      showToast('Book listing updated and recorded in Activity Logs.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update listing.');
    }
  };

  const handleRequestEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    setError('');
    try {
      updateAdminRequest(user!.id, editingRequest.id, {
        status: requestForm.status as BookRequest['status'],
        pickupLocation: requestForm.pickupLocation,
        reason: requestForm.reason,
      });
      setEditingRequest(null);
      showToast('Borrowing request corrected and logged.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update borrowing request.');
    }
  };

  const handleRunScan = async () => {
    setError('');
    try {
      const res = runLocalDiscrepancyScan();
      showToast(`${res.message} Flagged/updated ${res.createdOrUpdated} items.`);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Consistency scan failed.');
    }
  };

  const handleDiscrepancySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingDiscrepancy) return;
    setError('');
    try {
      updateAdminDiscrepancy(user!.id, inspectingDiscrepancy.id, {
        status: discrepancyForm.status,
        assignedAdminId: discrepancyForm.assignedAdminId || null,
        resolutionSummary: discrepancyForm.resolutionSummary,
        reason: discrepancyForm.reason,
      });
      if (discrepancyForm.note.trim().length >= 3) {
        addDiscrepancyNote(user!.id, inspectingDiscrepancy.id, discrepancyForm.note.trim());
      }
      setInspectingDiscrepancy(null);
      showToast('Discrepancy investigation updated.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update discrepancy.');
    }
  };

  const handleAddNoteOnly = async () => {
    if (!inspectingDiscrepancy || discrepancyForm.note.trim().length < 3) return;
    setError('');
    try {
      addDiscrepancyNote(user!.id, inspectingDiscrepancy.id, discrepancyForm.note.trim());
      setDiscrepancyForm((prev) => ({ ...prev, note: '' }));
      showToast('Investigation note appended.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to append note.');
    }
  };

  const handleCreateTeamAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      createDemoTeamAdmin(user!.id, newTeamForm);
      setNewTeamForm({
        name: '',
        email: '',
        collegeId: '',
        password: '',
        permissions: ['manage_books', 'manage_requests', 'investigate_discrepancies'],
        reason: '',
      });
      showToast('Team Admin account created and logged.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to create team admin.');
    }
  };

  const handleUpdateTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeamMember) return;
    setError('');
    try {
      updateDemoTeamAdmin(user!.id, editingTeamMember.id, {
        permissions: teamEditPerms,
        isSuspended: teamEditSuspended,
        reason: teamEditReason,
      });
      setEditingTeamMember(null);
      showToast('Team Admin permissions/status updated.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update team member.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setError('');
    try {
      updatePlatformSettings(user!.id, settings, settingsReason);
      setSettingsReason('');
      showToast('Platform security settings saved.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to update platform settings.');
    }
  };

  const handleCreateBackup = async () => {
    setError('');
    try {
      createLocalBackup(user!.id, backupLabel.trim() || undefined);
      setBackupLabel('');
      showToast('Database backup snapshot created.');
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Failed to create backup.');
    }
  };

  const handleDownload = (content: string, filename: string, contentType: string) => {
    setError('');
    try {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  if (!user || !isAdmin) return null;

  const navItems: Array<{
    key: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    visible: boolean;
    badge?: number;
  }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard, visible: true },
    { key: 'users', label: 'User Management', icon: Users, visible: true, badge: users.length },
    { key: 'books', label: 'Book Management', icon: BookOpen, visible: true, badge: listings.length },
    {
      key: 'requests',
      label: 'Borrowing Requests',
      icon: ClipboardList,
      visible: hasPermission('manage_requests'),
      badge: requests.length,
    },
    {
      key: 'discrepancies',
      label: 'Discrepancy Reports',
      icon: ShieldAlert,
      visible: hasPermission('investigate_discrepancies'),
      badge: discrepancies.filter((d) => d.status === 'open' || d.status === 'investigating').length,
    },
    { key: 'audit', label: 'Activity Logs', icon: Activity, visible: true, badge: auditLogs.length },
    { key: 'team', label: 'Team Management', icon: UserCheck, visible: isSuperAdmin, badge: team.length },
    {
      key: 'analytics',
      label: 'Reports & Analytics',
      icon: BarChart3,
      visible: hasPermission('view_reports'),
    },
    { key: 'settings', label: 'Settings & Backups', icon: Settings, visible: true },
  ];

  const severityTone = (severity: DiscrepancyItem['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-700 dark:text-red-400';
      case 'high':
        return 'text-orange-700 dark:text-orange-400';
      case 'medium':
        return 'text-amber-700 dark:text-amber-400';
      default:
        return 'text-slate-600 dark:text-slate-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0F5132] dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {isSuperAdmin ? 'Main Owner · Super Admin Console' : 'Team Administrator Workspace'}
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            BookBack Governance & Moderation
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Signed in as <span className="font-semibold text-slate-900 dark:text-slate-200">{user.name}</span>{' '}
            ({user.collegeId}) · Mandatory audit reasons enforced on all record modifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              onNavigate('/');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/70 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm font-medium text-emerald-900 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {error && (
        <div className="mt-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Main Split Console: Sidebar on Desktop, Horizontal Tabs on Mobile */}
      <div className="mt-6 flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <nav
            aria-label="Admin sections"
            className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2"
          >
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F5132] text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          active ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 space-y-6">
          {/* 1. OVERVIEW */}
          {tab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: 'Students', value: stats.totalUsers },
                  { label: 'Verified', value: stats.verifiedUsers },
                  { label: 'Active Books', value: stats.activeListings },
                  { label: 'Handovers', value: stats.completedTransactions },
                  { label: 'Open Alerts', value: stats.openDiscrepancies ?? 0 },
                  { label: 'Admin Team', value: stats.teamAdminsCount ?? 1 },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                  >
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{k.label}</p>
                    <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Recent Discrepancy Alerts
                    </h2>
                    {hasPermission('investigate_discrepancies') && (
                      <button
                        type="button"
                        onClick={handleRunScan}
                        className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Run Scan
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentDiscrepancies.length === 0 ? (
                      <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
                        No discrepancy alerts flagged.
                      </p>
                    ) : (
                      recentDiscrepancies.map((d) => (
                        <div key={d.id} className="p-4 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                              {d.issueId} · <span className={severityTone(d.severity)}>{d.severity}</span>
                            </span>
                            <span className="capitalize text-slate-500 dark:text-slate-400">{d.status}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{d.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Recent Activity Logs
                    </h2>
                    <button
                      type="button"
                      onClick={() => setTab('audit')}
                      className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentLogs.length === 0 ? (
                      <p className="p-5 text-sm text-slate-500 dark:text-slate-400">
                        No administrative actions recorded yet.
                      </p>
                    ) : (
                      recentLogs.map((l) => (
                        <div key={l.id} className="p-4 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-200">
                              {l.actorName} ({l.actorRole})
                            </span>
                            <span className="font-mono text-slate-400">
                              {new Date(l.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-[#0F5132] dark:text-emerald-400 font-medium">
                            {l.action} — {l.details}
                          </p>
                          {l.reason && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {l.reason}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* 2. USER MANAGEMENT */}
          {tab === 'users' && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  User & Verification Management
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  All verification and suspension changes require a documented reason. Team Admins cannot modify administrator accounts.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-6">Member</th>
                      <th className="py-3 px-4">College ID</th>
                      <th className="py-3 px-4">Role / Branch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Failed Logins</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((u) => {
                      const isPrivileged =
                        u.role === 'super_admin' || u.role === 'team_admin' || u.role === 'admin';
                      const canEdit = hasPermission('verify_users') && (!isPrivileged || isSuperAdmin) && u.role !== 'super_admin';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3.5 px-6">
                            <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {u.collegeId}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-xs">
                            <span className="font-semibold uppercase">{u.role}</span> · {u.branch}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={u.verified ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 font-semibold'}>
                              {u.verified ? 'Verified' : 'Unverified'}
                            </span>
                            {' · '}
                            <span className={u.isSuspended ? 'text-red-600 font-semibold' : 'text-slate-600 dark:text-slate-400'}>
                              {u.isSuspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {u.failedLoginAttempts || 0}
                          </td>
                          <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-3">
                            {canEdit ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openReasonPrompt(
                                      u.verified ? `Revoke Verification: ${u.name}` : `Verify Student: ${u.name}`,
                                      'Enter the verification audit reason (stored permanently in Activity Logs).',
                                      u.verified ? 'Revoke Verification' : 'Verify Student',
                                      async (reason) => {
                                        updateAdminUser(user.id, u.id, {
                                          verified: !u.verified,
                                          reason,
                                        });
                                        showToast(`Updated verification for ${u.name}.`);
                                      },
                                    )
                                  }
                                  className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  {u.verified ? 'Revoke Verify' : 'Verify'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openReasonPrompt(
                                      u.isSuspended ? `Reinstate Account: ${u.name}` : `Suspend Account: ${u.name}`,
                                      'Document the verified policy or discrepancy review reason.',
                                      u.isSuspended ? 'Reinstate Account' : 'Suspend Account',
                                      async (reason) => {
                                        updateAdminUser(user.id, u.id, {
                                          isSuspended: !u.isSuspended,
                                          suspensionReason: reason,
                                          reason,
                                        });
                                        showToast(
                                          u.isSuspended
                                            ? `${u.name} reinstated.`
                                            : `${u.name} suspended.`,
                                        );
                                      },
                                      !u.isSuspended,
                                    )
                                  }
                                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                                >
                                  {u.isSuspended ? 'Reinstate' : 'Suspend'}
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">Protected</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 3. BOOK MANAGEMENT */}
          {tab === 'books' && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Book Inventory & Listing Correction
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Correct inaccurate book details or stock counts with a mandatory reason. Permanent deletion is restricted to Super Admin.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-6">Book</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Stock (Avail/Total)</th>
                      <th className="py-3 px-4">Engagement</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-6">
                          <p className="font-medium text-slate-900 dark:text-white">{b.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {b.author} · {b.branch} · {b.offerType} {b.price > 0 ? `(₹${b.price})` : '(Free)'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {b.ownerName} ({b.ownerCollegeId})
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {b.availableQuantity}/{b.quantity}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {b.requestCount} req · {b.viewsCount} views
                        </td>
                        <td className="py-3.5 px-4 capitalize text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {b.status}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-3">
                          {hasPermission('manage_books') && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBook(b);
                                setBookForm({
                                  title: b.title,
                                  author: b.author,
                                  subject: b.subject || '',
                                  price: b.price,
                                  quantity: b.quantity ?? 1,
                                  availableQuantity: b.availableQuantity ?? 1,
                                  status: b.status,
                                  reason: '',
                                });
                              }}
                              className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              Correct Data
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                openReasonPrompt(
                                  `Permanently Delete "${b.title}"`,
                                  'This removes the listing from this browser. Enter a mandatory audit reason.',
                                  'Delete Permanently',
                                  async (reason) => {
                                    updateAdminListing(user.id, b.id, { reason }, true);
                                    showToast(`Listing "${b.title}" permanently deleted.`);
                                  },
                                  true,
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" aria-hidden="true" />
                              <span>Delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. BORROWING REQUESTS */}
          {tab === 'requests' && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Borrowing & Exchange Requests Oversight
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review active campus handovers and correct stuck or disputed request records with a mandatory reason.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-6">Book</th>
                      <th className="py-3 px-4">Owner → Requester</th>
                      <th className="py-3 px-4">Pickup</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-6 text-slate-500 dark:text-slate-400">
                          No borrowing requests recorded yet.
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3.5 px-6">
                            <p className="font-medium text-slate-900 dark:text-white">{r.bookTitle}</p>
                            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
                              {r.offerType}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {r.ownerName} → {r.requesterName}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                            {r.pickupLocation}
                          </td>
                          <td className="py-3.5 px-4 capitalize text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {r.status}
                          </td>
                          <td className="py-3.5 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRequest(r);
                                setRequestForm({
                                  status: r.status,
                                  pickupLocation: r.pickupLocation,
                                  reason: '',
                                });
                              }}
                              className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              Correct Request
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. DISCREPANCY REPORTS & STUDENT REPORTS */}
          {tab === 'discrepancies' && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Discrepancy & Suspicious Activity Dashboard
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Automated anomaly alerts never auto-suspend or accuse users. Every flag requires human administrator review.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunScan}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Run Consistency Scan</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <th className="py-3 px-6">Issue ID & Severity</th>
                        <th className="py-3 px-4">Description & Related Record</th>
                        <th className="py-3 px-4">Assigned Admin</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-6 text-right">Review</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {discrepancies.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-6 text-slate-500 dark:text-slate-400">
                            No suspicious activity or consistency discrepancies detected.
                          </td>
                        </tr>
                      ) : (
                        discrepancies.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                {d.issueId}
                              </p>
                              <p className={`text-xs font-semibold uppercase ${severityTone(d.severity)}`}>
                                {d.severity} · {d.type.replace(/_/g, ' ')}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 max-w-md">
                              <p className="text-xs text-slate-800 dark:text-slate-200">{d.description}</p>
                              <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {d.relatedModel} #{d.relatedRecordId.slice(-8)} ·{' '}
                                {new Date(d.createdAt).toLocaleString()}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                              {d.assignedAdminName}
                              {d.investigationNotes?.length > 0 && (
                                <span className="block text-[11px] text-slate-400">
                                  {d.investigationNotes.length} note(s)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 capitalize text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {d.status.replace('_', ' ')}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectingDiscrepancy(d);
                                  setDiscrepancyForm({
                                    status: d.status,
                                    assignedAdminId: d.assignedAdminId || '',
                                    resolutionSummary: d.resolutionSummary || '',
                                    reason: '',
                                    note: '',
                                  });
                                }}
                                className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                Investigate
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Student-filed reports */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Student-Submitted Reports ({reports.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reports.length === 0 ? (
                    <p className="p-6 text-sm text-slate-500 dark:text-slate-400">
                      No student reports submitted yet.
                    </p>
                  ) : (
                    reports.map((r) => (
                      <div key={r.id} className="p-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Reported by {r.reporterName} ·{' '}
                            <span className="capitalize font-semibold text-slate-900 dark:text-white">
                              {r.status}
                            </span>
                          </p>
                          <p className="mt-1 font-display text-sm font-semibold text-slate-900 dark:text-white">
                            {r.reason}
                            {r.listingTitle ? ` — "${r.listingTitle}"` : ''}
                          </p>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{r.details}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openReasonPrompt(
                                'Resolve Student Report',
                                `Add a resolution note for "${r.reason}".`,
                                'Mark Resolved',
                                async (reason) => {
                                  updateAdminReport(user.id, r.id, 'resolved', reason);
                                  showToast('Student report resolved.');
                                },
                              )
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0F5132] rounded-lg cursor-pointer"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openReasonPrompt(
                                'Dismiss Student Report',
                                `Add a dismissal note for "${r.reason}".`,
                                'Dismiss Report',
                                async (reason) => {
                                  updateAdminReport(user.id, r.id, 'dismissed', reason);
                                  showToast('Student report dismissed.');
                                },
                              )
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          {/* 6. ACTIVITY LOGS & RESTORATION */}
          {tab === 'audit' && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Immutable Activity & Audit Logs
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isSuperAdmin
                      ? 'Super Admin sees all platform actions and can restore previously modified records.'
                      : 'Showing your own tamper-resistant administrative activity history.'}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Append-Only · Cannot Be Deleted</span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-6">Timestamp</th>
                      <th className="py-3 px-4">Administrator</th>
                      <th className="py-3 px-4">Action & Target</th>
                      <th className="py-3 px-4">Mandatory Reason</th>
                      <th className="py-3 px-6 text-right">Recovery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-6 text-slate-500 dark:text-slate-400">
                          No activity logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 align-top">
                          <td className="py-3.5 px-6 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <p className="font-semibold text-slate-900 dark:text-white">{log.actorName}</p>
                            <p className="uppercase text-[11px] text-slate-500 dark:text-slate-400">
                              {log.actorRole}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <p className="font-semibold text-[#0F5132] dark:text-emerald-400">{log.action}</p>
                            <p className="text-slate-700 dark:text-slate-300">{log.details}</p>
                            {log.previousValue && (
                              <p className="mt-1 font-mono text-[11px] text-slate-400 break-all">
                                Before: {JSON.stringify(log.previousValue)}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                            {log.reason || '—'}
                          </td>
                          <td className="py-3.5 px-6 text-right whitespace-nowrap">
                            {isSuperAdmin && log.restorable ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openReasonPrompt(
                                    'Restore Previous Record State',
                                    `Revert target "${log.details}" back to its previous snapshot before "${log.action}".`,
                                    'Restore Record',
                                    async (reason) => {
                                      restoreAuditRecord(user.id, log.id, reason);
                                      showToast('Previous record state restored successfully.');
                                    },
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Restore</span>
                              </button>
                            ) : log.restoredAt ? (
                              <span className="text-xs text-slate-400">Restored</span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 7. TEAM MANAGEMENT (SUPER ADMIN ONLY) */}
          {tab === 'team' && isSuperAdmin && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Administrative Team Accounts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Main Owner / Super Admin retains complete platform authority and cannot be disabled or downgraded.
                  </p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {team.map((member) => (
                    <div
                      key={member.id}
                      className="p-5 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                            {member.name}
                          </p>
                          <span className="text-xs font-semibold uppercase text-[#0F5132] dark:text-emerald-400">
                            {member.role === 'super_admin' ? 'Main Owner · Super Admin' : member.role}
                          </span>
                          {member.isSuspended && (
                            <span className="text-xs font-semibold text-red-600">Disabled</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {member.email} · {member.collegeId}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Permissions: {member.permissions.join(', ') || 'None'}
                        </p>
                      </div>

                      {member.role !== 'super_admin' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeamMember(member);
                            setTeamEditPerms(member.permissions);
                            setTeamEditSuspended(member.isSuspended);
                            setTeamEditReason('');
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Edit Permissions / Status
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Protected Owner</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-[#0F5132] dark:text-emerald-400" aria-hidden="true" />
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Add New Team Admin
                  </h3>
                </div>
                <form onSubmit={handleCreateTeamAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    required
                    placeholder="Full Name"
                    value={newTeamForm.name}
                    onChange={(e) => setNewTeamForm((p) => ({ ...p, name: e.target.value }))}
                    className="px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <input
                    required
                    type="email"
                    placeholder="Staff Email"
                    value={newTeamForm.email}
                    onChange={(e) => setNewTeamForm((p) => ({ ...p, email: e.target.value }))}
                    className="px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <input
                    required
                    placeholder="Staff ID (e.g. ADMIN_3)"
                    value={newTeamForm.collegeId}
                    onChange={(e) => setNewTeamForm((p) => ({ ...p, collegeId: e.target.value }))}
                    className="px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <input
                    required
                    type="password"
                    minLength={8}
                    placeholder="Initial Password (8+ chars)"
                    value={newTeamForm.password}
                    onChange={(e) => setNewTeamForm((p) => ({ ...p, password: e.target.value }))}
                    className="px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Assigned Permissions
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {ALL_PERMISSIONS.map((perm) => {
                        const checked = newTeamForm.permissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNewTeamForm((p) => ({
                                  ...p,
                                  permissions: checked
                                    ? p.permissions.filter((x) => x !== perm.key)
                                    : [...p.permissions, perm.key],
                                }))
                              }
                            />
                            <span>{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      required
                      minLength={5}
                      placeholder="Mandatory audit reason (e.g. Added semester moderation staff)"
                      value={newTeamForm.reason}
                      onChange={(e) => setNewTeamForm((p) => ({ ...p, reason: e.target.value }))}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg cursor-pointer"
                    >
                      Create Team Admin Account
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* 8. REPORTS & ANALYTICS */}
          {tab === 'analytics' && analytics && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Export CSV Governance Reports
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Download real-time database records for audits and academic review.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { type: 'books' as const, label: 'Books CSV' },
                      { type: 'requests' as const, label: 'Requests CSV' },
                      { type: 'discrepancies' as const, label: 'Discrepancies CSV' },
                      { type: 'audit' as const, label: 'Activity Logs CSV' },
                    ].map((exp) => (
                      <button
                        key={exp.type}
                        type="button"
                        onClick={() =>
                          handleDownload(
                            downloadAdminExport(exp.type),
                            `bookback-${exp.type}-report.csv`,
                            'text/csv',
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{exp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Active Books by Branch
                  </h3>
                  {analytics.byBranch.length === 0 ? (
                    <p className="text-xs text-slate-500">No active book data.</p>
                  ) : (
                    analytics.byBranch.map((item) => {
                      const max = Math.max(...analytics.byBranch.map((x) => x.count), 1);
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                            <span>{item.label}</span>
                            <span className="font-mono">{item.count}</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0F5132] dark:bg-emerald-500 rounded-full"
                              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>

                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Top Popular Textbooks
                  </h3>
                  {analytics.topBooks.length === 0 ? (
                    <p className="text-xs text-slate-500">No popularity metrics yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {analytics.topBooks.map((b) => (
                        <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {b.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {b.author} · {b.branch}
                            </p>
                          </div>
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 shrink-0">
                            {b.requestCount} req · {b.viewsCount} views
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* 9. SETTINGS & BACKUPS */}
          {tab === 'settings' && settings && (
            <div className="space-y-6">
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Platform Security & Detection Thresholds
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isSuperAdmin
                        ? 'Configure campus verification, request caps, and automated anomaly thresholds.'
                        : 'Read-only view. Only the Main Owner / Super Admin can modify security settings.'}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Platform Name
                    </label>
                    <input
                      disabled={!isSuperAdmin}
                      value={settings.siteName}
                      onChange={(e) => setSettings((s) => (s ? { ...s, siteName: e.target.value } : s))}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Primary Campus Name
                    </label>
                    <input
                      disabled={!isSuperAdmin}
                      value={settings.campusName}
                      onChange={(e) => setSettings((s) => (s ? { ...s, campusName: e.target.value } : s))}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Max Active Requests per Student
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={!isSuperAdmin}
                      value={settings.maxActiveRequestsPerStudent}
                      onChange={(e) =>
                        setSettings((s) =>
                          s ? { ...s, maxActiveRequestsPerStudent: Number(e.target.value) } : s,
                        )
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Failed Login Alert Threshold
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      disabled={!isSuperAdmin}
                      value={settings.failedLoginAlertThreshold}
                      onChange={(e) =>
                        setSettings((s) =>
                          s ? { ...s, failedLoginAlertThreshold: Number(e.target.value) } : s,
                        )
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Quantity Jump Alert Threshold
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={100}
                      disabled={!isSuperAdmin}
                      value={settings.quantityJumpAlertThreshold}
                      onChange={(e) =>
                        setSettings((s) =>
                          s ? { ...s, quantityJumpAlertThreshold: Number(e.target.value) } : s,
                        )
                      }
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white disabled:opacity-60"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isSuperAdmin}
                        checked={settings.autoVerifyCampusEmail}
                        onChange={(e) =>
                          setSettings((s) =>
                            s ? { ...s, autoVerifyCampusEmail: e.target.checked } : s,
                          )
                        }
                      />
                      <span>Auto-verify institutional email domains</span>
                    </label>
                  </div>

                  {isSuperAdmin && (
                    <>
                      <div className="sm:col-span-2">
                        <input
                          required
                          minLength={5}
                          placeholder="Mandatory reason for settings update"
                          value={settingsReason}
                          onChange={(e) => setSettingsReason(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg cursor-pointer"
                        >
                          Save Security Settings
                        </button>
                      </div>
                    </>
                  )}
                </form>
              </section>

              {isSuperAdmin && (
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-[#0F5132] dark:text-emerald-400" aria-hidden="true" />
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                          Backup Snapshots & Recovery
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Create point-in-time JSON database snapshots, download archives, or restore book records.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Optional snapshot label"
                        value={backupLabel}
                        onChange={(e) => setBackupLabel(e.target.value)}
                        className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleCreateBackup}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg cursor-pointer"
                      >
                        Create Backup
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {backups.length === 0 ? (
                      <p className="p-6 text-sm text-slate-500 dark:text-slate-400">
                        No backup snapshots created yet.
                      </p>
                    ) : (
                      backups.map((bk) => (
                        <div
                          key={bk.id}
                          className="p-5 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-white">
                              {bk.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {new Date(bk.createdAt).toLocaleString()} · By {bk.createdByName} ·{' '}
                              {bk.counts.users} users, {bk.counts.books} books, {bk.counts.requests}{' '}
                              requests
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleDownload(
                                  downloadLocalBackup(bk.id),
                                  `bookback-backup-${bk.id}.json`,
                                  'application/json',
                                )
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Download JSON</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openReasonPrompt(
                                  `Restore from "${bk.label}"`,
                                  'This will restore book listings saved in this browser.',
                                  'Restore Snapshot',
                                  async (reason) => {
                                    restoreLocalBackup(user.id, bk.id, reason);
                                    showToast('Local records restored from snapshot.');
                                  },
                                )
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F5132] rounded-lg cursor-pointer"
                            >
                              <FileCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Restore</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MANDATORY REASON PROMPT MODAL */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {reasonModal.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{reasonModal.description}</p>
            <form onSubmit={handleConfirmReasonModal} className="space-y-4">
              <textarea
                required
                minLength={5}
                rows={3}
                placeholder="Enter mandatory administrative reason (min 5 characters)..."
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReasonModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer ${
                    reasonModal.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0F5132] hover:bg-[#0B3D26]'
                  }`}
                >
                  {modalSubmitting ? 'Processing...' : reasonModal.confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOOK CORRECTION MODAL */}
      {editingBook && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Correct Book Listing Data
            </h3>
            <form onSubmit={handleBookEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  required
                  value={bookForm.title}
                  onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Author
                </label>
                <input
                  required
                  value={bookForm.author}
                  onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={bookForm.price}
                  onChange={(e) => setBookForm((p) => ({ ...p, price: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Total Copies
                </label>
                <input
                  type="number"
                  min={1}
                  value={bookForm.quantity}
                  onChange={(e) => setBookForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Available Copies
                </label>
                <input
                  type="number"
                  min={0}
                  value={bookForm.availableQuantity}
                  onChange={(e) =>
                    setBookForm((p) => ({ ...p, availableQuantity: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Listing Status
                </label>
                <select
                  value={bookForm.status}
                  onChange={(e) => setBookForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="completed">Completed</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Mandatory Correction Reason (min 5 chars)
                </label>
                <input
                  required
                  minLength={5}
                  placeholder="e.g. Verified physical stock count with owner"
                  value={bookForm.reason}
                  onChange={(e) => setBookForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] rounded-lg cursor-pointer"
                >
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST CORRECTION MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Correct Borrowing Request
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {editingRequest.bookTitle} ({editingRequest.ownerName} → {editingRequest.requesterName})
            </p>
            <form onSubmit={handleRequestEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={requestForm.status}
                  onChange={(e) => setRequestForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Pickup Location
                </label>
                <input
                  value={requestForm.pickupLocation}
                  onChange={(e) => setRequestForm((p) => ({ ...p, pickupLocation: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Mandatory Reason
                </label>
                <input
                  required
                  minLength={5}
                  placeholder="Reason for administrative adjustment"
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] rounded-lg cursor-pointer"
                >
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCREPANCY INVESTIGATION MODAL */}
      {inspectingDiscrepancy && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <p className="font-mono text-xs font-bold text-[#0F5132] dark:text-emerald-400">
                {inspectingDiscrepancy.issueId} · {inspectingDiscrepancy.severity.toUpperCase()}
              </p>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Investigate Discrepancy
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {inspectingDiscrepancy.description}
              </p>
            </div>

            {inspectingDiscrepancy.investigationNotes.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Investigation Notes
                </p>
                {inspectingDiscrepancy.investigationNotes.map((n, idx) => (
                  <div key={idx} className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{n.adminName}</span> (
                    {new Date(n.createdAt).toLocaleString()}): {n.note}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleDiscrepancySubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Investigation Status
                  </label>
                  <select
                    value={discrepancyForm.status}
                    onChange={(e) =>
                      setDiscrepancyForm((p) => ({
                        ...p,
                        status: e.target.value as DiscrepancyItem['status'],
                      }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="false_positive">False Positive</option>
                  </select>
                </div>
                {team.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Assign Administrator
                    </label>
                    <select
                      value={discrepancyForm.assignedAdminId}
                      onChange={(e) =>
                        setDiscrepancyForm((p) => ({ ...p, assignedAdminId: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="">Unassigned</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Add Investigation Note
                </label>
                <div className="flex gap-2">
                  <input
                    placeholder="Document findings from reviewing record or contacting student..."
                    value={discrepancyForm.note}
                    onChange={(e) => setDiscrepancyForm((p) => ({ ...p, note: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddNoteOnly}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    Append Note
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Resolution Summary
                </label>
                <input
                  placeholder="Summary of human review outcome"
                  value={discrepancyForm.resolutionSummary}
                  onChange={(e) =>
                    setDiscrepancyForm((p) => ({ ...p, resolutionSummary: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Mandatory Audit Reason (min 5 chars)
                </label>
                <input
                  required
                  minLength={5}
                  placeholder="e.g. Verified duplicate copy with student and cleared alert"
                  value={discrepancyForm.reason}
                  onChange={(e) => setDiscrepancyForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectingDiscrepancy(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] rounded-lg cursor-pointer"
                >
                  Save Investigation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEAM MEMBER EDIT MODAL */}
      {editingTeamMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Manage {editingTeamMember.name}
            </h3>
            <form onSubmit={handleUpdateTeamMember} className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Permissions
                </p>
                {ALL_PERMISSIONS.map((perm) => {
                  const checked = teamEditPerms.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setTeamEditPerms((prev) =>
                            checked ? prev.filter((x) => x !== perm.key) : [...prev, perm.key],
                          )
                        }
                      />
                      <span>{perm.label}</span>
                    </label>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamEditSuspended}
                  onChange={(e) => setTeamEditSuspended(e.target.checked)}
                />
                <span>Disable this Team Admin account</span>
              </label>

              <input
                required
                minLength={5}
                placeholder="Mandatory audit reason"
                value={teamEditReason}
                onChange={(e) => setTeamEditReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTeamMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] rounded-lg cursor-pointer"
                >
                  Save Team Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
