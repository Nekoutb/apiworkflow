import { logoutAction } from '@/lib/actions/auth';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="border border-line-2 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:bg-obsidian hover:text-white"
      >
        Se déconnecter
      </button>
    </form>
  );
}
