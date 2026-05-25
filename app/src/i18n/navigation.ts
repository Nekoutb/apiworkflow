import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives.
 *
 * Replace `import Link from 'next/link'` with `import { Link } from '@/i18n/navigation'`
 * so internal links automatically resolve to the current locale.
 *
 * Same for redirect(), useRouter(), usePathname().
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
