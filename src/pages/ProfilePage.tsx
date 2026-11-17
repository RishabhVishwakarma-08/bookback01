import { useCallback, useEffect, useState } from 'react';
import { LogOut, Monitor, Moon, ShieldCheck, Star, Sun } from 'lucide-react';
import { BookCard } from '../components/BookCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getProfileData, updateProfile } from '../data/localStore';
import type { BookListing, ProfileReview, StudentPublicProfile, ThemePreference } from '../types';

interface ProfilePageProps {
  profileUserId?: string;
  onNavigate: (path: string) => void;
}

const BRANCHES = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'CE', 'AI & DS', 'Other'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

export function ProfilePage({ profileUserId, onNavigate }: ProfilePageProps) {
  const { user, logout, refreshUser, loading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const targetId = profileUserId || user?.id;

  const [profile, setProfile] = useState<StudentPublicProfile | null>(null);
  const [listings, setListings] = useState<BookListing[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [year, setYear] = useState('1st Year');
  const [semester, setSemester] = useState(1);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !profileUserId && !user) {
      onNavigate('/auth');
    }
  }, [authLoading, profileUserId, user, onNavigate]);

  const loadProfile = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setError('');
    try {
      const data = getProfileData(targetId);
      setProfile(data.profile);
      setListings(data.listings);
      setReviews(data.reviews);
      setName(data.profile.name);
      setBranch(data.profile.branch);
      setYear(data.profile.year);
      setSemester(data.profile.semester);
      setBio(data.profile.bio || '');
    } catch (err: any) {
      setError(err.message || 'Could not load student profile.');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isOwnProfile = Boolean(user && profile && user.id === profile.id);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    setError('');
    try {
      updateProfile(user!.id, {
        name: name.trim(),
        branch,
        year,
        semester,
        bio: bio.trim(),
        themePreference: theme,
      });
      await refreshUser();
      await loadProfile();
      setEditing(false);
      setSaveMessage('Profile updated.');
    } catch (err: any) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-sm text-slate-500 dark:text-slate-400">
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
          <p className="text-sm text-red-700 dark:text-red-300">{error || 'Student profile not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {profile.name}
              </h1>
              {profile.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  Verified Campus Student
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {profile.branch} · {profile.year} · Semester {profile.semester} · {profile.campusName}
            </p>
            {profile.bio && (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>

          {isOwnProfile && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {editing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onNavigate('/');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-100 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {isOwnProfile && user && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-6 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Private Email:{' '}
              <strong className="font-mono text-slate-900 dark:text-white">{user.email}</strong>
            </span>
            <span>
              College ID:{' '}
              <strong className="font-mono text-slate-900 dark:text-white">{user.collegeId}</strong>
            </span>
            <span>
              Role: <strong className="font-mono text-slate-900 dark:text-white">{user.role}</strong>
            </span>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4 max-w-lg">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Completed Handovers</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {profile.completedTransactions}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Average Rating</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {profile.averageRating !== null ? `${profile.averageRating} / 5` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Reviews</p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
              {profile.reviewCount}
            </p>
          </div>
        </div>

        {isOwnProfile && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Appearance Settings
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose Light Mode, Dark Mode, or match your device system setting.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {(
                [
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'system', label: 'System Default', Icon: Monitor },
                ] as Array<{ value: ThemePreference; label: string; Icon: typeof Sun }>
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value, true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    theme === value
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {saveMessage && (
          <p className="mt-4 text-sm font-medium text-[#0F5132] dark:text-emerald-400">
            {saveMessage}
          </p>
        )}

        {editing && isOwnProfile && (
          <form onSubmit={handleSave} className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4 max-w-2xl">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Edit Profile Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="prof-branch" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Branch
                </label>
                <select
                  id="prof-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="prof-year" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Year
                </label>
                <select
                  id="prof-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="prof-sem" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Semester
                </label>
                <select
                  id="prof-sem"
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
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
              <label htmlFor="prof-bio" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Campus Bio & Preferred Handover Spot
              </label>
              <textarea
                id="prof-bio"
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Books Listed by {profile.name}
        </h2>
        {listings.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-sm text-slate-500 dark:text-slate-400">
            No active listings right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((b) => (
              <BookCard key={b.id} book={b} onOpen={(id) => onNavigate(`/books/${id}`)} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Student Reviews
        </h2>
        {reviews.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-sm text-slate-500 dark:text-slate-400">
            No reviews yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {r.reviewerName} · {r.reviewerBranch}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                    {r.rating}/5
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
