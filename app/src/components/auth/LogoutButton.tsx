import { LogOut } from 'lucide-react';
import { logoutAction } from '@/lib/actions/auth-actions';

/**
 * Renders a "Sign out" button that calls the logoutAction Server Action.
 * Used in both /investor and /staff top bars.
 */
export function LogoutButton({ className = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-white/10' }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className} title="Se déconnecter">
        <LogOut className="h-4 w-4" />
        Déconnexion
      </button>
    </form>
  );
}
