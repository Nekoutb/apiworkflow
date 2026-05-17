import { cn } from '@/lib/cn';

/**
 * Official API Cameroun logo (placeholder SVG).
 * To swap in the real PNG, place /public/logo.png and use <img /> here instead.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden bg-white', className)}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        <defs>
          <linearGradient id="apiLogoBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3a59b5" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="url(#apiLogoBg)" />
        <text
          x="50"
          y="60"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontSize="30"
          fill="#ffffff"
          textAnchor="middle"
        >
          API
        </text>
        <path
          d="M 18 78 Q 50 92 82 78"
          stroke="#fcd116"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
