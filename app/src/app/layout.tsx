/**
 * Root layout — passthrough.
 *
 * The real <html> and <body> live in [locale]/layout.tsx so the `lang`
 * attribute always reflects the active locale (fr or en).
 *
 * Route handlers (_health, api/*) bypass layouts and don't need html/body.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
