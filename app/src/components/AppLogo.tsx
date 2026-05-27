import Image from 'next/image';
import { Link } from '@/i18n/navigation';

// Reusable IPA crest used in every authenticated page header.
// Replaces the previous "A" obsidian placeholder seal.
//
//   <AppLogo />                           // default md (44px), links to /dashboard
//   <AppLogo size="lg" href="/" />        // larger on the login left panel
//   <AppLogo asLink={false} size="lg" />  // bare (no link wrapper)

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-9',   // 36px
  md: 'h-11',  // 44px — matches the original "A" seal height
  lg: 'h-14',  // 56px — for editorial / login crest
  xl: 'h-20',  // 80px — landing
};

export function AppLogo({
  size = 'md',
  href = '/dashboard',
  asLink = true,
  className = '',
}: {
  size?: Size;
  href?: string;
  asLink?: boolean;
  className?: string;
}) {
  const img = (
    <Image
      src="/logo-ipa.png"
      alt="API Cameroun · Agence de Promotion des Investissements"
      width={1501}
      height={1136}
      priority
      className={`${SIZE_CLASS[size]} w-auto ${className}`}
    />
  );
  if (!asLink) return img;
  return (
    <Link
      href={href}
      className="inline-flex flex-shrink-0 items-center"
      aria-label="API Cameroun"
    >
      {img}
    </Link>
  );
}
