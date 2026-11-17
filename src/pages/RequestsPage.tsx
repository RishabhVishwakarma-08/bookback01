import { useCallback, useEffect, useState } from 'react';
import { Send, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  completeTransaction,
  getRequestDetails,
  getRequests,
  sendRequestMessage,
  submitTransactionReview,
  updateRequestStatus,
} from '../data/localStore';
import type { BookRequest, RequestMessage } from '../types';

interface RequestsPageProps {
  initialRequestId?: string;
  onNavigate: (path: string) => void;
}

export function RequestsPage({ initialRequestId, onNavigate }: RequestsPageProps) {
  const { user, loading: authLoading, refreshUnreadCount } = useAuth();
  const [tab, setTab] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialRequestId || '');
  const [selectedDetail, setSelectedDetail] = useState<BookRequest | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/auth');
    }
  }, [authLoading, user, onNavigate]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const results = getRequests(user.id, tab);
      setRequests(results);
      if (!selectedId && results[0]) {
        setSelectedId(results[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, [user, tab, selectedId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const loadConversation = useCallback(
    async (reqId: string) => {
      if (!reqId || !user) return;
      try {
        const detail = getRequestDetails(reqId, user.id);
        setSelectedDetail(detail.request);
        setHasReviewed(detail.hasReviewed);
        setMessages(detail.messages);
        refreshUnreadCount();
      } catch (err: any) {
        setError(err.message || 'Could not load conversation.');
      }
    },
    [user, refreshUnreadCount],
  );

  useEffect(() => {
    if (selectedId) {
      loadConversation(selectedId);
    } else {
      setSelectedDetail(null);
      setMessages([]);
    }
  }, [selectedId, loadConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !newMessage.trim()) return;
    setSending(true);
    setError('');
    try {
      const message = sendRequestMessage(selectedId, user!.id, newMessage.trim());
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: 'accepted' | 'rejected' | 'cancelled') => {
    if (!selectedId) return;
    setError('');
    try {
      updateRequestStatus(selectedId, user!.id, status);
      await Promise.all([loadRequests(), loadConversation(selectedId)]);
    } catch (err: any) {
      setError(err.message || 'Could not update request status.');
    }
  };

  const handleCompleteTransaction = async () => {
    if (!selectedDetail?.transaction?.id) return;
    setError('');
    try {
      completeTransaction(selectedDetail.transaction.id, user!.id);
      await Promise.all([loadRequests(), loadConversation(selectedDetail.id)]);
    } catch (err: any) {
      setError(err.message || 'Could not mark handover complete.');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail?.transaction?.id) return;
    setReviewSubmitting(true);
    setError('');
    try {
      submitTransactionReview(
        selectedDetail.transaction.id,
        user!.id,
        rating,
        reviewComment.trim(),
      );
      setHasReviewed(true);
      setReviewComment('');
    } catch (err: any) {
      setError(err.message || 'Could not submit review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!user) return null;

  const isOwner = selectedDetail && selectedDetail.ownerId === user.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Book Requests & Messaging
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Private request conversations between book owners and interested students.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { key: 'all', label: 'All Requests' },
              { key: 'incoming', label: 'Incoming (Owner)' },
              { key: 'outgoing', label: 'Outgoing (Sent)' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key);
                setSelectedId('');
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                tab === item.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Requests ({requests.length})
          </div>
          {loading ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-white">No book requests yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Browse the catalog to request a textbook, or list your own books.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg cursor-pointer"
              >
                Browse Books
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
              {requests.map((req) => {
                const active = req.id === selectedId;
                const incoming = req.ownerId === user.id;
                const counterparty = incoming ? req.requester : req.owner;
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedId(req.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span>{incoming ? 'Incoming' : 'Outgoing'}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="capitalize font-medium text-slate-700 dark:text-slate-200">
                        {req.status}
                      </span>
                    </p>
                    <p className="mt-1 font-display text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {req.listing?.title || 'Book Listing'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 truncate">
                      With {counterparty?.name || 'Student'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {!selectedDetail ? (
            <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Select a request on the left to inspect its status and exchange private messages.
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span>Pickup: {selectedDetail.pickupLocation}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="capitalize">Type: {selectedDetail.offerType}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="capitalize font-semibold text-slate-900 dark:text-white">
                      Status: {selectedDetail.status}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      selectedDetail.listing?.id &&
                      onNavigate(`/books/${selectedDetail.listing.id}`)
                    }
                    className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white hover:text-[#0F5132] dark:hover:text-emerald-400 hover:underline text-left cursor-pointer"
                  >
                    {selectedDetail.listing?.title}
                  </button>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Owner: {selectedDetail.owner?.name} · Requester: {selectedDetail.requester?.name}
                  </p>
                  {selectedDetail.transaction?.dueDate && (
                    <p className="mt-1.5 font-mono text-xs text-[#D97706] dark:text-amber-400">
                      Return Due: {new Date(selectedDetail.transaction.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && selectedDetail.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange('accepted')}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
                      >
                        Accept Request
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange('rejected')}
                        className="px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-100 cursor-pointer"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {selectedDetail.status === 'pending' && !isOwner && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('cancelled')}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancel Request
                    </button>
                  )}

                  {selectedDetail.status === 'accepted' &&
                    selectedDetail.transaction?.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={handleCompleteTransaction}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer"
                        >
                          Mark Handover Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange('cancelled')}
                          className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                </div>
              </div>

              <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-950/60 space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto">
                {messages.map((msg) => {
                  const mine = msg.senderId === user.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                          mine
                            ? 'bg-[#0F5132] dark:bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                      </div>
                      <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {mine ? 'You' : msg.senderName} ·{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write a message to coordinate pickup time or book details..."
                  aria-label="Message text"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] disabled:opacity-50 cursor-pointer min-h-[42px]"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>Send</span>
                </button>
              </form>

              {selectedDetail.status === 'completed' && !hasReviewed && (
                <form
                  onSubmit={handleSubmitReview}
                  className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/30 space-y-3"
                >
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Leave a Handover Review
                  </h3>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        aria-label={`Rate ${star} stars`}
                        className="p-1 cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= rating
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 ml-1">
                      {rating}/5
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Comment on book accuracy and campus handover punctuality..."
                      className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="px-4 py-2 text-sm font-semibold text-white bg-[#0F5132] dark:bg-emerald-600 rounded-lg hover:bg-[#0B3D26] cursor-pointer whitespace-nowrap"
                    >
                      {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </form>
              )}

              {selectedDetail.status === 'completed' && hasReviewed && (
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-[#0F5132] dark:text-emerald-400">
                  Your review for this completed transaction has been recorded.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
