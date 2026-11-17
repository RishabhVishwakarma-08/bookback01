import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types';

interface NotificationsPageProps {
  onNavigate: (path: string) => void;
}

export function NotificationsPage({ onNavigate }: NotificationsPageProps) {
  const { user, loading: authLoading, refreshUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('/auth');
    }
  }, [authLoading, user, onNavigate]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: AppNotification[] }>('/notifications');
      setNotifications(res.notifications);
      refreshUnreadCount();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user, refreshUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notif: AppNotification) => {
    if (!notif.isRead) {
      await apiFetch(`/notifications/${notif.id}/read`, { method: 'PATCH' }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
      refreshUnreadCount();
    }
    if (notif.relatedRequestId) {
      onNavigate(`/requests?id=${notif.relatedRequestId}`);
    } else if (notif.relatedListingId) {
      onNavigate(`/books/${notif.relatedListingId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    refreshUnreadCount();
  };

  if (!user) return null;

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Updates on incoming book requests, new messages, status changes, and campus verification.
          </p>
        </div>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F5132] dark:text-emerald-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            <span>Mark All Read</span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-slate-500 dark:text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">No notifications yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              You will be notified here when someone requests your books or replies to a message.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleMarkRead(n)}
                className={`w-full text-left p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start justify-between gap-4 cursor-pointer ${
                  n.isRead
                    ? 'bg-white dark:bg-slate-900'
                    : 'bg-emerald-50/40 dark:bg-emerald-950/30'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {n.title}
                    {!n.isRead && (
                      <span className="ml-2 text-xs font-semibold text-[#0F5132] dark:text-emerald-400">
                        · Unread
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{n.message}</p>
                </div>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
