'use client';

import { useState, useTransition } from 'react';
import { roleLabel } from '@/lib/roles';
import type { StaffRole, UserStatus } from '@prisma/client';
import { RolePicker } from './RolePicker';
import {
  deactivateStaff,
  reactivateStaff,
  resetPassword,
  updateStaff,
} from '@/lib/actions/users';

type Antenne = { id: string; name: string; region: string; active: boolean };

export type UserRowData = {
  id: string;
  name: string | null;
  email: string;
  staffRole: StaffRole | null;
  status: UserStatus;
  antenneId: string | null;
  antenneName: string | null;
  isSelf: boolean;
};

export function UserRow({ user, antennes }: { user: UserRowData; antennes: Antenne[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingRole, setPendingRole] = useState<string>(user.staffRole ?? '');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const isActive = user.status === 'ACTIVE';
  const activeAntennes = antennes.filter((a) => a.active);

  function notify(state: { ok?: boolean; error?: string }, success: string) {
    if (state.ok) setFeedback({ kind: 'ok', text: success });
    else if (state.error) setFeedback({ kind: 'err', text: state.error });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function onSave(formData: FormData) {
    formData.set('userId', user.id);
    startTransition(async () => {
      const res = await updateStaff({}, formData);
      notify(res, 'Compte mis à jour.');
      if (res.ok) setEditing(false);
    });
  }

  function onDeactivate() {
    if (!confirm(`Désactiver ${user.email} ?`)) return;
    startTransition(async () => {
      const res = await deactivateStaff(user.id);
      notify(res, 'Compte désactivé.');
    });
  }
  function onReactivate() {
    startTransition(async () => {
      const res = await reactivateStaff(user.id);
      notify(res, 'Compte réactivé.');
    });
  }
  function onReset() {
    if (!confirm(`Réinitialiser le mot de passe de ${user.email} à "admin" ?`)) return;
    startTransition(async () => {
      const res = await resetPassword(user.id);
      notify(res, 'Mot de passe réinitialisé à "admin".');
    });
  }

  if (editing) {
    return (
      <tr className="border-t border-line bg-bgsoft">
        <td colSpan={5} className="px-4 py-4">
          <form action={onSave} className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1.6fr_1fr_auto]">
            <input
              name="fullName"
              defaultValue={user.name ?? ''}
              required
              className="border border-line-2 bg-white px-3 py-2 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
              placeholder="Nom complet"
            />
            <RolePicker
              name="role"
              defaultValue={user.staffRole ?? ''}
              required
              onValueChange={setPendingRole}
            />
            {pendingRole === 'CHEF_ANTENNE' ? (
              <select
                name="antenneId"
                defaultValue={user.antenneId ?? ''}
                required
                className="border border-line-2 bg-white px-3 py-2 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
              >
                <option value="">— Antenne —</option>
                {activeAntennes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" name="antenneId" value="" />
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pending}
                className="bg-cmgreen-800 px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
              >
                {pending ? '…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setPendingRole(user.staffRole ?? '');
                }}
                className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
              >
                Annuler
              </button>
            </div>
          </form>
          {feedback && (
            <div
              className={
                'mt-2 text-[11.5px] font-medium ' +
                (feedback.kind === 'ok' ? 'text-cmgreen-900' : 'text-cmred')
              }
            >
              {feedback.text}
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className={'border-t border-line ' + (isActive ? '' : 'opacity-55')}>
      <td className="px-4 py-3 text-[13.5px] font-semibold text-ink">{user.name ?? '—'}</td>
      <td className="px-4 py-3 font-mono text-[12px] text-ink-2">{user.email}</td>
      <td className="px-4 py-3 text-[12.5px] text-ink-2">{roleLabel(user.staffRole)}</td>
      <td className="px-4 py-3 text-[11.5px] text-ink-3">{user.antenneName ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={
              'inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ' +
              (isActive
                ? 'bg-cmgreen-50 text-cmgreen-900'
                : 'bg-ink-4/15 text-ink-3')
            }
          >
            {user.status}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(true)}
            className="border border-line-2 bg-white px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:border-ink hover:text-ink"
          >
            Éditer
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReset}
            className="border border-line-2 bg-white px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:border-gold-700 hover:text-gold-700"
          >
            Reset MDP
          </button>
          {isActive ? (
            <button
              type="button"
              disabled={pending || user.isSelf}
              onClick={onDeactivate}
              title={user.isSelf ? 'Impossible de se désactiver soi-même' : ''}
              className="border border-line-2 bg-white px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cmred hover:border-cmred disabled:opacity-40"
            >
              Désactiver
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={onReactivate}
              className="border border-line-2 bg-white px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cmgreen-900 hover:border-cmgreen-800"
            >
              Réactiver
            </button>
          )}
        </div>
        {feedback && (
          <div
            className={
              'mt-1 text-[11px] font-medium ' +
              (feedback.kind === 'ok' ? 'text-cmgreen-900' : 'text-cmred')
            }
          >
            {feedback.text}
          </div>
        )}
      </td>
    </tr>
  );
}
