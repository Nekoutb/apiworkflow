'use client';

import { useMemo } from 'react';
import { rolesGrouped } from '@/lib/roles';

/**
 * Native <select> with <optgroup> per role group.
 * Used by both create and edit forms.
 *
 * onChange exposes the new role so the parent form can conditionally
 * show / hide the antenne picker (only relevant for CHEF_ANTENNE).
 */
type Props = {
  name: string;
  defaultValue?: string;
  required?: boolean;
  onValueChange?: (role: string) => void;
  className?: string;
  id?: string;
};

export function RolePicker({
  name,
  defaultValue,
  required,
  onValueChange,
  className,
  id,
}: Props) {
  const groups = useMemo(() => rolesGrouped(), []);

  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      required={required}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={
        className ??
        'w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800'
      }
    >
      <option value="">— Sélectionner un rôle —</option>
      {groups.map((g) => (
        <optgroup key={g.group} label={g.label}>
          {g.roles.map((r) => (
            <option key={r.role} value={r.role}>
              {r.shortFr} · {r.fr}
              {r.article !== '—' ? ` (${r.article})` : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
