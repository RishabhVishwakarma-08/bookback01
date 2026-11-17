import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Flag, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client';
import { formatOfferPrice } from '../components/BookCard';
import { useAuth } from '../context/AuthContext';
import type { BookListing } from '../types';

interface BookDetailPageProps {
  bookId: string;
  onNavigate: (path: string) => void;
}

export function BookDetailPage({ bookId, onNavigate }: BookDetailPageProps) {
  const { user } = useAuth();
  const [book, setBook] = useState<BookListing | null>(null);
  const [existingRequest, setExistingRequest] = useState<{ id: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const [message, setMessage] = useState('');
  const [pickupLocation, setPickupLocation] = useState('Central Library Reading Hall');
  const [submitting, setSubmitting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState('');
  const [requestError, setRequestError] = useState('');

  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Wrong Book Info');
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');

  const loadBook = useCallback(async () => {
    setLoading(true);
    setError('');
    setImgFailed(false);
    setRequestFeedback('');
    setRequestError('');
    setReportError('');
    setReportSuccess('');
    setShowReport(false);
    try {
      const data = await apiFetch<{
        book: BookListing;
        existingRequest: { id: string; status: string } | null;
      }>(`/books/${bookId}`);
      setBook(data.book);
      setExistingRequest(data.existingRequest);
    } catch (err: any) {
      setError(err.message || 'Could not load book listing.');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onNavigate('/auth');
      return;
    }
    setRequestError('');
    setRequestFeedback('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ request: { id: string; status: string } }>(
        `/books/${bookId}/requests`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: message.trim(),
            pickupLocation: pickupLocation.trim(),
          }),
        },
      );
      setExistingRequest(res.request);
      setRequestFeedback('Request sent! You can now message the owner to coordinate handover.');
      setMessage('');
    } catch (err: any) {
      setRequestError(err.message || 'Unable to send request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) {
      setReportError('Book details are unavailable to report right now.');
      return;
    }

    setReportError('');
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({
          listingId: bookId,
          reportedUserId: book.ownerId,
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      setReportSuccess('Report submitted to campus moderators.');
      setReportDetails('');
      setTimeout(() => {
        setShowReport(false);
        setReportSuccess('');
      }, 1500);
    } catch (err: any) {
      setReportError(err.message || 'Could not submit report.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
          <div className="lg:col-span-5 aspect-[3/4] bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Listing Unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {error || 'This book could not be found.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg cursor-pointer"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user && user.id === book.ownerId;
  const coverUrl = book.images?.[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Book Catalog</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
            {coverUrl && !imgFailed ? (
              <img
                src={coverUrl}
                alt={book.title}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-100 dark:bg-slate-800">
                <BookOpen className="w-12 h-12 text-[#0F5132] dark:text-emerald-400 mb-3" aria-hidden="true" />
                <p className="font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                  {book.title}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Semester {book.semester}</span>
              <span aria-hidden="true"> · </span>
              <span>{book.branch}</span>
              <span aria-hidden="true"> · </span>
              <span>{book.subject}</span>
              {book.course ? ` · ${book.course}` : ''}
            </p>

            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
              {book.title}
            </h1>
            <p className="mt-1.5 text-base text-slate-600 dark:text-slate-400">by {book.author}</p>

            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Offer & Price
                </p>
                <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatOfferPrice(book)}
                </p>
                {book.offerType === 'lend' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Loan period: {book.loanDurationDays} days
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</p>
                <p
                  className={`mt-1 text-sm font-semibold capitalize ${
                    book.status === 'available'
                      ? 'text-[#16A34A] dark:text-emerald-400'
                      : book.status === 'reserved'
                        ? 'text-[#D97706] dark:text-amber-400'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {book.status}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-slate-100 dark:border-slate-800 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Condition</dt>
                <dd className="font-medium text-slate-900 dark:text-white mt-0.5">{book.condition}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Available Copies</dt>
                <dd className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
                  {book.availableQuantity ?? 1} / {book.quantity ?? 1}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Edition</dt>
                <dd className="font-medium text-slate-900 dark:text-white mt-0.5">
                  {book.edition || 'Standard'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">ISBN</dt>
                <dd className="font-mono text-xs font-medium text-slate-900 dark:text-slate-200 mt-1">
                  {book.isbn || 'Not specified'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Owner Notes</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {book.description}
              </p>
            </div>
          </div>

          {book.owner && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Listed by</p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/profile/${book.owner!.id}`)}
                    className="font-display text-base font-semibold text-slate-900 dark:text-white hover:text-[#0F5132] dark:hover:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {book.owner.name}
                  </button>
                  {book.owner.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5132] dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Verified Campus Student
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {book.owner.branch} · {book.owner.year}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(`/profile/${book.owner!.id}`)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                View Profile & Reviews
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
            {isOwner ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    This is your listing
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Manage availability, edit price, or review incoming student requests.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/edit-book/${book.id}`)}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Edit Listing
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/requests')}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
                  >
                    View Requests
                  </button>
                </div>
              </div>
            ) : existingRequest ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                    Request Active ({existingRequest.status})
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {requestFeedback || 'You have already sent a request for this book.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(`/requests?id=${existingRequest.id}`)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
                >
                  Open Request & Messages
                </button>
              </div>
            ) : book.status !== 'available' ? (
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  Currently {book.status}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  This book is no longer open for new requests.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  {book.offerType === 'sell'
                    ? 'Request to Buy This Book'
                    : book.offerType === 'lend'
                      ? 'Request to Borrow This Book'
                      : book.offerType === 'donate'
                        ? 'Request Donated Book'
                        : 'Propose Book Exchange'}
                </h2>

                {requestError && (
                  <p className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
                    {requestError}
                  </p>
                )}

                <div>
                  <label htmlFor="pickup-loc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Preferred Campus Pickup Location
                  </label>
                  <input
                    id="pickup-loc"
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="e.g., Central Library Desk, CSE Block Lobby"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="req-msg" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Message to Owner
                  </label>
                  <textarea
                    id="req-msg"
                    rows={3}
                    required
                    minLength={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Introduce yourself and propose a campus handover time..."
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] disabled:opacity-60 cursor-pointer min-h-[44px]"
                  >
                    {submitting
                      ? 'Sending Request...'
                      : user
                        ? 'Request This Book'
                        : 'Sign In to Request'}
                  </button>

                  {user && (
                    <button
                      type="button"
                      onClick={() => setShowReport(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Report Listing</span>
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {showReport && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 id="report-modal-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Report Book Listing
            </h2>
            {reportSuccess ? (
              <p className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-sm text-[#0F5132] dark:text-emerald-300 font-medium">
                {reportSuccess}
              </p>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                {reportError && (
                  <p className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
                    {reportError}
                  </p>
                )}
                <div>
                  <label htmlFor="report-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reason
                  </label>
                  <select
                    id="report-reason"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Wrong Book Info">Wrong Book Info</option>
                    <option value="Spam or Scam">Spam or Scam</option>
                    <option value="Prohibited Item">Prohibited Item</option>
                    <option value="Inappropriate Content">Inappropriate Content</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="report-details" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Details
                  </label>
                  <textarea
                    id="report-details"
                    rows={3}
                    required
                    minLength={5}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Explain what is inaccurate or concerning..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReport(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
