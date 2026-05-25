import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing config.
 *
 * - Two locales: fr (default), en
 * - localePrefix: 'as-needed' means:
 *     /login         → French (default locale, no prefix needed)
 *     /en/login      → English
 *     /fr/login      → French (also valid, redundant prefix)
 *   This preserves every existing URL while adding English support.
 *
 * Per R7 (validated 2026-05-24): bilingual FR + EN required at launch.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  // Browser language detection — first visit picks based on Accept-Language
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
