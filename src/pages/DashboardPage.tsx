import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BookCard, formatOfferPrice } from '../components/BookCard';
import { useAuth } from '../context/AuthContext';
import { deleteBook, getBooks, getRequests, updateBookStatus } from '../data/localStore';
import type { BookListing, BookRequest } from '../types';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, loading: authLoading } = useAuth();
  const [myBooks, setMyBooks] = useState<BookListing[]>([]);
  const [recommended, setRecommended] = useState<BookListing[]>([]);
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/auth');
    }
  }, [authLoading, user, onNavigate]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setMyBooks(getBooks({ ownerId: user.id, status: 'all' }));
      setRequests(getRequests(user.id));
      setRecommended(getBooks({ branch: user.branch, status: 'available', limit: 10 })
        .filter((book) => book.ownerId !== user.id)
        .slice(0, 3));
    } catch (err: any) {
      setActionError(err.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleToggleStatus = async (book: BookListing) => {
    const nextStatus = book.status === 'available' ? 'deactivated' : 'available';
    try {
      updateBookStatus(book.id, nextStatus);
      loadDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Could not update listing status.');
    }
  };

  const handleDelete = async (bookId: string) => {
    try {
      deleteBook(bookId, user!.id);
      loadDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Could not remove listing.');
    }
  };

  if (!user) return null;

  const activeListings = myBooks.filter((b) => b.status === 'available').length;
  const incomingPending = requests.filter(
    (r) => r.ownerId === user.id && r.status === 'pending',
  ).length;
  const outgoingActive = requests.filter(
    (r) => r.requesterId === user.id && ['pending', 'accepted'].includes(r.status),
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Student Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {user.name} · {user.branch} · Semester {user.semester} ·{' '}
            <span className={user.verified ? 'text-[#0F5132] dark:text-emerald-400 font-medium' : 'text-amber-700 dark:text-amber-400'}>
              {user.verified ? 'Verified Campus Account' : 'Pending Verification'}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/list-book')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>List New Book</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Listings', value: activeListings },
          { label: 'Pending Incoming Requests', value: incomingPending },
          { label: 'Active Outgoing Requests', value: outgoingActive },
          { label: 'Completed Handovers', value: completedCount },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* My Listed Books Table */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            My Book Listings
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('/requests')}
            className="text-sm font-medium text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Manage Requests →
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading your listings...</div>
        ) : myBooks.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              You have not listed any books yet.
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Share textbooks from completed semesters to sell, lend, exchange, or donate.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/list-book')}
              className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg cursor-pointer"
            >
              List Your First Book
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-3 px-6">Book</th>
                  <th className="py-3 px-4">Branch / Sem</th>
                  <th className="py-3 px-4">Offer</th>
                  <th className="py-3 px-4">Copies</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {myBooks.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/books/${book.id}`)}
                        className="font-medium text-slate-900 dark:text-white hover:text-[#0F5132] dark:hover:text-emerald-400 hover:underline text-left cursor-pointer"
                      >
                        {book.title}
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{book.author}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {book.branch} · Sem {book.semester}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                      {formatOfferPrice(book)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {book.availableQuantity ?? 1}/{book.quantity ?? 1}
                    </td>
                    <td className="py-3.5 px-4 capitalize whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          book.status === 'available'
                            ? 'text-[#16A34A] dark:text-emerald-400'
                            : book.status === 'reserved'
                              ? 'text-[#D97706] dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {book.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/edit-book/${book.id}`)}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          Edit
                        </button>
                        {book.status !== 'completed' && book.status !== 'reserved' && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(book)}
                            className="text-xs font-semibold text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            {book.status === 'available' ? 'Pause' : 'Reactivate'}
                          </button>
                        )}
                        {book.status !== 'deactivated' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(book.id)}
                            aria-label={`Deactivate ${book.title}`}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {recommended.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Recommended for {user.branch} Students
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-sm font-medium text-[#0F5132] dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Browse Full Catalog
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommended.map((book) => (
              <BookCard key={book.id} book={book} onOpen={(id) => onNavigate(`/books/${id}`)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
