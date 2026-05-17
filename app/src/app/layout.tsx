import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'API Cameroun — Portail des Investissements',
  description:
    "Portail officiel de gestion des conventions d'investissement de l'Agence de Promotion des Investissements du Cameroun. En application de l'Ordonnance n° 2025/002 du 18 juillet 2025.",
  icons: {
    icon: '/favicon.svg',
  },
  robots: {
    // Restrict indexing during development / staging
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
