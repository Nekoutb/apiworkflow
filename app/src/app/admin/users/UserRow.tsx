'use client';

import { useState, useTransition } from 'react';
import type { StaffRole } from '@prisma/client';
import { toggleStaffStatusAction, updateStaffRoleAction } from '@/lib/actions/users';
import { ROLE_LABELS_FR, ROLE_LABELS_SHORT_FR, STAFF_ROLES } from '@/lib/roles';

export type UserRowData = {
  id: string;
  name: string | null;
  email: string;
  role: StaffRole | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  createdAt: string; // ISO
  isCurrentUser: boolean;
};

function initials(name: string | null, email: string): string {
  const src = (name && name.trim()) || email;
  return src
    .split(/\s+|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || 'A';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function UserRow({ user }: { user: UserRowData }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const isActive = user.status === 'ACTIVE';

  const handleToggle = () => {
    const fd = new FormData();
    fd.set('id', user.id);
    startTransition(async () => {
      await toggleStaffStatusAction(fd);
    });
  };

  const handleRoleChange = (newRole: StaffRole) => {
    const fd = new FormData();
    fd.set('id', user.id);
    fd.set('role', newRole);
    startTransition(async () => {
      await updateStaffRoleAction(fd);
      setEditing(false);
    });
  };

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 flex-none items-center justify-center text-[11px] font-bold text-white ${
              isActive ? 'bg-cmgreen-800' : 'bg-ink-3'
            }`}
          >
            {initials(user.name, user.email)}
          </div>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold text-ink">
              {user.name ?? '—'}
              {user.isCurrentUser && (
                <span className="ml-2 inline-block border border-gold-500 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.14em] text-gold-700">
                  vous
                </span>
              )}
            </div>
            <div className="text-[11px] italic text-ink-3">créé le {formatDate(user.createdAt)}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink-2">{user.email}</td>
      <td className="px-4 py-3.5">
        {editing ? (
          <select
            autoFocus
            disabled={pending}
            defaultValue={user.role ?? ''}
            onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
            onBlur={() => setEditing(false)}
            className="border border-line-2 bg-white px-2 py-1 text-[12.5px] text-ink focus:border-cmgreen-800 focus:outline-none"
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS_FR[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12.5px] text-ink-2">
            {user.role ? ROLE_LABELS_SHORT_FR[user.role] : '—'}
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span
          className={
            isActive
              ? 'inline-block border border-cmgreen-700 bg-cmgreen-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-cmgreen-800'
              : 'inline-block border border-line-2 bg-bgsoft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3'
          }
        >
          {isActive ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="flex justify-end gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={pending || user.isCurrentUser}
              title={user.isCurrentUser ? 'Vous ne pouvez pas modifier votre propre rôle' : 'Modifier le rôle'}
              className="border border-line-2 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-40 disabled:hover:border-line-2 disabled:hover:text-ink-2"
            >
              Modifier
            </button>
          )}
          <button
            type="button"
            onClick={handleToggle}
            disabled={pending || user.isCurrentUser}
            title={user.isCurrentUser ? 'Vous ne pouvez pas désactiver votre propre compte' : ''}
            className={
              (isActive
                ? 'border border-line-2 bg-white text-ink-2 hover:border-cmred hover:text-cmred'
                : 'border border-cmgreen-700 bg-white text-cmgreen-800 hover:bg-cmgreen-50') +
              ' px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] transition disabled:opacity-40 disabled:hover:border-line-2 disabled:hover:text-ink-2'
            }
          >
            {isActive ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      </td>
    </tr>
  );
}
