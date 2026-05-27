'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationView,
} from '@/lib/actions/notifications';

const KIND_ICON: Record<string, string> = {
  DOCUMENT_RECEIVED:      '📩',
  DOCUMENT_ASSIGNED:      '⇒',
  DOCUMENT_RETURNED_UP:   '⬆',
  DOCUMENT_HORIZONTAL:    '↔',
  DOCUMENT_TO_DG:         '⬆',
  DG_DECISION_MADE:       '⚖',
  EXTERNAL_AVIS_RECEIVED: '⤴',
  RESPONSE_SENT:          '✉',
  ACK_SENT:               '📨',
  COMMENT_ADDED:          '💬',
  REMINDER_NUDGE:         '🔔',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setLoading(true);
    const result = await getMyNotifications();
    setLoading(false);
    if (result.ok) {
      setItems(result.items ?? []);
      setUnread(result.unreadCount ?? 0);
    }
  }

  // Initial fetch on mount + 60s background refresh while page is open.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function handleOpen() {
    setOpen((prev) => {
      if (!prev) refresh();
      return !prev;
    });
  }

  function handleMarkOne(id: string) {
    start(async () => {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    });
  }

  function handleMarkAll() {
    start(async () => {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    });
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center border border-line bg-white text-[18px] text-ink-2 transition hover:border-ink hover:text-ink"
      >
        🔔
        {unread > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center border border-obsidian bg-gold-500 px-1 text-[9px] font-bold text-obsidian"
            aria-label={`${unread} non lues`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-gold-500 opacity-40"
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] border border-line bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-line bg-bgsoft px-4 py-2.5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-2">
              Notifications {unread > 0 && (
                <span className="ml-2 inline-block bg-gold-500 px-1.5 text-[10px] font-bold text-obsidian">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={pending}
                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3 hover:text-ink disabled:opacity-50"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] italic text-ink-3">
                Chargement…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] italic text-ink-3">
                Aucune notification.
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={
                      'border-b border-line last:border-b-0 ' +
                      (n.read ? 'bg-white' : 'bg-gold-50/50')
                    }
                  >
                    <NotificationRow
                      n={n}
                      onMarkRead={() => handleMarkOne(n.id)}
                      onNavigate={() => setOpen(false)}
                      pending={pending}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  onMarkRead,
  onNavigate,
  pending,
}: {
  n: NotificationView;
  onMarkRead: () => void;
  onNavigate: () => void;
  pending: boolean;
}) {
  const icon = KIND_ICON[n.kind] ?? '•';
  const date = new Date(n.createdAt);
  const ago = humanAgo(date);

  const inner = (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-[14px]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className={'text-[12.5px] ' + (n.read ? 'font-medium text-ink-2' : 'font-bold text-ink')}>
            {n.title}
          </div>
          <div className="flex-shrink-0 text-[9.5px] uppercase tracking-[0.08em] text-ink-4">
            {ago}
          </div>
        </div>
        {n.body && (
          <p className="serif mt-0.5 line-clamp-2 text-[11.5px] italic text-ink-3">{n.body}</p>
        )}
      </div>
      {!n.read && (
        <span
          aria-hidden
          className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-500"
        />
      )}
    </div>
  );

  // Use next-intl Link for client-side, locale-aware navigation. Plain <a>
  // triggers a full-page reload, which would briefly flash the destination's
  // server-rendered "loading" state before settling. With <Link>, navigation
  // is instant + locale-prefix-correct, and the bell dropdown closes cleanly
  // before the new page mounts (no flash of stale dropdown state).
  if (n.link) {
    return (
      <Link
        href={n.link}
        onClick={() => {
          onNavigate();              // close the dropdown FIRST
          if (!n.read && !pending) {
            onMarkRead();            // mark-read in the background
          }
        }}
        className="block hover:bg-bgsoft"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (!n.read && !pending) onMarkRead();
      }}
      className="block w-full text-left hover:bg-bgsoft"
    >
      {inner}
    </button>
  );
}

function humanAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60)       return 'à l\'instant';
  const min = Math.floor(sec / 60);
  if (min < 60)       return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)         return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7)          return `${d} j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
