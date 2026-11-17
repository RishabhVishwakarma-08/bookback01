import { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { TeamPermission } from '../types';
import { getSetupStatus, initializeDemoSetup, setCurrentUserId } from '../data/localStore';

interface SetupPageProps {
  onNavigate: (path: string) => void;
}

const DEFAULT_TEAM_PERMISSIONS: TeamPermission[] = [
  'manage_books',
  'manage_requests',
  'investigate_discrepancies',
  'verify_users',
  'view_reports',
];

const PERMISSION_LABELS: Record<TeamPermission, string> = {
  manage_books: 'Manage & correct books',
  manage_requests: 'Manage borrowing requests',
  investigate_discrepancies: 'Investigate discrepancies',
  verify_users: 'Verify students',
  view_reports: 'View reports & analytics',
};

export function SetupPage({ onNavigate }: SetupPageProps) {
  const { refreshUser } = useAuth();
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [setupKey, setSetupKey] = useState('');
  const [campusName, setCampusName] = useState('MITS Gwalior');
  const [campusDomain, setCampusDomain] = useState('mitsgwalior.in');

  const [superAdmin, setSuperAdmin] = useState({
    name: '',
    email: '',
    collegeId: 'SUPER001',
    password: '',
  });

  const [includeTeam1, setIncludeTeam1] = useState(true);
  const [teamAdmin1, setTeamAdmin1] = useState({
    name: 'Team Admin 1',
    email: '',
    collegeId: 'TEAM001',
    password: '',
    permissions: [...DEFAULT_TEAM_PERMISSIONS] as TeamPermission[],
  });

  const [includeTeam2, setIncludeTeam2] = useState(true);
  const [teamAdmin2, setTeamAdmin2] = useState({
    name: 'Team Admin 2',
    email: '',
    collegeId: 'TEAM002',
    password: '',
    permissions: [...DEFAULT_TEAM_PERMISSIONS] as TeamPermission[],
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const status = getSetupStatus();
    setNeedsSetup(status.needsSetup);
    setCampusName(status.campusName);
    setCampusDomain(status.campusDomain);
    setChecking(false);
  }, []);

  const togglePermission = (
    target: 'team1' | 'team2',
    perm: TeamPermission,
  ) => {
    const updater = target === 'team1' ? setTeamAdmin1 : setTeamAdmin2;
    updater((prev) => {
      const has = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: has
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        setupKey: setupKey.trim(),
        campusName: campusName.trim(),
        campusDomain: campusDomain.trim().toLowerCase(),
        superAdmin: {
          name: superAdmin.name.trim(),
          email: superAdmin.email.trim().toLowerCase(),
          collegeId: superAdmin.collegeId.trim().toUpperCase(),
          password: superAdmin.password,
        },
      };
      if (includeTeam1 && teamAdmin1.email.trim()) {
        payload.teamAdmin1 = {
          name: teamAdmin1.name.trim(),
          email: teamAdmin1.email.trim().toLowerCase(),
          collegeId: teamAdmin1.collegeId.trim().toUpperCase(),
          password: teamAdmin1.password,
          permissions: teamAdmin1.permissions,
        };
      }
      if (includeTeam2 && teamAdmin2.email.trim()) {
        payload.teamAdmin2 = {
          name: teamAdmin2.name.trim(),
          email: teamAdmin2.email.trim().toLowerCase(),
          collegeId: teamAdmin2.collegeId.trim().toUpperCase(),
          password: teamAdmin2.password,
          permissions: teamAdmin2.permissions,
        };
      }

      const newAdmin = initializeDemoSetup(payload);
      setCurrentUserId(newAdmin.id);
      await refreshUser();
      onNavigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Initial setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Checking administrative setup status...
      </div>
    );
  }

  if (!needsSetup) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <Lock className="w-10 h-10 text-[#0F5132] dark:text-emerald-400 mx-auto" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Administration Setup Locked
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The Main Owner (Super Admin) account is already configured. One-time setup is permanently
            disabled for security.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/auth')}
            className="mt-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F5132] dark:text-emerald-400 mb-2">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          <span>One-Time Demo Initialization</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Configure BookBack Administration Team
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Create your Main Owner / Super Admin account along with your two initial Team Admin
          accounts for this browser. The demo data is stored locally and is not shared with a server.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Demo confirmation & campus settings */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            1. Demo Confirmation & Campus Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label htmlFor="setup-key" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Demo Setup Confirmation
              </label>
              <input
                id="setup-key"
                type="password"
                required
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                placeholder="Enter any value to confirm local demo setup"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="setup-campus" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                University / Campus Name
              </label>
              <input
                id="setup-campus"
                type="text"
                required
                value={campusName}
                onChange={(e) => setCampusName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="setup-domain" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Campus Email Domain
              </label>
              <input
                id="setup-domain"
                type="text"
                required
                value={campusDomain}
                onChange={(e) => setCampusDomain(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </section>

        {/* Super Admin */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              2. Main Owner / Super Admin (Full Control)
            </h2>
            <span className="text-xs font-medium text-[#0F5132] dark:text-emerald-400">
              All Permissions
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              value={superAdmin.name}
              onChange={(e) => setSuperAdmin({ ...superAdmin, name: e.target.value })}
              placeholder="Full Name"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <input
              type="email"
              required
              value={superAdmin.email}
              onChange={(e) => setSuperAdmin({ ...superAdmin, email: e.target.value })}
              placeholder="owner@university.edu"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              value={superAdmin.collegeId}
              onChange={(e) => setSuperAdmin({ ...superAdmin, collegeId: e.target.value })}
              placeholder="Staff ID (e.g. SUPER001)"
              className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <input
              type="password"
              required
              minLength={8}
              value={superAdmin.password}
              onChange={(e) => setSuperAdmin({ ...superAdmin, password: e.target.value })}
              placeholder="Strong Password (min 8 chars)"
              className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </section>

        {/* Team Admin 1 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>3. Team Admin 1</span>
            </h2>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTeam1}
                onChange={(e) => setIncludeTeam1(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Create now</span>
            </label>
          </div>
          {includeTeam1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  value={teamAdmin1.name}
                  onChange={(e) => setTeamAdmin1({ ...teamAdmin1, name: e.target.value })}
                  placeholder="Team Admin 1 Name"
                  className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  required
                  value={teamAdmin1.email}
                  onChange={(e) => setTeamAdmin1({ ...teamAdmin1, email: e.target.value })}
                  placeholder="team1@university.edu"
                  className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={teamAdmin1.collegeId}
                  onChange={(e) => setTeamAdmin1({ ...teamAdmin1, collegeId: e.target.value })}
                  placeholder="TEAM001"
                  className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={teamAdmin1.password}
                  onChange={(e) => setTeamAdmin1({ ...teamAdmin1, password: e.target.value })}
                  placeholder="Strong Password (min 8 chars)"
                  className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {DEFAULT_TEAM_PERMISSIONS.map((perm) => (
                  <label
                    key={perm}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={teamAdmin1.permissions.includes(perm)}
                      onChange={() => togglePermission('team1', perm)}
                      className="rounded border-slate-300"
                    />
                    <span>{PERMISSION_LABELS[perm]}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Team Admin 2 */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>4. Team Admin 2</span>
            </h2>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTeam2}
                onChange={(e) => setIncludeTeam2(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Create now</span>
            </label>
          </div>
          {includeTeam2 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  value={teamAdmin2.name}
                  onChange={(e) => setTeamAdmin2({ ...teamAdmin2, name: e.target.value })}
                  placeholder="Team Admin 2 Name"
                  className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <input
                  type="email"
                  required
                  value={teamAdmin2.email}
                  onChange={(e) => setTeamAdmin2({ ...teamAdmin2, email: e.target.value })}
                  placeholder="team2@university.edu"
                  className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={teamAdmin2.collegeId}
                  onChange={(e) => setTeamAdmin2({ ...teamAdmin2, collegeId: e.target.value })}
                  placeholder="TEAM002"
                  className="px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={teamAdmin2.password}
                  onChange={(e) => setTeamAdmin2({ ...teamAdmin2, password: e.target.value })}
                  placeholder="Strong Password (min 8 chars)"
                  className="px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {DEFAULT_TEAM_PERMISSIONS.map((perm) => (
                  <label
                    key={perm}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={teamAdmin2.permissions.includes(perm)}
                      onChange={() => togglePermission('team2', perm)}
                      className="rounded border-slate-300"
                    />
                    <span>{PERMISSION_LABELS[perm]}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Initializing Platform...' : 'Initialize Admin Team & Lock Setup'}
          </button>
        </div>
      </form>
    </div>
  );
}
