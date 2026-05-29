import type { CSSProperties, ReactNode } from 'react';

/**
 * V4 Civic Glass icon set — single-weight line glyphs on a 24-grid.
 * The mockup at /design-preview/v4-civic-glass.html shows the full set.
 * Stroke colour inherits from `currentColor`; size + width via the `.icon`
 * utility classes in globals.css. Pass `label` for buttons that have no
 * visible text — otherwise the SVG is marked aria-hidden.
 */
export type IconName =
  | 'inbox'
  | 'timer'
  | 'folder'
  | 'mail-in'
  | 'send'
  | 'archive'
  | 'users'
  | 'chart'
  | 'bell'
  | 'check'
  | 'search'
  | 'more'
  | 'arrow-right'
  | 'logout'
  | 'sparkles'
  | 'shield'
  | 'handshake'
  | 'external'
  | 'undo'
  | 'warn'
  | 'globe';

const PATHS: Record<IconName, ReactNode> = {
  'inbox': (
    <>
      <path d="M22 12h-5.5l-2 3h-5l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  'timer': (
    <>
      <line x1="10" y1="2.6" x2="14" y2="2.6" />
      <line x1="12" y1="14" x2="15" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  'folder': (
    <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4.6a2 2 0 0 1 1.41.59L12 6h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z" />
  ),
  'mail-in': (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M3.4 9.4 12 15l8.6-5.6" />
      <path d="M12 1.6v4.2" />
      <path d="m9.9 3.9 2.1 2.1 2.1-2.1" />
    </>
  ),
  'send': (
    <>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 21l-3.8-8.2L3 9z" />
    </>
  ),
  'archive': (
    <>
      <rect x="2.5" y="3.5" width="19" height="5" rx="1.2" />
      <path d="M4 8.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5" />
      <path d="M10 12.5h4" />
    </>
  ),
  'users': (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  'chart': (
    <>
      <path d="M3 3v18h18" />
      <path d="M8 17v-5" />
      <path d="M13 17V8" />
      <path d="M18 17v-3" />
    </>
  ),
  'bell': (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  'check': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12 2.6 2.6 4.6-5" />
    </>
  ),
  'search': (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  'more': (
    <>
      <circle cx="12" cy="6" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="12" cy="18" r="1.3" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </>
  ),
  'logout': (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  'sparkles': (
    <>
      <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
      <path d="M19 14v3" />
      <path d="M19 20v1" />
      <path d="M5 14v3" />
    </>
  ),
  'shield': (
    <>
      <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  'handshake': (
    <>
      <path d="M11 17a2 2 0 0 1-2 2H6l-4-4 4-4h3" />
      <path d="M13 17a2 2 0 0 0 2 2h3l4-4-4-4h-3" />
      <path d="m8 10 3-3 3 3" />
    </>
  ),
  'external': (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>
  ),
  'undo': (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-2" />
    </>
  ),
  'warn': (
    <>
      <path d="M12 3 2 21h20z" />
      <path d="M12 9v5" />
      <path d="M12 18v.5" />
    </>
  ),
  'globe': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </>
  ),
};

export function Icon({
  name,
  className = '',
  label,
  style,
}: {
  name: IconName;
  className?: string;
  /** Provide a visible-text label for screen readers when the icon stands alone (icon-only buttons). */
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`icon ${className}`}
      fill="none"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}
