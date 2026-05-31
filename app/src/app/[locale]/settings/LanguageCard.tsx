'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { updateMyLocale } from '@/lib/actions/settings';

export function LanguageCard() {
  const t = useTranslations('Settings');
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function choose(target: Locale) {
    if (target === current || pending) return;
    setSaved(false);
    startTransition(async () => {
      // Persist to User.locale + NEXT_LOCALE cookie, then navigate so the UI
      // flips immediately to the chosen language (same page, no reload).
      await updateMyLocale(target);
      setSaved(true);
      router.replace(pathname, { locale: target });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {routing.locales.map((loc) => {
          const active = loc === current;
          return (
            <button
              key={loc}
              type="button"
              onClick={() => choose(loc)}
              disabled={pending}
              aria-pressed={active}
              className={
                'flex-1 rounded-lg border px-4 py-3 text-[13px] font-semibold transition disabled:opacity-50 ' +
                (active
                  ? 'border-blue-600 bg-blue-600/10 text-navy'
                  : 'border-line-2 bg-white text-ink-3 hover:border-blue-400 hover:text-navy')
              }
            >
              <span className="block text-[15px] font-bold">{loc.toUpperCase()}</span>
              <span className="mt-0.5 block text-[11px] font-medium">
                {loc === 'fr' ? t('langFrench') : t('langEnglish')}
              </span>
            </button>
          );
        })}
      </div>
      {saved && (
        <p className="text-[11.5px] font-medium text-cmgreen-800">{t('savedToast')}</p>
      )}
    </div>
  );
}
