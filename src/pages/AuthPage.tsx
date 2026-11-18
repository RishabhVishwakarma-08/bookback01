import { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Users } from 'lucide-react';
import { getCampuses, getSetupStatus } from '../data/localStore';
import { useAuth } from '../context/AuthContext';
import type { Campus } from '../types';

interface AuthPageProps {
  onNavigate: (path: string) => void;
}

const BRANCHES = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE', 'AI & DS', 'Other'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export function AuthPage({ onNavigate }: AuthPageProps) {
  const { login, register, user, isAdmin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState('1st Year');
  const [semester, setSemester] = useState(2);
  const [campusId, setCampusId] = useState('');
  const [regPassword, setRegPassword] = useState('');

  useEffect(() => {
    if (user) {
      onNavigate(isAdmin ? '/admin' : '/dashboard');
    }
  }, [user, isAdmin, onNavigate]);

  useEffect(() => {
    const availableCampuses = getCampuses();
    setCampuses(availableCampuses);
    if (availableCampuses[0]) setCampusId(availableCampuses[0].id);
    setNeedsSetup(getSetupStatus().needsSetup);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const signedIn = await login(identifier.trim(), loginPassword);
      const isStaff =
        signedIn.role === 'super_admin' ||
        signedIn.role === 'team_admin' ||
        signedIn.role === 'admin';
      onNavigate(isStaff ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        collegeId: collegeId.trim(),
        branch,
        year,
        semester: Number(semester),
        campusId,
        password: regPassword,
      });
      onNavigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Sign in to BookBack
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Access your student book listings, campus requests, or administrative workspace.
                </p>
              </div>

              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  College Email or College / Staff ID
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="student@university.edu or 0901CS251042"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F5132]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors cursor-pointer min-h-[44px]"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Create Student Account
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Register with your college email address and enrollment ID to list, borrow, or buy textbooks.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ananya Tiwari"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="reg-college-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    College / Roll ID
                  </label>
                  <input
                    id="reg-college-id"
                    type="text"
                    required
                    value={collegeId}
                    onChange={(e) => setCollegeId(e.target.value)}
                    placeholder="0901CS251088"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    College Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ananya@mitsgwalior.in"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="reg-campus" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Campus
                  </label>
                  <select
                    id="reg-campus"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="reg-branch" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Branch
                  </label>
                  <select
                    id="reg-branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-year" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Academic Year
                  </label>
                  <select
                    id="reg-year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-semester" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Semester
                  </label>
                  <select
                    id="reg-semester"
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password (minimum 8 characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors cursor-pointer min-h-[44px]"
              >
                {submitting ? 'Creating Account...' : 'Create Student Account'}
              </button>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Platform administrator?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure the campus and admin accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/setup')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0F5132] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors cursor-pointer min-h-[44px]"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  Open Admin Setup
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security & Campus Trust Panel (No hardcoded credentials) */}
        <aside className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Campus Trust & Security
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              BookBack runs as a local demo. Accounts, listings, and messages stay in this browser;
              do not enter real or sensitive passwords.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#0F5132] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Institutional Verification</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Students registering with their official campus email domain receive automatic verification.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
              <Users className="w-5 h-5 text-[#0F5132] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Peer-to-Peer Handovers</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Arrange pickups safely at campus libraries or department blocks without exposing personal phone numbers.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#0F5132] dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Human-Reviewed Moderation</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  All listing corrections and security alerts are logged and reviewed by authorized campus administrators.
                </p>
              </div>
            </div>
          </div>

          {needsSetup && (
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 space-y-2">
              <p className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                Platform Owner Setup Pending
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                No demo administrator is configured yet. Initialize the local demo owner and Team Admin accounts.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/setup')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
              >
                Open Admin Setup
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
