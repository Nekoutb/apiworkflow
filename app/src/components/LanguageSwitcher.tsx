'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

/**
 * FR / EN toggle. Stays on the current page when switching.
 *
 * Visual style matches the obsidian/gold palette used elsewhere.
 * `variant` lets the same component fit different headers:
 *   - 'editorial' — gold-on-obsidian (homepage)
 *   - 'compact'   — neutral border (admin / login)
 */
type Props = { variant?: 'editorial' | 'compact' };

export function LanguageSwitcher({ variant = 'compact' }: Props) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname(); // locale-agnostic (already stripped by next-intl)
  const [pending, startTransition] = useTransition();

  function switchTo(target: Locale) {
    if (target === locale || pending) return;
    startTransition(() => {
      router.replace(pathname, { locale: target });
    });
  }

  return (
    <div
      className={
        'inline-flex select-none border ' +
        (variant === 'editorial' ? 'border-line-2' : 'border-line-2 bg-white')
      }
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((loc, idx) => {
        const active = loc === locale;
        const base = 'px-2.5 py-1 text-[10.5px] font-bold tracking-wide transition';
        const sep = idx > 0 ? 'border-l border-line-2' : '';
        const skin =
          variant === 'editorial'
            ? active
              ? 'bg-obsidian text-gold-500'
              : 'bg-white text-ink-3 hover:text-ink'
            : active
              ? 'bg-obsidian text-white'
              : 'bg-white text-ink-3 hover:text-ink';
        return (
          <button
            key={loc}
            type="button"
            disabled={pending}
            onClick={() => switchTo(loc)}
            aria-pressed={active}
            className={`${base} ${sep} ${skin} disabled:opacity-50`}
          >
            {loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
